const express = require("express");

module.exports = (supabase) => {
  const router = express.Router();

  // GET /api/categories
  router.get("/", async (req, res) => {
    const { data, error } = await supabase.from("categories").select("*");
    if (error) return res.status(400).json({ error });
    res.json(data);
  });

  return router;
};
