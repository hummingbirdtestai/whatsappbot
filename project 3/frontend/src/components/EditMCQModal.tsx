import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { useMCQContext } from "../context/MCQContext";

interface EditMCQModalProps {
  mcq: any;
  onClose: () => void;
}

export const EditMCQModal: React.FC<EditMCQModalProps> = ({ mcq, onClose }) => {
  const { updateMCQ } = useMCQContext();
  const [formData, setFormData] = useState({
    question: mcq.question,
    options: [...mcq.options],
    answer: mcq.answer,
    category: mcq.category,
    difficulty: mcq.difficulty,
    explanation: mcq.explanation || "",
  });

  //   const [formData, setFormData] = useState(() => ({
  //     question: mcq.question ?? "",
  //     options: ["A", "B", "C", "D"].map((k) => mcq.options?.[k] ?? ""),
  //     answer: ["A", "B", "C", "D"].indexOf(mcq.answer),
  //     category: mcq.category ?? "",
  //     difficulty: mcq.difficulty ?? "Easy",
  //     explanation: mcq.explanation ?? "",
  //   }));

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/mcqs/${mcq.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: formData.question,
          options: formData.options.reduce((acc, option, index) => {
            acc[String.fromCharCode(65 + index)] = option;
            return acc;
          }, {}),
          answer: String.fromCharCode(65 + formData.answer),
          explanation: formData.explanation,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update MCQ");
      }

      const updatedMCQ = await response.json();
      updateMCQ(mcq.id, updatedMCQ);
      onClose();
    } catch (error: any) {
      alert(`Error updating MCQ: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Edit MCQ</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Question
            </label>
            <textarea
              value={formData.question}
              onChange={(e) =>
                setFormData({ ...formData, question: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Options
            </label>
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="answer"
                    checked={formData.answer === index}
                    onChange={() => setFormData({ ...formData, answer: index })}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder={`Option ${index + 1}`}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Difficulty
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) =>
                  setFormData({ ...formData, difficulty: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Explanation (Optional)
            </label>
            <textarea
              value={formData.explanation}
              onChange={(e) =>
                setFormData({ ...formData, explanation: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              placeholder="Explain the correct answer..."
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Save size={20} />
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
