// const express = require('express');

// module.exports = (supabase) => {
//   const router = express.Router();

//   // GET /api/dashboard-summary
//   router.get('/', async (req, res) => {
//     // Total MCQs
//     const { count: total_mcqs } = await supabase.from('mcqs').select('*', { count: 'exact', head: true });
//     // Active/Completed/Running Tests
//     const { count: active } = await supabase.from('mock_tests').select('*', { count: 'exact', head: true }).eq('status', 'active');
//     const { count: completed } = await supabase.from('mock_tests').select('*', { count: 'exact', head: true }).eq('status', 'completed');
//     const { count: running } = await supabase.from('mock_tests').select('*', { count: 'exact', head: true }).eq('status', 'running');
//     // MCQ Categories summary
//     const { data: categories, error } = await supabase.from('category_mcq_counts').select('*');
//     if (error) return res.status(400).json({ error });
//     res.json({ total_mcqs, active, completed, running, categories });
//   });

//   return router;
// };

const express = require("express");

module.exports = (supabase) => {
  const router = express.Router();

  // GET /api/dashboard-summary
  router.get("/", async (req, res) => {
    // Total MCQs
    const { count: total_mcqs } = await supabase
      .from("mcqs")
      .select("*", { count: "exact", head: true });
    // Active/Completed/Running Tests
    const { count: active } = await supabase
      .from("mock_tests")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    const { count: completed } = await supabase
      .from("mock_tests")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");
    const { count: running } = await supabase
      .from("mock_tests")
      .select("*", { count: "exact", head: true })
      .eq("status", "running");
    // MCQ Categories summary
    const { data: categories, error } = await supabase
      .from("category_mcq_counts")
      .select("*");
    if (error) return res.status(400).json({ error });
    res.json({ total_mcqs, active, completed, running, categories });
  });

  return router;
};
