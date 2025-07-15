require("dotenv").config({ path: __dirname + "/.env" });
console.log("Loaded environment variables:", process.env);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const whatsappBot = require("./whatsappBot");

console.log("SUPABASE_SERVICE_KEY:", process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Routes
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

app.get("/api/whatsapp-session", (req, res) => {
  res.json({ status: "ok", message: "WhatsApp session active" });
});

// API endpoint to schedule mock test to WhatsApp group
app.post("/api/schedule-mock-whatsapp", async (req, res) => {
  const { mockTestId, groupJid } = req.body;
  if (!mockTestId || !groupJid) {
    return res
      .status(400)
      .json({ error: "mockTestId and groupJid are required" });
  }
  try {
    await whatsappBot.startWhatsAppBot(); // Ensure bot is started
    whatsappBot.scheduleMockTestToGroup(mockTestId, groupJid);
    res.json({
      success: true,
      message: "Mock test scheduled to WhatsApp group.",
    });
  } catch (err) {
    console.error("Error scheduling mock test to WhatsApp:", err);
    res
      .status(500)
      .json({ error: "Failed to schedule mock test to WhatsApp group." });
  }
});

// API endpoint to list WhatsApp groups the bot is a member of
app.get("/api/whatsapp-groups", async (req, res) => {
  try {
    await whatsappBot.startWhatsAppBot(); // Ensure bot is started
    const groups = await whatsappBot.listGroupJidsWithNames();
    res.json(groups);
  } catch (err) {
    console.error("Error listing WhatsApp groups:", err);
    res.status(500).json({ error: "Failed to list WhatsApp groups." });
  }
});

const SCHEDULER_INTERVAL = 30 * 1000; // Check every 30 seconds
let runningSchedulers = {};

// Add scheduled job to start tests at their scheduled time
setInterval(async () => {
  try {
    // Find tests that are scheduled to start now or in the past, but not yet running
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
          // Set status to running
          await supabase
            .from("mock_tests")
            .update({ status: "running" })
            .eq("id", test.id);
          console.log(`Auto-started mock test ${test.id} at scheduled time.`);
        }
      }
    }
  } catch (err) {
    console.error("Error in scheduled auto-start job:", err);
  }
}, 60 * 1000); // Check every minute

async function schedulerLoop() {
  try {
    // 1. Get all running mock tests
    const { data: runningTests, error } = await supabase
      .from("mock_tests")
      .select("*")
      .eq("status", "running");
    if (error) {
      console.error("Scheduler: Error fetching running mock tests:", error);
      return;
    }
    for (const test of runningTests) {
      // Only schedule if not already running
      if (!runningSchedulers[test.id]) {
        runningSchedulers[test.id] = true;
        runMockTest(test).finally(() => {
          delete runningSchedulers[test.id];
        });
      }
    }
  } catch (err) {
    console.error("Scheduler: Unexpected error in schedulerLoop:", err);
  }
}

async function runMockTest(test) {
  try {
    const groupJids = test.whatsappGroups || test.whatsapp_groups || [];
    if (!Array.isArray(groupJids) || groupJids.length === 0) {
      console.warn(
        `Scheduler: No WhatsApp groups for mock test ${test.id}. Skipping test execution.`
      );
      return;
    }
    await whatsappBot.startWhatsAppBot();
    // Use the bot's full MCQ flow for each group
    for (const groupJid of groupJids) {
      await whatsappBot.scheduleMockTestToGroup(test.id, groupJid);
    }
  } catch (err) {
    console.error("Scheduler: Error running mock test:", err);
  }
}

setInterval(schedulerLoop, SCHEDULER_INTERVAL);

// After starting the bot, set up QR listener
whatsappBot.startWhatsAppBot().then((sock) => {
  if (sock) whatsappBot.setupQrListener(sock);
});

// Start WhatsApp bot and run scheduled mock test at launch
(async () => {
  await whatsappBot.startWhatsAppBot();
  whatsappBot.runScheduledMockTest();
})();

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
