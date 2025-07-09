const { createClient } = require('@supabase/supabase-js');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const INTERVAL_MINUTES = 3; // Interval between MCQs
const AUTH_FOLDER = path.join(__dirname, 'baileys_auth');

let sock;
let isConnecting = false;
let connectPromise = null;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 10;

async function ensureConnectionOpen() {
  await startWhatsAppBot();
  if (!sock || !sock.user) {
    // Wait for connection to open
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        if (connection === 'open') {
          sock.ev.off('connection.update', handler);
          resolve();
        }
      };
      sock.ev.on('connection.update', handler);
    });
  }
}

async function startWhatsAppBot() {
  if (sock && sock.user) return sock;
  if (isConnecting) return connectPromise;
  isConnecting = true;
  connectPromise = (async () => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();
      sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        syncFullHistory: false,
      });
      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          const qrcode = require('qrcode-terminal');
          qrcode.generate(qr, { small: true });
          console.log('Scan the QR code above with WhatsApp to log in.');
        }
        if (connection === 'close') {
          console.log('WhatsApp connection closed.');
          if (reconnectAttempts < MAX_RECONNECTS) {
            reconnectAttempts++;
            setTimeout(() => {
              console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
              startWhatsAppBot();
            }, 5000);
          } else {
            console.error('Max reconnect attempts reached. Exiting.');
            process.exit(1);
          }
        } else if (connection === 'open') {
          reconnectAttempts = 0;
          console.log('WhatsApp bot connected!');
        }
      });
      // Listen for group messages and log student responses
      sock.ev.on('messages.upsert', async (m) => {
        try {
          const msg = m.messages && m.messages[0];
          if (!msg || !msg.key || !msg.key.remoteJid) return;
          const jid = msg.key.remoteJid;
          if (jid.endsWith('@g.us') && msg.message?.conversation) {
            // Log or process the student's response here
            console.log(`Response from ${msg.pushName || msg.key.participant} in ${jid}: ${msg.message.conversation}`);
          }
        } catch (err) {
          console.error('Error in messages.upsert handler:', err);
        }
      });
      isConnecting = false;
      return sock;
    } catch (err) {
      isConnecting = false;
      console.error('Error starting WhatsApp bot:', err);
    }
  })();
  return connectPromise;
}

// Send a message to a group
async function sendGroupMessage(groupJid, text) {
  await ensureConnectionOpen();
  if (!sock || !sock.user) {
    console.error('WhatsApp bot not connected. Cannot send message.');
    return;
  }
  try {
    await sock.sendMessage(groupJid, { text });
  } catch (err) {
    console.error(`Failed to send message to group ${groupJid}:`, err);
  }
}

// Schedule MCQs for a mock test to a group
async function scheduleMockTestToGroup(mockTestId, groupJid) {
  // 1. Get the mock test
  const { data: mockTest, error: mockTestError } = await supabase.from('mock_tests').select('*').eq('id', mockTestId).single();
  if (mockTestError || !mockTest) {
    console.error('Mock test not found:', mockTestError);
    return;
  }
  if (!mockTest.whatsapp_groups || mockTest.whatsapp_groups.length === 0) {
    console.warn(`No WhatsApp groups assigned for mock test ${mockTestId}. Skipping.`);
    return;
  }
  // 2. Get the quiz funnel
  const { data: funnel, error: funnelError } = await supabase.from('quiz_funnels').select('*').eq('id', mockTest.quiz_funnel_id).single();
  if (funnelError || !funnel) {
    console.error('Quiz funnel not found:', funnelError);
    return;
  }
  // 3. Get the MCQ IDs in order
  const { data: funnelMCQs, error: funnelMCQsError } = await supabase.from('quiz_funnel_mcqs').select('*').eq('quiz_funnel_id', funnel.id).order('order_index');
  if (funnelMCQsError || !funnelMCQs) {
    console.error('Quiz funnel MCQs not found:', funnelMCQsError);
    return;
  }
  const mcqIds = funnelMCQs.map(fm => fm.mcq_id);
  // 4. Get the MCQ details
  const { data: mcqs, error: mcqsError } = await supabase.from('mcqs').select('*').in('id', mcqIds);
  if (mcqsError || !mcqs) {
    console.error('MCQs not found:', mcqsError);
    return;
  }
  // 5. Schedule sending MCQs at intervals
  let idx = 0;
  async function sendNextMCQ() {
    if (idx >= mcqs.length) {
      await sendGroupMessage(groupJid, '✅ Mock test complete!');
      return;
    }
    const mcq = mcqs[idx];
    const optionsText = Object.entries(mcq.options)
      .map(([key, val]) => `${key}. ${val}`)
      .join('\n');
    const msg = `*Q${idx + 1}:* ${mcq.question}\n${optionsText}`;
    await sendGroupMessage(groupJid, msg);
    idx++;
    setTimeout(sendNextMCQ, INTERVAL_MINUTES * 60 * 1000);
  }
  sendNextMCQ();
}

// List all group JIDs the bot is a member of
async function listGroupJids() {
  if (!sock) {
    await startWhatsAppBot();
  }
  // Wait for connection
  if (!sock.user) {
    await new Promise((resolve) => {
      const handler = ({ connection }) => {
        if (connection === 'open') {
          sock.ev.off('connection.update', handler);
          resolve();
        }
      };
      sock.ev.on('connection.update', handler);
    });
  }
  const chats = await sock.groupFetchAllParticipating();
  Object.values(chats).forEach(group => {
    console.log(`Group: ${group.subject} | JID: ${group.id}`);
  });
}

// List all group JIDs and names the bot is a member of (for API)
async function listGroupJidsWithNames() {
  await startWhatsAppBot();
  // Wait for connection
  if (!sock.user) {
    await new Promise(resolve => {
      const handler = ({ connection }) => {
        if (connection === 'open') {
          sock.ev.off('connection.update', handler); // Remove handler after first call
          resolve();
        }
      };
      sock.ev.on('connection.update', handler);
    });
  }
  const chats = await sock.groupFetchAllParticipating();
  return Object.values(chats).map(group => ({ jid: group.id, name: group.subject }));
}

// Minimal test function to send a message and log responses
async function testSendAndReceive(groupJid, text) {
  await sendGroupMessage(groupJid, text);
  console.log('Waiting for responses... (check logs for incoming messages)');
}

// CLI usage for listing groups and test send
if (require.main === module) {
  (async () => {
    const [, , arg1, arg2, ...rest] = process.argv;
    if (arg1 === 'list-groups') {
      await startWhatsAppBot();
      await listGroupJids();
      process.exit(0);
    } else if (arg1 === 'test-send' && arg2 && rest.length > 0) {
      const message = rest.join(' ');
      await testSendAndReceive(arg2, message);
      process.exit(0);
    } else if (arg1 && arg2) {
      console.log(`Scheduling mock test ${arg1} to group ${arg2}`);
      await startWhatsAppBot();
      scheduleMockTestToGroup(arg1, arg2);
    } else {
      console.log('To schedule: node whatsappBot.js <mockTestId> <groupJid>');
      console.log('To list groups: node whatsappBot.js list-groups');
      console.log('To test send: node whatsappBot.js test-send <groupJid> <message>');
    }
  })();
}

module.exports = {
  startWhatsAppBot,
  scheduleMockTestToGroup,
  listGroupJidsWithNames,
  sendGroupMessage,
  testSendAndReceive,
}; 