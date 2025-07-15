import React, { useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useMCQContext } from "../context/MCQContext";

const SAMPLE_JSON = `[
  {
    "question": "What is the capital of France?",
    "options": {
      "A": "London",
      "B": "Berlin",
      "C": "Paris",
      "D": "Madrid"
    },
    "answer": "C",
    "explanation": "Paris is the capital and largest city of France."
  }
]`;

const OPTION_LABELS = ["A", "B", "C", "D"];

export const UploadMCQ: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const { addMCQs } = useMCQContext();
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setErrorMessage("Please upload a JSON file");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setErrorMessage("");

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error("JSON must contain an array of MCQs");
      }

      const validatedMCQs = data.map((mcq, index) => {
        if (!mcq.question || !mcq.options || !mcq.answer) {
          throw new Error(`MCQ at index ${index} is missing required fields`);
        }
        return {
          id: Date.now() + index,
          question: mcq.question,
          options: mcq.options,
          answer: mcq.answer,
          category: mcq.category || "General",
          difficulty: mcq.difficulty || "Medium",
          explanation: mcq.explanation || "",
          uploadDate: new Date().toISOString(),
        };
      });

      setPreviewData(validatedMCQs);
      setUploadStatus("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to parse JSON"
      );
      setUploadStatus("error");
    }
  };

  const confirmUpload = () => {
    addMCQs(previewData);
    setPreviewData([]);
    setUploadStatus("idle");
  };

  // Validate MCQ JSON (options as object, answer as label)
  const validateMCQs = (data: any): { valid: boolean; error?: string } => {
    if (!Array.isArray(data))
      return { valid: false, error: "JSON must be an array." };
    for (const [i, mcq] of data.entries()) {
      if (
        !mcq.question ||
        typeof mcq.options !== "object" ||
        typeof mcq.answer !== "string"
      ) {
        return {
          valid: false,
          error: `MCQ at index ${i} missing required fields or wrong types.`,
        };
      }
      const optionKeys = Object.keys(mcq.options);
      if (
        optionKeys.length < 2 ||
        !optionKeys.every((k) => OPTION_LABELS.includes(k))
      ) {
        return {
          valid: false,
          error: `MCQ at index ${i} must have options labeled A, B, C, D (at least 2).`,
        };
      }
      if (!OPTION_LABELS.includes(mcq.answer) || !mcq.options[mcq.answer]) {
        return {
          valid: false,
          error: `MCQ at index ${i} has invalid answer label.`,
        };
      }
    }
    return { valid: true };
  };

  // Handle textarea upload
  const handleUpload = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    let mcqs;
    try {
      mcqs = JSON.parse(jsonText);
    } catch (e) {
      setErrorMsg("Invalid JSON.");
      return;
    }
    const validation = validateMCQs(mcqs);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Invalid MCQ format.");
      return;
    }
    setUploading(true);
    setProgress(0);
    let uploaded = 0;
    for (let i = 0; i < mcqs.length; i++) {
      const mcq = mcqs[i];
      // Prepare payload for backend (options as object, answer as label)
      const payload = {
        question: mcq.question,
        options: mcq.options,
        answer: mcq.answer, // Map answer to answer
        explanation: mcq.explanation,
      };
      try {
        await fetch("/api/mcqs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        uploaded++;
        setProgress(Math.round((uploaded / mcqs.length) * 100));
      } catch (e) {
        setErrorMsg(`Error uploading MCQ at index ${i}`);
        setUploading(false);
        return;
      }
    }
    setUploading(false);
    setSuccessMsg(`Successfully uploaded ${uploaded} MCQ(s).`);
    setJsonText("");
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    setSuccessMsg("");
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full h-full">
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="text-2xl font-bold mb-2">Upload MCQs</h2>
        <textarea
          className="w-full h-64 p-4 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Paste your MCQ JSON here..."
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          disabled={uploading}
        />
        <div className="flex items-center gap-4">
          <label className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded cursor-pointer">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            Select File
          </label>
          {fileName && (
            <span className="text-sm text-gray-400">{fileName}</span>
          )}
        </div>
        <button
          className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-lg font-semibold disabled:opacity-50"
          onClick={handleUpload}
          disabled={uploading || !jsonText.trim()}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {uploading && (
          <div className="w-full bg-gray-700 rounded h-4 mt-4">
            <div
              className="bg-green-500 h-4 rounded"
              style={{ width: `${progress}%`, transition: "width 0.2s" }}
            />
          </div>
        )}
        {successMsg && (
          <div className="mt-4 text-green-400 font-semibold">{successMsg}</div>
        )}
        {errorMsg && (
          <div className="mt-4 text-red-400 font-semibold">{errorMsg}</div>
        )}
      </div>
      <div className="md:w-1/2 w-full bg-gray-900 rounded p-4 mt-8 md:mt-0">
        <h3 className="text-lg font-bold mb-2 text-green-400">
          JSON Format Example
        </h3>
        <pre className="bg-gray-800 text-gray-200 p-4 rounded overflow-x-auto text-sm">
          {SAMPLE_JSON}
        </pre>
        <div className="mt-2 text-gray-400 text-xs">
          <div>
            <b>Required fields:</b> question, options (A-D), answer (A-D)
          </div>
          <div>
            <b>Optional fields:</b> explanation
          </div>
          <div>
            <b>answer:</b> Must be one of 'A', 'B', 'C', 'D'
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadMCQ;
