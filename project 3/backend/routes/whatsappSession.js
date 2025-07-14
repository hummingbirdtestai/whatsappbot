// const express = require('express');
// const router = express.Router();

// // This module expects to be passed the Baileys socket and state
// module.exports = (getSocket) => {
//   // GET /api/whatsapp-session
//   router.get('/', async (req, res) => {
//     try {
//       const sock = getSocket();
//       if (!sock || !sock.user) {
//         // If QR code is available, send as data URL
//         if (global.latestQr) {
//           return res.json({
//             status: 'disconnected',
//             phoneNumber: '',
//             lastConnected: '',
//             qrCode: global.latestQr
//           });
//         }
//         return res.json({
//           status: 'disconnected',
//           phoneNumber: '',
//           lastConnected: '',
//           qrCode: ''
//         });
//       }
//       res.json({
//         status: 'connected',
//         phoneNumber: sock.user.id,
//         lastConnected: new Date().toISOString(),
//         qrCode: ''
//       });
//     } catch (e) {
//       console.error('Error in /api/whatsapp-session:', e);
//       res.status(500).json({ status: 'disconnected', error: e.message });
//     }
//   });

//   // POST /api/whatsapp-session/disconnect
//   router.post('/disconnect', async (req, res) => {
//     try {
//       const sock = getSocket();
//       if (sock && sock.ws && typeof sock.ws.close === 'function') {
//         sock.ws.close();
//       }
//       res.json({ status: 'disconnected' });
//     } catch (e) {
//       res.status(500).json({ status: 'disconnected', error: e.message });
//     }
//   });

//   return router;
// };

const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Utility to delete Baileys auth folder (forces full logout)
function deleteBaileysAuthFolder() {
  const folder = path.join(__dirname, "..", "baileys_auth"); // adjust path if needed
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    console.log("🔒 Baileys auth folder deleted.");
  }
}

// This module expects to be passed the Baileys socket
// module.exports = (getSocket) => {
//   // GET /api/whatsapp-session
//   router.get("/", async (req, res) => {
//     try {
//       const sock = getSocket();
//       if (!sock || !sock.user) {
//         return res.json({
//           status: "disconnected",
//           phoneNumber: "",
//           lastConnected: "",
//           qrCode: global.latestQr || "",
//         });
//       }
//       res.json({
//         status: "connected",
//         phoneNumber: sock.user.id,
//         lastConnected: new Date().toISOString(),
//         qrCode: "",
//       });
//     } catch (e) {
//       console.error("Error in /api/whatsapp-session:", e);
//       res.status(500).json({ status: "disconnected", error: e.message });
//     }
//   });

//   // POST /api/whatsapp-session/disconnect
//   router.post("/disconnect", async (req, res) => {
//     try {
//       const sock = getSocket();
//       if (sock && sock.ws && typeof sock.ws.close === "function") {
//         sock.ws.close(); // Disconnect the WebSocket
//       }

//       deleteBaileysAuthFolder(); // Fully remove session

//       res.json({ status: "disconnected" });
//     } catch (e) {
//       console.error("Error during disconnect:", e);
//       res.status(500).json({ status: "disconnected", error: e.message });
//     }
//   });

//   return router;
// };

module.exports = (getSocket) => {
  router.get("/", async (req, res) => {
    try {
      const sock = getSocket();
      if (!sock || !sock.user) {
        return res.json({
          status: "disconnected",
          phoneNumber: "",
          lastConnected: "",
          qrCode: global.latestQr || "",
        });
      }

      res.json({
        status: "connected",
        phoneNumber: sock.user.id,
        lastConnected: new Date().toISOString(),
        qrCode: "",
      });
    } catch (e) {
      res.status(500).json({ status: "disconnected", error: e.message });
    }
  });

  router.post("/disconnect", async (req, res) => {
    try {
      const sock = getSocket();
      if (sock?.ws?.close) {
        sock.ws.close();
      }

      const fs = require("fs");
      const path = require("path");
      const folder = path.join(__dirname, "..", "baileys_auth");
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
        console.log("🔒 Baileys auth folder deleted.");
      }

      res.json({ status: "disconnected" });
    } catch (e) {
      res.status(500).json({ status: "disconnected", error: e.message });
    }
  });

  return router; // ✅ VERY IMPORTANT
};
