const express = require('express');

module.exports = (supabase) => {
  const router = express.Router();

  // GET /api/mock-tests
  router.get('/', async (req, res) => {
    // Join mock_tests with quiz_funnels and count MCQs
    const { data: tests, error } = await supabase.from('mock_tests')
      .select(`*, quiz_funnels(*), quiz_funnel_id`);
    if (error) return res.status(400).json({ error });
    // For each test, get MCQ count and flatten fields
    const results = await Promise.all((tests || []).map(async (test) => {
      // Get quiz funnel info
      let name = '';
      let scheduled_at = null;
      let interval_minutes = test.interval_minutes || null;
      let whatsapp_groups = test.whatsapp_groups || [];
      if (test.quiz_funnels) {
        name = test.quiz_funnels.name;
        scheduled_at = test.quiz_funnels.scheduled_at;
      }
      // Count MCQs in funnel
      let mcq_count = 0;
      if (test.quiz_funnel_id) {
        const { count } = await supabase.from('quiz_funnel_mcqs').select('*', { count: 'exact', head: true }).eq('quiz_funnel_id', test.quiz_funnel_id);
        mcq_count = count || 0;
      }
      // Fetch WhatsApp group details (name + jid)
      let whatsapp_group_details = [];
      if (whatsapp_groups.length > 0) {
        const { data: groupData } = await supabase.from('whatsapp_groups').select('jid, name').in('jid', whatsapp_groups);
        whatsapp_group_details = groupData || [];
      }
      return {
        ...test,
        name,
        scheduled_at,
        interval_minutes,
        whatsapp_groups,
        whatsapp_group_details, // <-- new field
        mcq_count,
      };
    }));
    res.json(results);
  });

  // POST /api/mock-tests
  router.post('/', async (req, res) => {
    const { quiz_funnel_id, whatsappGroups, intervalMinutes, whatsapp_groups, interval_minutes, status } = req.body;
    const insertObj = { quiz_funnel_id };
    // Accept both camelCase and snake_case, always save as snake_case
    insertObj.whatsapp_groups = whatsappGroups || whatsapp_groups || [];
    insertObj.interval_minutes = intervalMinutes || interval_minutes || 0;
    if (status) insertObj.status = status;
    const { data, error } = await supabase.from('mock_tests').insert([insertObj]).select().single();
    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  // PUT /api/mock-tests/:id
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { status, started_at, completed_at } = req.body;
    const { data, error } = await supabase.from('mock_tests').update({ status, started_at, completed_at }).eq('id', id).select().single();
    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  return router;
}; 