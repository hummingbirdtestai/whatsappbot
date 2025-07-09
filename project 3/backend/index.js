process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const whatsappBot = require('./whatsappBot');

console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Routes
app.use('/api/mcqs', require('./routes/mcqs')(supabase));
app.use('/api/categories', require('./routes/categories')(supabase));
app.use('/api/quiz-funnels', require('./routes/quizFunnels')(supabase));
app.use('/api/mock-tests', require('./routes/mockTests')(supabase));
app.use('/api/dashboard-summary', require('./routes/dashboardSummary')(supabase));
app.use('/api/whatsapp-groups', require('./routes/whatsappGroups')(supabase));

// API endpoint to schedule mock test to WhatsApp group
app.post('/api/schedule-mock-whatsapp', async (req, res) => {
  const { mockTestId, groupJid } = req.body;
  if (!mockTestId || !groupJid) {
    return res.status(400).json({ error: 'mockTestId and groupJid are required' });
  }
  try {
    await whatsappBot.startWhatsAppBot(); // Ensure bot is started
    whatsappBot.scheduleMockTestToGroup(mockTestId, groupJid);
    res.json({ success: true, message: 'Mock test scheduled to WhatsApp group.' });
  } catch (err) {
    console.error('Error scheduling mock test to WhatsApp:', err);
    res.status(500).json({ error: 'Failed to schedule mock test to WhatsApp group.' });
  }
});

// API endpoint to list WhatsApp groups the bot is a member of
app.get('/api/whatsapp-groups', async (req, res) => {
  try {
    await whatsappBot.startWhatsAppBot(); // Ensure bot is started
    const groups = await whatsappBot.listGroupJidsWithNames();
    res.json(groups);
  } catch (err) {
    console.error('Error listing WhatsApp groups:', err);
    res.status(500).json({ error: 'Failed to list WhatsApp groups.' });
  }
});

const SCHEDULER_INTERVAL = 30 * 1000; // Check every 30 seconds
let runningSchedulers = {};

// Add scheduled job to start tests at their scheduled time
setInterval(async () => {
  try {
    // Find tests that are scheduled to start now or in the past, but not yet running
    const { data: toStart, error } = await supabase
      .from('mock_tests')
      .select('id, quiz_funnel_id, status, created_at, quiz_funnels!inner(scheduled_at)')
      .eq('status', 'active');
    if (!error && Array.isArray(toStart)) {
      const now = new Date();
      for (const test of toStart) {
        const scheduledAt = test.quiz_funnels?.scheduled_at ? new Date(test.quiz_funnels.scheduled_at) : null;
        if (scheduledAt && scheduledAt <= now) {
          // Set status to running
          await supabase.from('mock_tests').update({ status: 'running' }).eq('id', test.id);
          console.log(`Auto-started mock test ${test.id} at scheduled time.`);
        }
      }
    }
  } catch (err) {
    console.error('Error in scheduled auto-start job:', err);
  }
}, 60 * 1000); // Check every minute

async function schedulerLoop() {
  // 1. Get all running mock tests
  const { data: runningTests, error } = await supabase.from('mock_tests').select('*').eq('status', 'running');
  if (error) {
    console.error('Scheduler: Error fetching running mock tests:', error);
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
}

async function runMockTest(test) {
  try {
    const groupJids = test.whatsappGroups || test.whatsapp_groups || [];
    if (!Array.isArray(groupJids) || groupJids.length === 0) {
      console.warn(`Scheduler: No WhatsApp groups for mock test ${test.id}. Skipping test execution.`);
      return;
    }
    await whatsappBot.startWhatsAppBot();
    // Get quiz funnel and MCQs
    const { data: funnel, error: funnelError } = await supabase.from('quiz_funnels').select('*').eq('id', test.quiz_funnel_id).single();
    if (funnelError || !funnel) {
      console.error('Scheduler: Quiz funnel not found:', funnelError);
      return;
    }
    const { data: funnelMCQs, error: funnelMCQsError } = await supabase.from('quiz_funnel_mcqs').select('*').eq('quiz_funnel_id', funnel.id).order('order_index');
    if (funnelMCQsError || !funnelMCQs) {
      console.error('Scheduler: Quiz funnel MCQs not found:', funnelMCQsError);
      return;
    }
    const mcqIds = funnelMCQs.map(fm => fm.mcq_id);
    const { data: mcqs, error: mcqsError } = await supabase.from('mcqs').select('*').in('id', mcqIds);
    if (mcqsError || !mcqs) {
      console.error('Scheduler: MCQs not found:', mcqsError);
      return;
    }
    // Find current MCQ index
    let idx = test.currentMCQ || 0;
    while (idx < mcqs.length && test.status === 'running') {
      const mcq = mcqs[idx];
      const optionsText = Object.entries(mcq.options)
        .map(([key, val]) => `${key}. ${val}`)
        .join('\n');
      const msg = `*Q${idx + 1}:* ${mcq.question}\n${optionsText}`;
      for (const groupJid of groupJids) {
        console.log(`Sending MCQ to group: ${groupJid} (Test: ${test.id}, MCQ: ${idx + 1})`);
        try {
          await whatsappBot.sendGroupMessage(groupJid, msg);
        } catch (err) {
          console.error(`Error sending MCQ to group ${groupJid}:`, err);
        }
      }
      // Update currentMCQ in DB
      await supabase.from('mock_tests').update({ currentMCQ: idx + 1 }).eq('id', test.id);
      idx++;
      // Wait for interval
      await new Promise(res => setTimeout(res, (test.intervalMinutes || 3) * 60 * 1000));
      // Re-fetch test status in case it was paused/stopped
      const { data: updatedTest } = await supabase.from('mock_tests').select('*').eq('id', test.id).single();
      if (!updatedTest || updatedTest.status !== 'running') break;
    }
    // Mark as completed if all MCQs sent
    if (idx >= mcqs.length) {
      await supabase.from('mock_tests').update({ status: 'completed' }).eq('id', test.id);
      for (const groupJid of groupJids) {
        await whatsappBot.sendGroupMessage(groupJid, '✅ Mock test complete!');
      }
      console.log(`Mock test ${test.id} completed.`);
    }
  } catch (err) {
    console.error('Scheduler: Error running mock test:', err);
  }
}

setInterval(schedulerLoop, SCHEDULER_INTERVAL);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 