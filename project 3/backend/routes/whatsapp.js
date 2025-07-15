const express = require("express");
const router = express.Router();

router.get("/whatsapp-session", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
