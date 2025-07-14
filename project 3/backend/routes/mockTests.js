const express = require("express");
const cron = require("node-cron");
module.exports = (supabase) => {
  const router = express.Router();

  // GET /api/mock-tests
  router.get("/", async (req, res) => {
    try {
      // 1️⃣ Fetch all mock tests with quiz funnel relations
      const { data: tests, error } = await supabase
        .from("mock_tests")
        .select(`*, quiz_funnels(*), quiz_funnel_id`);
      if (error) {
        console.error("Supabase mock_tests fetch error:", error);
        return res.status(400).json({ error: error.message || error });
      }

      const now = new Date();

      // Run every minute
      cron.schedule("* * * * *", async () => {
        const now = new Date().toISOString();
        const { data: tests, error } = await supabase
          .from("mock_tests")
          .select("id, scheduled_at")
          .eq("status", "scheduled");

        for (const { id, scheduled_at } of tests || []) {
          if (scheduled_at <= now) {
            await supabase
              .from("mock_tests")
              .update({ status: "running", started_at: now })
              .eq("id", id);
          }
        }
      });

      // 2️⃣ Auto-complete any running test that's past its end time
      for (let test of tests || []) {
        if (test.status === "running") {
          const { count } = await supabase
            .from("quiz_funnel_mcqs")
            .select("*", { head: true, count: "exact" })
            .eq("quiz_funnel_id", test.quiz_funnel_id);
          const mcqCount = count || 0;

          const start = new Date(test.started_at);
          const end = new Date(
            start.getTime() + (test.interval_minutes || 0) * mcqCount * 60000
          );

          if (now > end) {
            // Update Supabase and local test object
            await supabase
              .from("mock_tests")
              .update({ status: "completed", completed_at: now.toISOString() })
              .eq("id", test.id);

            test.status = "completed";
            test.completed_at = now.toISOString();
          }
        }
      }

      // 3️⃣ Flatten and build return payload
      const results = await Promise.all(
        (tests || []).map(async (test) => {
          const name = test.quiz_funnels?.name || "";
          const scheduled_at = test.quiz_funnels?.scheduled_at || null;
          const interval_minutes = test.interval_minutes ?? null;
          const whatsapp_groups = test.whatsapp_groups || [];

          const { count } = await supabase
            .from("quiz_funnel_mcqs")
            .select("*", { head: true, count: "exact" })
            .eq("quiz_funnel_id", test.quiz_funnel_id);
          const mcq_count = count || 0;

          let whatsapp_group_details = [];
          if (whatsapp_groups.length > 0) {
            const { data: groupData } = await supabase
              .from("whatsapp_groups")
              .select("jid, name")
              .in("jid", whatsapp_groups);
            whatsapp_group_details = groupData || [];
          }

          return {
            ...test,
            name,
            scheduled_at,
            interval_minutes,
            whatsapp_groups,
            whatsapp_group_details,
            mcq_count,
          };
        })
      );

      res.json(results);
    } catch (e) {
      console.error("Unexpected error in /api/mock-tests:", e);
      res.status(500).json({ error: e.message || e.toString() });
    }
  });

  // POST /api/mock-tests
  router.post("/", async (req, res) => {
    const {
      quiz_funnel_id,
      whatsappGroups,
      intervalMinutes,
      whatsapp_groups,
      interval_minutes,
      status,
    } = req.body;

    const insertObj = { quiz_funnel_id };
    insertObj.whatsapp_groups = whatsappGroups || whatsapp_groups || [];
    insertObj.interval_minutes = intervalMinutes || interval_minutes || 0;
    if (status) insertObj.status = status;

    const { data, error } = await supabase
      .from("mock_tests")
      .insert([insertObj])
      .select()
      .single();

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // PUT /api/mock-tests/:id
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { status, started_at, completed_at } = req.body;

    const { data, error } = await supabase
      .from("mock_tests")
      .update({ status, started_at, completed_at })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  return router;
};
