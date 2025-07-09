const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const mcqs = [
  {
    "question": "Which hormone surge triggers ovulation?",
    "options": { "A": "FSH", "B": "LH", "C": "Estrogen", "D": "Progesterone" },
    "correctAnswer": "B",
    "explanation": "LH surge triggers ovulation by causing follicular rupture."
  },
  {
    "question": "Most common site of fertilization in fallopian tube?",
    "options": { "A": "Fimbriae", "B": "Ampulla", "C": "Isthmus", "D": "Infundibulum" },
    "correctAnswer": "B",
    "explanation": "Fertilization most commonly occurs in the ampulla of the fallopian tube."
  }
  // ...add more MCQs as needed
];

async function uploadMCQs() {
  for (let i = 0; i < mcqs.length; i++) {
    const mcq = mcqs[i];
    try {
      const res = await fetch('http://localhost:5000/api/mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcq)
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        data = null;
      }
      if (!res.ok) {
        console.error(`MCQ ${i + 1}: HTTP ${res.status} -`, data || text);
      } else {
        console.log(`Uploaded MCQ ${i + 1}:`, data);
      }
    } catch (err) {
      console.error(`Network error uploading MCQ ${i + 1}:`, err);
    }
  }
}

uploadMCQs(); 