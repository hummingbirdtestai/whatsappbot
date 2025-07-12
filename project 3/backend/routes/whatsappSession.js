const express = require('express');
const router = express.Router();

// This module expects to be passed the Baileys socket and state
module.exports = (getSocket) => {
  // GET /api/whatsapp-session
  router.get('/', async (req, res) => {
    try {
      const sock = getSocket();
      if (!sock || !sock.user) {
        // If QR code is available, send as data URL
        if (global.latestQr) {
          return res.json({
            status: 'disconnected',
            phoneNumber: '',
            lastConnected: '',
            qrCode: global.latestQr
          });
        }
        return res.json({
          status: 'disconnected',
          phoneNumber: '',
          lastConnected: '',
          qrCode: ''
        });
      }
      res.json({
        status: 'connected',
        phoneNumber: sock.user.id,
        lastConnected: new Date().toISOString(),
        qrCode: ''
      });
    } catch (e) {
      console.error('Error in /api/whatsapp-session:', e);
      res.status(500).json({ status: 'disconnected', error: e.message });
    }
  });

  // POST /api/whatsapp-session/disconnect
  router.post('/disconnect', async (req, res) => {
    try {
      const sock = getSocket();
      if (sock && sock.ws && typeof sock.ws.close === 'function') {
        sock.ws.close();
      }
      res.json({ status: 'disconnected' });
    } catch (e) {
      res.status(500).json({ status: 'disconnected', error: e.message });
    }
  });

  return router;
};
