const express = require("express");

module.exports = (supabase) => {
  const router = express.Router();

  // GET /api/mcqs?category_id=...
  router.get("/", async (req, res) => {
    const { category_id } = req.query;
    let query = supabase.from("mcqs").select("*");
    if (category_id) query = query.eq("category_id", category_id);
    try {
      const { data, error } = await query;
      if (error) {
        console.error("Supabase MCQ fetch error:", error);
        return res.status(400).json({ error: error.message || error });
      }
      res.json(data);
    } catch (e) {
      console.error("Unexpected error in /api/mcqs:", e);
      res.status(500).json({ error: e.message || e.toString() });
    }
  });

  // POST /api/mcqs
  router.post("/", async (req, res) => {
    const { question, options, answer, explanation } = req.body;
    // Validate input for new format
    if (
      !question ||
      typeof options !== "object" ||
      !["A", "B", "C", "D"].includes(answer) ||
      !options[answer]
    ) {
      console.error("Invalid MCQ format:", req.body);
      return res.status(400).json({ error: "Invalid MCQ format" });
    }
    try {
      const { data, error } = await supabase
        .from("mcqs")
        .insert([{ question, options, answer: answer, explanation }])
        .select()
        .single();
      if (error) {
        console.error("Supabase insert error:", error);
        console.error("Request body:", req.body);
        return res.status(400).json({ error });
      }
      res.json(data);
    } catch (err) {
      console.error("Internal server error:", err);
      console.error("Request body:", req.body);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/mcqs/:id
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { question, options, answer, explanation } = req.body;
    // Validate input for new format
    if (
      !question ||
      typeof options !== "object" ||
      !["A", "B", "C", "D"].includes(answer) ||
      //   !options[answer]
      !options[answer]?.trim()
    ) {
      return res.status(400).json({ error: "Invalid MCQ format" });
    }
    try {
      const { data, error } = await supabase
        .from("mcqs")
        .update({ question, options, answer: answer, explanation })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error(error);
        return res.status(400).json({ error });
      }
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/mcqs/:id
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      console.log("Attempting to delete MCQ with ID:", id);
      const { error } = await supabase.from("mcqs").delete().eq("id", id);
      if (error) {
        console.error("Supabase delete error:", error);
        return res.status(400).json({ error });
      }
      console.log("Successfully deleted MCQ with ID:", id);
      res.status(204).send();
    } catch (err) {
      console.error("Internal server error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
};
