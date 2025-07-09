const express = require('express');

module.exports = (supabase) => {
  const router = express.Router();

  // GET /api/whatsapp-groups
  router.get('/', async (req, res) => {
    const { data, error } = await supabase.from('whatsapp_groups').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // POST /api/whatsapp-groups
  router.post('/', async (req, res) => {
    const { jid, name } = req.body;
    if (!jid) return res.status(400).json({ error: 'JID is required' });
    const { data, error } = await supabase.from('whatsapp_groups').insert([{ jid, name }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // DELETE /api/whatsapp-groups/:id
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('whatsapp_groups').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // PUT /api/whatsapp-groups/:id
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { jid, name } = req.body;
    const { data, error } = await supabase.from('whatsapp_groups').update({ jid, name }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  return router;
}; 