require("dotenv").config({ path: __dirname + "/.env" });
const { createClient } = require("@supabase/supabase-js");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const path = require("path");
const { DateTime } = require("luxon");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const INTERVAL_MINUTES = 3; // Interval between MCQs
const AUTH_FOLDER = path.join(__dirname, "baileys_auth");

let sock;
let isConnecting = false;
let connectPromise = null;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 20; // Increased reconnect attempts

// Periodic health check implementation
setInterval(async () => {
  if (!sock || !sock.user) {
    console.log("Connection health check failed. Attempting reconnect...");
    await startWhatsAppBot();
  } else {
    console.log("Connection health check passed.");
  }
}, 60000); // Check every 60 seconds

// Enhanced reconnection logic and message queuing
let messageQueue = [];

async function processMessageQueue() {
  while (messageQueue.length > 0) {
    const { groupJid, text } = messageQueue.shift();
    try {
      await sendGroupMessage(groupJid, text);
    } catch (err) {
      console.error(
        `Failed to process queued message for group ${groupJid}:`,
        err
      );
      messageQueue.unshift({ groupJid, text }); // Requeue the message
      break; // Stop processing further messages
    }
  }
}

async function ensureConnectionOpen() {
  console.log("Ensuring connection is open...");
  await startWhatsAppBot();
  if (!sock || !sock.user) {
    console.log("Waiting for connection to open...");
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        console.log(`Connection update: ${connection}`);
        if (connection === "open") {
          console.log("Connection successfully opened.");
          sock.ev.off("connection.update", handler);
          resolve();
        }
      };
      sock.ev.on("connection.update", handler);
    });
  } else {
    console.log("Connection is already open.");
  }
}

async function startWhatsAppBot() {
  if (sock && sock.user) return sock;
  if (isConnecting) return connectPromise;
  isConnecting = true;
  connectPromise = (async () => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();
      sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        syncFullHistory: false,
      });
      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          const qrcode = require("qrcode-terminal");
          qrcode.generate(qr, { small: true });
          console.log("Scan the QR code above with WhatsApp to log in.");
        }
        if (connection === "close") {
          console.log(
            "Connection closed. Last disconnect reason:",
            lastDisconnect?.error
          );
          if (reconnectAttempts < MAX_RECONNECTS) {
            reconnectAttempts++;
            setTimeout(() => {
              console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
              startWhatsAppBot();
            }, 10000); // Increased delay to 10 seconds
          } else {
            console.error("Max reconnect attempts reached. Exiting.");
            process.exit(1);
          }
        } else if (connection === "open") {
          reconnectAttempts = 0;
          console.log("Connection opened successfully.");
          processMessageQueue(); // Process queued messages when connection is restored
        }
      });
      // Listen for group messages and log student responses
      sock.ev.on("messages.upsert", async (m) => {
        try {
          const msg = m.messages && m.messages[0];
          if (!msg || !msg.key || !msg.key.remoteJid) return;
          const jid = msg.key.remoteJid;
          if (jid.endsWith("@g.us") && msg.message?.conversation) {
            // Log or process the student's response here
            console.log(
              `Response from ${
                msg.pushName || msg.key.participant
              } in ${jid}: ${msg.message.conversation}`
            );
          }
        } catch (err) {
          console.error("Error in messages.upsert handler:", err);
        }
      });
      isConnecting = false;
      return sock;
    } catch (err) {
      isConnecting = false;
      console.error("Error starting WhatsApp bot:", err);
    }
  })();
  return connectPromise;
}

// Forcefully destroy and recreate the socket on connection closed error
async function forceReconnect() {
  try {
    if (sock && sock.ws && typeof sock.ws.close === "function") {
      sock.ws.close();
    }
  } catch (e) {
    console.error("Error closing socket:", e);
  }
  sock = undefined;
  isConnecting = false;
  connectPromise = null;
  await new Promise((res) => setTimeout(res, 3000)); // Wait before reconnect
  await startWhatsAppBot();
}

// Send a message to a group with robust connection check and retry logic
async function sendGroupMessage(groupJid, text, attempt = 1) {
  const MAX_SEND_ATTEMPTS = 5;
  await ensureConnectionOpen();
  if (!sock || !sock.user) {
    console.error("WhatsApp bot not connected. Queuing message.");
    messageQueue.push({ groupJid, text });
    return;
  }
  try {
    await sock.sendMessage(groupJid, { text });
    processMessageQueue(); // Process queued messages after successful send
  } catch (err) {
    console.error(
      `Failed to send message to group ${groupJid} (attempt ${attempt}):`,
      err
    );
    if (
      err?.output?.statusCode === 428 ||
      (err.message && err.message.includes("Connection Closed")) ||
      (err.message && err.message.includes("not open"))
    ) {
      if (attempt < MAX_SEND_ATTEMPTS) {
        console.log("Force reconnecting socket and retrying send...");
        await forceReconnect();
        return sendGroupMessage(groupJid, text, attempt + 1);
      } else {
        console.error("Max send attempts reached. Queuing message.");
        messageQueue.push({ groupJid, text });
      }
    } else {
      // Other errors, just queue
      messageQueue.push({ groupJid, text });
    }
  }
}

// Helper: Valid answer check
function isValidAnswer(msg) {
  return ["a", "b", "c", "d"].includes(msg.trim().toLowerCase());
}

// Helper: Score calculation
function calcScore(userAnswer, correctAnswer) {
  if (!userAnswer) return 0;
  return userAnswer.toLowerCase() === correctAnswer.toLowerCase() ? 4 : -1;
}

/**
 * Schedule and run a mock test in a WhatsApp group, following strict MCQ quiz flow:
 * 1. Post each MCQ at the scheduled time, start a 3-minute timer.
 * 2. During the timer, record only the first valid answer (a/b/c/d) per user for that MCQ.
 * 3. At the end of 3 minutes, evaluate answers, update scores, post leaderboard and explanation.
 * 4. Repeat for all MCQs, then finish.
 */
async function scheduleMockTestToGroup(mockTestId, groupJid) {
  // Fetch mock test config
  const { data: mockTest, error: mockTestError } = await supabase
    .from("mock_tests")
    .select("*")
    .eq("id", mockTestId)
    .single();
  if (mockTestError || !mockTest) {
    console.error("Mock test not found:", mockTestError);
    return;
  }
  if (!mockTest.whatsapp_groups || mockTest.whatsapp_groups.length === 0) {
    console.warn(
      `No WhatsApp groups assigned for mock test ${mockTestId}. Skipping.`
    );
    return;
  }
  // Fetch quiz funnel and MCQ order
  const { data: funnel, error: funnelError } = await supabase
    .from("quiz_funnels")
    .select("*")
    .eq("id", mockTest.quiz_funnel_id)
    .single();
  if (funnelError || !funnel) {
    console.error("Quiz funnel not found:", funnelError);
    return;
  }
  const { data: funnelMCQs, error: funnelMCQsError } = await supabase
    .from("quiz_funnel_mcqs")
    .select("*")
    .eq("quiz_funnel_id", funnel.id)
    .order("order_index");
  if (funnelMCQsError || !funnelMCQs) {
    console.error("Quiz funnel MCQs not found:", funnelMCQsError);
    return;
  }
  const mcqIds = funnelMCQs.map((fm) => fm.mcq_id);
  const { data: mcqs, error: mcqsError } = await supabase
    .from("mcqs")
    .select("*")
    .in("id", mcqIds);
  if (mcqsError || !mcqs) {
    console.error("MCQs not found:", mcqsError);
    return;
  }
  // Set test status to running
  await supabase
    .from("mock_tests")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      current_mcq: 0,
    })
    .eq("id", mockTestId);

  // Step through each MCQ in order
  for (let idx = 0; idx < mcqs.length; idx++) {
    const mcq = mcqs[idx];
    // 1️⃣ Post MCQ and start timer
    const optionsText = Object.entries(mcq.options)
      .map(([key, val]) => `${key}. ${val}`)
      .join("\n");
    const msg = `*Q${idx + 1}:* ${mcq.question}\n${optionsText}`;
    await sendGroupMessage(groupJid, msg);
    await supabase
      .from("mock_tests")
      .update({ current_mcq: idx + 1 })
      .eq("id", mockTestId);

    // 2️⃣ During 3-min window, record only first valid answer per user
    const answers = {}; // userJid -> answer
    const answerListener = async (m) => {
      const msgObj = m.messages && m.messages[0];
      if (!msgObj || !msgObj.key || !msgObj.key.remoteJid) return;
      const jid = msgObj.key.remoteJid;
      // Strictly filter: only accept answers from the correct group
      if (jid !== groupJid) return;
      let userJid = msgObj.key.participant || msgObj.pushName;
      let userName = msgObj.pushName || userJid;
      if (
        userJid &&
        typeof userJid === "string" &&
        userJid.endsWith("@s.whatsapp.net")
      ) {
        userJid = userJid.replace("@s.whatsapp.net", "");
      }
      // Only accept first valid answer (a/b/c/d, case-insensitive) per user
      const text = msgObj.message?.conversation?.trim();
      if (!userJid || !text || !isValidAnswer(text)) return;
      if (answers[userJid]) return; // Ignore subsequent answers
      answers[userJid] = text.toLowerCase();
      // Store submission in Supabase, now with user_name
      await supabase.from("mock_test_submissions").insert({
        mock_test_id: mockTestId,
        mcq_id: mcq.id,
        user_jid: userJid,
        user_name: userName,
        answer: text.toLowerCase(),
        submitted_at: new Date().toISOString(),
      });
    };
    sock.ev.on("messages.upsert", answerListener);
    // Wait exactly 3 minutes
    await new Promise((res) => setTimeout(res, INTERVAL_MINUTES * 60 * 1000));
    sock.ev.off("messages.upsert", answerListener);

    // 3️⃣ At end of timer, evaluate answers and update scores
    let submissions = [];
    try {
      const result = await supabase
        .from("mock_test_submissions")
        .select("*")
        .eq("mock_test_id", mockTestId)
        .eq("mcq_id", mcq.id);
      if (result.error) {
        console.error("Error fetching submissions:", result.error);
      } else if (Array.isArray(result.data)) {
        submissions = result.data;
      } else {
        submissions = [];
      }
    } catch (err) {
      console.error("Exception fetching submissions:", err);
      submissions = [];
    }
    // Calculate and update cumulative scores
    const scores = {};
    for (const sub of submissions) {
      scores[sub.user_jid] = calcScore(sub.answer, mcq.answer);
      // Update cumulative score in mock_test_scores
      const { data: prev } = await supabase
        .from("mock_test_scores")
        .select("*")
        .eq("mock_test_id", mockTestId)
        .eq("user_jid", sub.user_jid)
        .single();
      const newScore = (prev?.score || 0) + scores[sub.user_jid];
      if (prev) {
        await supabase
          .from("mock_test_scores")
          .update({ score: newScore })
          .eq("mock_test_id", mockTestId)
          .eq("user_jid", sub.user_jid);
      } else {
        await supabase.from("mock_test_scores").insert({
          mock_test_id: mockTestId,
          user_jid: sub.user_jid,
          score: newScore,
        });
      }
    }
    // 4️⃣ Post leaderboard (descending order) and explanation
    // Fetch leaderboard and also latest user names for each user_jid
    const { data: leaderboard } = await supabase
      .from("mock_test_scores")
      .select("*")
      .eq("mock_test_id", mockTestId)
      .order("score", { ascending: false });
    // Fetch latest user_name for each user_jid from submissions
    let nameMap = {};
    if (leaderboard && leaderboard.length > 0) {
      const userJids = leaderboard.map((l) => l.user_jid);
      const { data: nameRows } = await supabase
        .from("mock_test_submissions")
        .select("user_jid, user_name, submitted_at")
        .in("user_jid", userJids)
        .eq("mock_test_id", mockTestId);
      // For each user_jid, pick the latest submission's user_name
      if (Array.isArray(nameRows)) {
        nameRows.forEach((row) => {
          if (
            !nameMap[row.user_jid] ||
            new Date(row.submitted_at) >
              new Date(nameMap[row.user_jid].submitted_at)
          ) {
            nameMap[row.user_jid] = {
              user_name: row.user_name,
              submitted_at: row.submitted_at,
            };
          }
        });
      }
      // ✅ Console log the leaderboard with names
      //   console.log("📊 Leaderboard after Q" + (idx + 1));
      //   leaderboard.forEach((entry, i) => {
      //     const name = nameMap[entry.user_jid]?.user_name || entry.user_jid;
      //     console.log(
      //       `${i + 1}. ${name} (${entry.user_jid}) - Score: ${entry.score}`
      //     );
      //   });
      console.log(`📊 Leaderboard Table after Q${idx + 1}`);
      const tableData = leaderboard.map((entry, i) => ({
        Rank: i + 1,
        Name: nameMap[entry.user_jid]?.user_name || entry.user_jid,
        JID: entry.user_jid,
        Score: entry.score,
      }));
      console.table(tableData);
    }
    // Use WhatsApp-friendly leaderboard message with names
    let leaderboardMsg = generateLeaderboardMessage(
      leaderboard || [],
      idx + 1,
      nameMap
    );
    await sendGroupMessage(groupJid, leaderboardMsg);
    // Post explanation for current MCQ
    let explanationMsg = `*Explanation for Q${idx + 1}:*\n`;
    explanationMsg += mcq.explanation
      ? mcq.explanation
      : "No explanation provided.";
    await sendGroupMessage(groupJid, explanationMsg);
    // 5️⃣ Proceed to next MCQ automatically (loop continues)
  }
  // Mark test as complete
  await sendGroupMessage(groupJid, "✅ Mock test complete!");
  await supabase
    .from("mock_tests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      current_mcq: mcqs.length,
    })
    .eq("id", mockTestId);
}

// WhatsApp-friendly leaderboard generator
function generateLeaderboardMessage(leaderboard, questionNumber, nameMap = {}) {
  // Sort by score descending
  const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
  const medals = ["🥇", "🥈", "🥉"];
  let msg = `*Leaderboard after Q${questionNumber}*\n`;
  if (sorted.length === 0) {
    msg += "No answers submitted yet.";
  } else {
    sorted.forEach((entry, i) => {
      const medal = medals[i] || "";
      const displayName = nameMap[entry.user_jid]?.user_name || entry.user_jid;
      msg += `${i + 1}. ${medal} ${displayName}: ${entry.score}\n`;
    });
  }
  return msg.trim();
}

// List all group JIDs the bot is a member of
async function listGroupJids() {
  console.log("Fetching group JIDs...");
  if (!sock) {
    console.log("Socket not initialized. Starting WhatsApp bot...");
    await startWhatsAppBot();
  }
  if (!sock.user) {
    console.log("Waiting for connection to open before fetching groups...");
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        console.log(`Connection update during group fetch: ${connection}`);
        if (connection === "open") {
          console.log("Connection successfully opened for group fetch.");
          sock.ev.off("connection.update", handler);
          resolve();
        }
      };
      sock.ev.on("connection.update", handler);
    });
  }
  try {
    const chats = await sock.groupFetchAllParticipating();
    Object.values(chats).forEach((group) => {
      console.log(`Group: ${group.subject} | JID: ${group.id}`);
    });
  } catch (err) {
    console.error("Error fetching group JIDs:", err);
  }
}

// List all group JIDs and names the bot is a member of (for API)
async function listGroupJidsWithNames() {
  await startWhatsAppBot();
  // Wait for connection
  if (!sock.user) {
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        if (connection === "open") {
          sock.ev.off("connection.update", handler); // Remove handler after first call
          resolve();
        }
      };
      sock.ev.on("connection.update", handler);
    });
  }
  const chats = await sock.groupFetchAllParticipating();
  return Object.values(chats).map((group) => ({
    jid: group.id,
    name: group.subject,
  }));
}

// Minimal test function to send a message and log responses
async function testSendAndReceive(groupJid, text) {
  await sendGroupMessage(groupJid, text);
  console.log("Waiting for responses... (check logs for incoming messages)");
}

// Expose a getter for the current socket and QR code
function getSocket() {
  return sock;
}

// Listen for QR code updates and store latest as data URL
const qrcode = require("qrcode");
global.latestQr = "";
function setupQrListener(sock) {
  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      global.latestQr = await qrcode.toDataURL(update.qr);
    }
  });
}

// CLI usage for listing groups and test send
if (require.main === module) {
  (async () => {
    const [, , arg1, arg2, ...rest] = process.argv;
    if (arg1 === "list-groups") {
      await startWhatsAppBot();
      await listGroupJids();
      process.exit(0);
    } else if (arg1 === "test-send" && arg2 && rest.length > 0) {
      const message = rest.join(" ");
      await testSendAndReceive(arg2, message);
      process.exit(0);
    } else if (arg1 && arg2) {
      console.log(`Scheduling mock test ${arg1} to group ${arg2}`);
      await startWhatsAppBot();
      scheduleMockTestToGroup(arg1, arg2);
    } else {
      console.log("To schedule: node whatsappBot.js <mockTestId> <groupJid>");
      console.log("To list groups: node whatsappBot.js list-groups");
      console.log(
        "To test send: node whatsappBot.js test-send <groupJid> <message>"
      );
    }
  })();
}

async function runScheduledMockTest() {
  // 1. Find the next published mock test with start_date + start_time >= now
  const now = DateTime.now().toUTC();
  const { data: tests, error } = await supabase
    .from("mock_tests")
    .select("*")
    .eq("published", true)
    .eq("status", "active");
  if (error || !tests || tests.length === 0) {
    console.log("No upcoming published mock tests found.");
    return;
  }
  // Find the test with the earliest start time >= now
  let nextTest = null;
  let nextStart = null;
  for (const test of tests) {
    const start = DateTime.fromISO(test.start_date + "T" + test.start_time, {
      zone: "utc",
    });
    if (start >= now && (!nextStart || start < nextStart)) {
      nextTest = test;
      nextStart = start;
    }
  }
  if (!nextTest) {
    console.log("No mock test scheduled for the future.");
    return;
  }
  const waitMs = nextStart.diff(now).as("milliseconds");
  console.log(
    `Next mock test (${
      nextTest.id
    }) scheduled at ${nextStart.toISO()} (waiting ${Math.round(
      waitMs / 1000
    )} seconds)`
  );
  if (waitMs > 0) {
    await new Promise((res) => setTimeout(res, waitMs));
  }
  // Start the quiz for all assigned WhatsApp groups
  for (const groupJid of nextTest.whatsapp_groups || []) {
    await scheduleMockTestToGroup(nextTest.id, groupJid);
  }
}

module.exports = {
  startWhatsAppBot,
  scheduleMockTestToGroup,
  listGroupJidsWithNames,
  sendGroupMessage,
  testSendAndReceive,
  getSocket,
  setupQrListener,
  runScheduledMockTest,
};
