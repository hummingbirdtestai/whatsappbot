require("dotenv").config({ path: __dirname + "/.env" });

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const whatsappBot = require("./whatsappBot");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ✅ ROUTES
app.use("/api/mcqs", require("./routes/mcqs"));
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

// ✅ ENDPOINT to check if bot session is active
app.get("/api/whatsapp-session", (req, res) => {
  res.json({ status: "ok", message: "WhatsApp session active" });
});

// ✅ API: Schedule mock test to group
app.post("/api/schedule-mock-whatsapp", async (req, res) => {
  const { mockTestId, groupJid } = req.body;
  if (!mockTestId || !groupJid) {
    return res
      .status(400)
      .json({ error: "mockTestId and groupJid are required" });
  }
  try {
    await whatsappBot.startWhatsAppBot();
    await whatsappBot.scheduleMockTestToGroup(mockTestId, groupJid);
    res.json({
      success: true,
      message: "Mock test scheduled to WhatsApp group.",
    });
  } catch (err) {
    console.error("❌ Error scheduling mock test:", err);
    res.status(500).json({ error: "Failed to schedule mock test." });
  }
});

// ✅ API: List WhatsApp Groups
app.get("/api/whatsapp-groups", async (req, res) => {
  try {
    await whatsappBot.startWhatsAppBot();
    const groups = await whatsappBot.listGroupJidsWithNames();
    res.json(groups);
  } catch (err) {
    console.error("❌ Error listing WhatsApp groups:", err);
    res.status(500).json({ error: "Failed to list WhatsApp groups." });
  }
});

const SCHEDULER_INTERVAL = 30 * 1000; // 30 seconds
let runningSchedulers = {};

// ✅ Scheduled job: Auto-start tests at scheduled time
setInterval(async () => {
  try {
    const { data: toStart, error } = await supabase
      .from("mock_tests")
      .select(
        "id, quiz_funnel_id, status, created_at, quiz_funnels!inner(scheduled_at)"
      )
      .eq("status", "active");

    if (!error && Array.isArray(toStart)) {
      const now = new Date();
      for (const test of toStart) {
        const scheduledAt = test.quiz_funnels?.scheduled_at
          ? new Date(test.quiz_funnels.scheduled_at)
          : null;
        if (scheduledAt && scheduledAt <= now) {
          await supabase
            .from("mock_tests")
            .update({ status: "running" })
            .eq("id", test.id);

          console.log(
            `⏱️ Auto-started mock test ${test.id} at scheduled time.`
          );
        }
      }
    }
  } catch (err) {
    console.error("❌ Error in scheduled auto-start job:", err);
  }
}, 60 * 1000);

// ✅ Main scheduler loop
async function schedulerLoop() {
  try {
    const { data: runningTests, error } = await supabase
      .from("mock_tests")
      .select("*")
      .eq("status", "running");

    if (error) {
      console.error("❌ Scheduler: Failed to fetch running tests:", error);
      return;
    }

    for (const test of runningTests) {
      if (!runningSchedulers[test.id]) {
        runningSchedulers[test.id] = true;
        runMockTest(test).finally(() => {
          delete runningSchedulers[test.id];
        });
      }
    }
  } catch (err) {
    console.error("❌ Scheduler: Unexpected error:", err);
  }
}

// ✅ Runner for each mock test
async function runMockTest(test) {
  try {
    const groupJids = test.whatsappGroups || test.whatsapp_groups || [];
    if (!Array.isArray(groupJids) || groupJids.length === 0) {
      console.warn(
        `⚠️ Scheduler: No WhatsApp groups for mock test ${test.id}. Skipping execution.`
      );
      return;
    }

    await whatsappBot.startWhatsAppBot();
    for (const groupJid of groupJids) {
      await whatsappBot.scheduleMockTestToGroup(test.id, groupJid);
    }
  } catch (err) {
    console.error("❌ Scheduler: Error running mock test:", err);
  }
}

setInterval(schedulerLoop, SCHEDULER_INTERVAL);

// ✅ Start WhatsApp bot and setup QR code
whatsappBot.startWhatsAppBot().then((sock) => {
  if (sock) whatsappBot.setupQrListener(sock);
});

// ✅ Run scheduled mock test if already present
(async () => {
  await whatsappBot.startWhatsAppBot();
  whatsappBot.runScheduledMockTest();
})();

// ✅ Catch-all middleware for logging
app.use((req, res, next) => {
  console.log(`📥 Incoming request: ${req.method} ${req.url}`);
  next();
});

// ✅ Home route
app.get("/", (req, res) => {
  res.send("✅ Backend is running");
});

// ✅ Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
module.exports = app;

// Patch process.exit to log and wait if called from Baileys reconnect logic
const originalExit = process.exit;
process.exit = function (code) {
  console.error(
    "[FATAL] process.exit called with code",
    code,
    ". This may be due to max reconnect attempts."
  );
  // Wait a long time before actually exiting to avoid nodemon restart loop
  setTimeout(() => {
    originalExit(code);
  }, 60000); // Wait 60 seconds before exiting
};
