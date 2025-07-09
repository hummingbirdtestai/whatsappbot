const express = require('express');

module.exports = (supabase) => {
  const router = express.Router();

  // POST /api/quiz-funnels
  router.post('/', async (req, res) => {
    const { name, scheduled_at, mcq_ids } = req.body;
    if (!mcq_ids || mcq_ids.length === 0) return res.status(400).json({ error: 'Must provide at least 1 MCQ ID' });
    const { data: funnel, error } = await supabase.from('quiz_funnels').insert([{ name, scheduled_at }]).select().single();
    if (error) return res.status(400).json({ error });
    const funnel_id = funnel.id;
    const funnel_mcqs = mcq_ids.map((mcq_id, i) => ({ quiz_funnel_id: funnel_id, mcq_id, order_index: i + 1 }));
    const { error: mcqError } = await supabase.from('quiz_funnel_mcqs').insert(funnel_mcqs);
    if (mcqError) return res.status(400).json({ error: mcqError });
    res.json(funnel);
  });

  // GET /api/quiz-funnels
  router.get('/', async (req, res) => {
    const { data, error } = await supabase.from('quiz_funnels').select('*');
    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  return router;
}; 