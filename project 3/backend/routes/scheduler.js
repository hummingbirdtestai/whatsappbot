// scheduler.js
module.exports = (supabase) => {
  const cron = require("node-cron");
  cron.schedule("* * * * *", async () => {
    const now = new Date().toISOString();
    const { data: tests, error } = await supabase
      .from("mock_tests")
      .select("id, scheduled_at, interval_minutes, quiz_funnel_id")
      .eq("status", "scheduled");

    for (const t of tests || []) {
      if (t.scheduled_at <= now) {
        await supabase
          .from("mock_tests")
          .update({ status: "running", started_at: now })
          .eq("id", t.id);
        console.log(`Started mock-test ${t.id}`);
      }
    }
  });

  // Optionally add more scheduled jobs here
};
