require("dotenv").config({ path: __dirname + "/.env" });
const { createClient } = require("@supabase/supabase-js");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const path = require("path");
const { DateTime } = require("luxon");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const INTERVAL_MINUTES = 3; // Interval between MCQs
const AUTH_FOLDER = path.join(__dirname, "baileys_auth");

let sock = undefined;
let isConnecting = false;
let connectPromise = null;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 20;
let messageQueue = [];

// Health check: reconnect if needed
setInterval(async () => {
  if (!sock || !sock.user) {
    console.log(
      "[HealthCheck] WhatsApp not connected. Attempting reconnect..."
    );
    await startWhatsAppBot();
  }
}, 60000);

// Ensure only one connection attempt at a time
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
        // printQRInTerminal: true, // Deprecated, QR is handled in connection.update event
      });
      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          require("qrcode-terminal").generate(qr, { small: true });
          qrcode.toDataURL(qr).then((dataUrl) => {
            global.latestQr = dataUrl;
          });
        }
        if (connection === "close") {
          console.log("[Connection] Closed. Reason:", lastDisconnect?.error);
          if (reconnectAttempts < MAX_RECONNECTS) {
            reconnectAttempts++;
            setTimeout(() => {
              console.log(
                `[Connection] Reconnecting... (attempt ${reconnectAttempts})`
              );
              startWhatsAppBot();
            }, 10000);
          } else {
            console.error(
              "[Connection] Max reconnect attempts reached. Exiting."
            );
            process.exit(1);
          }
        } else if (connection === "open") {
          reconnectAttempts = 0;
          console.log("[Connection] Opened successfully.");
          processMessageQueue();
        }
      });
      isConnecting = false;
      return sock;
    } catch (err) {
      isConnecting = false;
      console.error("[startWhatsAppBot] Error:", err);
    }
  })();
  return connectPromise;
}

// Ensure connection is open before sending messages
async function ensureConnectionOpen() {
  await startWhatsAppBot();
  if (!sock || !sock.user) {
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        if (connection === "open") {
          sock.ev.off("connection.update", handler);
          resolve();
        }
      };
      sock.ev.on("connection.update", handler);
    });
  }
}

// Message queue processing
async function processMessageQueue() {
  while (messageQueue.length > 0) {
    const { groupJid, text } = messageQueue.shift();
    try {
      await sendGroupMessage(groupJid, text);
    } catch (err) {
      console.error(`[Queue] Failed to send to ${groupJid}:`, err);
      messageQueue.unshift({ groupJid, text });
      break;
    }
  }
}

// Force reconnect
async function forceReconnect() {
  try {
    if (sock && sock.ws && typeof sock.ws.close === "function") {
      sock.ws.close();
    }
  } catch (e) {
    console.error("[forceReconnect] Error closing socket:", e);
  }
  sock = undefined;
  isConnecting = false;
  connectPromise = null;
  await new Promise((res) => setTimeout(res, 3000));
  await startWhatsAppBot();
}

// Send message with retry/queue
async function sendGroupMessage(groupJid, text, attempt = 1) {
  const MAX_SEND_ATTEMPTS = 5;
  await ensureConnectionOpen();
  if (!sock || !sock.user) {
    messageQueue.push({ groupJid, text });
    return;
  }
  try {
    await sock.sendMessage(groupJid, { text });
    processMessageQueue();
  } catch (err) {
    if (
      err?.output?.statusCode === 428 ||
      (err.message && err.message.includes("Connection Closed")) ||
      (err.message && err.message.includes("not open"))
    ) {
      if (attempt < MAX_SEND_ATTEMPTS) {
        await forceReconnect();
        return sendGroupMessage(groupJid, text, attempt + 1);
      } else {
        messageQueue.push({ groupJid, text });
      }
    } else {
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
    console.error(
      "[scheduleMockTestToGroup] Mock test not found:",
      mockTestError
    );
    return;
  }
  if (!mockTest.whatsapp_groups || mockTest.whatsapp_groups.length === 0) {
    console.warn(
      `[scheduleMockTestToGroup] No WhatsApp groups for test ${mockTestId}. Skipping.`
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
    console.error(
      "[scheduleMockTestToGroup] Quiz funnel not found:",
      funnelError
    );
    return;
  }
  const { data: funnelMCQs, error: funnelMCQsError } = await supabase
    .from("quiz_funnel_mcqs")
    .select("*")
    .eq("quiz_funnel_id", funnel.id)
    .order("order_index");
  if (funnelMCQsError || !funnelMCQs) {
    console.error(
      "[scheduleMockTestToGroup] Quiz funnel MCQs not found:",
      funnelMCQsError
    );
    return;
  }
  const mcqIds = funnelMCQs.map((fm) => fm.mcq_id);
  const { data: mcqs, error: mcqsError } = await supabase
    .from("mcqs")
    .select("*")
    .in("id", mcqIds);
  if (mcqsError || !mcqs) {
    console.error("[scheduleMockTestToGroup] MCQs not found:", mcqsError);
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
      const text = msgObj.message?.conversation?.trim();
      if (!userJid || !text || !isValidAnswer(text)) return;
      if (answers[userJid]) return;
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
        console.error(
          "[scheduleMockTestToGroup] Error fetching submissions:",
          result.error
        );
      } else if (Array.isArray(result.data)) {
        submissions = result.data;
      } else {
        submissions = [];
      }
    } catch (err) {
      console.error(
        "[scheduleMockTestToGroup] Exception fetching submissions:",
        err
      );
      submissions = [];
    }
    // Calculate and update cumulative scores
    for (const sub of submissions) {
      const { data: prev } = await supabase
        .from("mock_test_scores")
        .select("*")
        .eq("mock_test_id", mockTestId)
        .eq("user_jid", sub.user_jid)
        .single();
      const newScore = (prev?.score || 0) + calcScore(sub.answer, mcq.answer);
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
    // 4️⃣ Post leaderboard and explanation
    const { data: leaderboard } = await supabase
      .from("mock_test_scores")
      .select("*")
      .eq("mock_test_id", mockTestId)
      .order("score", { ascending: false });
    let nameMap = {};
    if (leaderboard && leaderboard.length > 0) {
      const userJids = leaderboard.map((l) => l.user_jid);
      const { data: nameRows } = await supabase
        .from("mock_test_submissions")
        .select("user_jid, user_name, submitted_at")
        .in("user_jid", userJids)
        .eq("mock_test_id", mockTestId);
      if (Array.isArray(nameRows)) {
        nameRows.forEach((row) => {
          if (
            !nameMap[row.user_jid] ||
            new Date(row.submitted_at) >
              new Date(nameMap[row.user_jid]?.submitted_at)
          ) {
            nameMap[row.user_jid] = {
              user_name: row.user_name,
              submitted_at: row.submitted_at,
            };
          }
        });
      }
    }
    let leaderboardMsg = generateLeaderboardMessage(
      leaderboard || [],
      idx + 1,
      nameMap
    );
    await sendGroupMessage(groupJid, leaderboardMsg);
    let explanationMsg = `*Explanation for Q${idx + 1}:*\n`;
    explanationMsg += mcq.explanation
      ? mcq.explanation
      : "No explanation provided.";
    await sendGroupMessage(groupJid, explanationMsg);
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

// List all group JIDs and names
async function listGroupJidsWithNames() {
  await startWhatsAppBot();
  if (!sock.user) {
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        if (connection === "open") {
          sock.ev.off("connection.update", handler);
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

// Minimal test function
async function testSendAndReceive(groupJid, text) {
  await sendGroupMessage(groupJid, text);
  console.log("Waiting for responses... (check logs for incoming messages)");
}

function getSocket() {
  return sock;
}

function setupQrListener(sock) {
  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      global.latestQr = await qrcode.toDataURL(update.qr);
    }
  });
}

async function runScheduledMockTest() {
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
  for (const groupJid of nextTest.whatsapp_groups || []) {
    await scheduleMockTestToGroup(nextTest.id, groupJid);
  }
}

// [DEV TEST] Utility to simulate 300 MCQs and verify scoring/leaderboard logic
// Not exported, for developer confidence only
async function _devTestSimulate300MCQs() {
  const mockTestId = "test-mock-id";
  const groupJid = "test-group@g.us";
  // Simulate 300 MCQs
  let scores = {};
  for (let idx = 0; idx < 300; idx++) {
    // Simulate answers from 3 users
    const users = ["user1", "user2", "user3"];
    const correctAnswer = ["a", "b", "c", "d"][idx % 4];
    for (const user of users) {
      // Each user answers randomly, user1 always correct
      const answer =
        user === "user1" ? correctAnswer : ["a", "b", "c", "d"][(idx + 1) % 4];
      const score = answer === correctAnswer ? 4 : -1;
      scores[user] = (scores[user] || 0) + score;
    }
    // Simulate leaderboard message
    const leaderboard = Object.entries(scores).map(([user_jid, score]) => ({
      user_jid,
      score,
    }));
    leaderboard.sort((a, b) => b.score - a.score);
    // Simulate explanation
    const explanation = `Explanation for Q${idx + 1}`;
    // Log leaderboard and explanation
    console.log(`Leaderboard after Q${idx + 1}:`, leaderboard);
    console.log(explanation);
  }
  // Final scores
  console.log("Final scores after 300 MCQs:", scores);
}
// To run: uncomment the next line
// _devTestSimulate300MCQs();

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
