// index.js
require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const whatsappBot = require("./whatsappBot");
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const whatsappSessionRoutes = require("./routes/whatsappSession");

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

app.use("/api/mcqs", require("./routes/mcqs")(supabase));
app.use("/api/categories", require("./routes/categories")(supabase));
app.use("/api/quiz-funnels", require("./routes/quizFunnels")(supabase));
app.use("/api/mock-tests", require("./routes/mockTests")(supabase));
app.use(
  "/api/dashboard-summary",
  require("./routes/dashboardSummary")(supabase)
);
app.use("/api/whatsapp-groups", require("./routes/whatsappGroups")(supabase));

const whatsappSessionRoute = require("./routes/whatsappSession")(() =>
  whatsappBot.getSocket()
);
app.use("/api/whatsapp-session", whatsappSessionRoute);

app.post("/api/schedule-mock-whatsapp", async (req, res) => {
  const { mockTestId, groupJid } = req.body;
  if (!mockTestId || !groupJid) {
    return res
      .status(400)
      .json({ error: "mockTestId and groupJid are required" });
  }
  try {
    await whatsappBot.startWhatsAppBot();
    whatsappBot.scheduleMockTestToGroup(mockTestId, groupJid);
    res.json({
      success: true,
      message: "Mock test scheduled to WhatsApp group.",
    });
  } catch (err) {
    console.error("Error scheduling mock test:", err);
    res.status(500).json({ error: "Failed to schedule mock test." });
  }
});

app.get("/api/whatsapp-groups", async (req, res) => {
  try {
    await whatsappBot.startWhatsAppBot();
    const groups = await whatsappBot.listGroupJidsWithNames();
    res.json(groups);
  } catch (err) {
    console.error("Error listing WhatsApp groups:", err);
    res.status(500).json({ error: "Failed to list WhatsApp groups." });
  }
});

const SCHEDULER_INTERVAL = 30 * 1000;
let runningSchedulers = {};

setInterval(async () => {
  const now = new Date();

  const { data: toStart, error: startErr } = await supabase
    .from("mock_tests")
    .select(
      "id, quiz_funnel_id, status, started_at, interval_minutes, whatsapp_groups, quiz_funnels!inner(scheduled_at)"
    )
    .eq("status", "scheduled");

  if (!startErr && Array.isArray(toStart)) {
    for (const test of toStart) {
      const scheduledAt = new Date(test.quiz_funnels?.scheduled_at);
      if (scheduledAt <= now) {
        await supabase
          .from("mock_tests")
          .update({ status: "running", started_at: now.toISOString() })
          .eq("id", test.id);
        console.log(`✅ Started mock test ${test.id} at ${now.toISOString()}`);
      }
    }
  }

  const { data: runningTests, error: runErr } = await supabase
    .from("mock_tests")
    .select("id, started_at, quiz_funnel_id, interval_minutes")
    .eq("status", "running");

  if (!runErr && Array.isArray(runningTests)) {
    for (const test of runningTests) {
      const { count } = await supabase
        .from("quiz_funnel_mcqs")
        .select("*", { head: true, count: "exact" })
        .eq("quiz_funnel_id", test.quiz_funnel_id);

      const mcqCount = count || 0;
      const duration = mcqCount * (test.interval_minutes || 0) * 60000;
      const endTime = new Date(new Date(test.started_at).getTime() + duration);

      if (now > endTime) {
        await supabase
          .from("mock_tests")
          .update({ status: "completed", completed_at: now.toISOString() })
          .eq("id", test.id);
        console.log(
          `🛑 Auto-completed mock test ${test.id} at ${now.toISOString()}`
        );
      }
    }
  }

  const { data: allRunning } = await supabase
    .from("mock_tests")
    .select("*")
    .eq("status", "running");

  for (const test of allRunning || []) {
    if (!runningSchedulers[test.id]) {
      runningSchedulers[test.id] = true;
      runMockTest(test).finally(() => {
        delete runningSchedulers[test.id];
      });
    }
  }
}, SCHEDULER_INTERVAL);

async function runMockTest(test) {
  try {
    const groupJids = test.whatsappGroups || test.whatsapp_groups || [];
    if (!Array.isArray(groupJids) || groupJids.length === 0) {
      console.warn(`No WhatsApp groups for mock test ${test.id}`);
      return;
    }

    await whatsappBot.startWhatsAppBot();
    for (const groupJid of groupJids) {
      await whatsappBot.scheduleMockTestToGroup(test.id, groupJid);
    }
  } catch (err) {
    console.error(`❌ Error running mock test ${test.id}:`, err);
  }
}

let sock = null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  // Listen for disconnect reason
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason =
        lastDisconnect?.error?.output?.payload?.message || "Unknown";
      console.log("🔌 Disconnected:", reason);
    } else if (connection === "open") {
      console.log("✅ WhatsApp connected.");
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startBot();

// Inject socket into route module
app.use(
  "/api/whatsapp-session",
  whatsappSessionRoutes(() => sock)
);

whatsappBot.startWhatsAppBot().then((sock) => {
  if (sock) whatsappBot.setupQrListener(sock);
});

(async () => {
  await whatsappBot.startWhatsAppBot();
  whatsappBot.runScheduledMockTest?.();
})();

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
