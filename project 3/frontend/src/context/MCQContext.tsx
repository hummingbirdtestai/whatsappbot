import React, { createContext, useContext, useState, useEffect } from "react";

interface MCQ {
  id: string; // UUID from backend
  question: string;
  options: any; // backend returns object, not array
  answer?: string; // backend uses 'answer' not 'answer'
  answer?: string; // for compatibility
  category?: string;
  difficulty?: string;
  explanation?: string;
  uploadDate?: string;
}

interface MockTest {
  id: string;
  name: string;
  mcqIds: string[];
  mcqCount: number;
  scheduledDate: string;
  intervalMinutes: number;
  status: "scheduled" | "running" | "paused" | "completed";
  currentMCQ?: number;
  createdAt: string;
  whatsappGroups?: string[];
}

interface MCQContextType {
  mcqs: MCQ[];
  mockTests: MockTest[];
  addMCQs: (mcqs: Omit<MCQ, "id" | "uploadDate">[]) => void;
  updateMCQ: (id: string, updates: Partial<MCQ>) => void;
  deleteMCQ: (id: string) => void;
  createMockTest: (
    test: Omit<MockTest, "id" | "mcqCount" | "status" | "createdAt"> & {
      whatsappGroups?: string[];
    }
  ) => void;
  updateMockTestStatus: (id: string, status: string) => void;
  deleteMockTest: (id: string) => void;
  updateMockTest: (id: string, updates: Partial<MockTest>) => void;
}

const MCQContext = createContext<MCQContextType | undefined>(undefined);

export const useMCQContext = () => {
  const context = useContext(MCQContext);
  if (!context) {
    throw new Error("useMCQContext must be used within an MCQProvider");
  }
  return context;
};

export const MCQProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Sample MCQs for demonstration
  const sampleMCQs: MCQ[] = [
    {
      id: "1",
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      answer: "Paris",
      category: "Geography",
      difficulty: "Easy",
      explanation:
        "Paris is the capital and largest city of France, located in the north-central part of the country.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "2",
      question:
        "Which programming language is known for its use in artificial intelligence and machine learning?",
      options: ["Java", "Python", "C++", "JavaScript"],
      answer: "Python",
      category: "Technology",
      difficulty: "Medium",
      explanation:
        "Python is widely used in AI and ML due to its extensive libraries like TensorFlow, PyTorch, and scikit-learn.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "3",
      question: "What is the chemical symbol for gold?",
      options: ["Go", "Gd", "Au", "Ag"],
      answer: "Au",
      category: "Science",
      difficulty: "Medium",
      explanation:
        "Au comes from the Latin word 'aurum' meaning gold. Silver is Ag (argentum).",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "4",
      question: "In which year did World War II end?",
      options: ["1944", "1945", "1946", "1947"],
      answer: "1945",
      category: "History",
      difficulty: "Easy",
      explanation:
        "World War II ended in 1945 with Germany's surrender in May and Japan's surrender in September.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "5",
      question: "What is the time complexity of binary search algorithm?",
      options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      answer: "O(log n)",
      category: "Computer Science",
      difficulty: "Hard",
      explanation:
        "Binary search has O(log n) time complexity because it eliminates half of the search space in each iteration.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "6",
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      answer: "Mars",
      category: "Science",
      difficulty: "Easy",
      explanation:
        "Mars is called the Red Planet due to iron oxide (rust) on its surface giving it a reddish appearance.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "7",
      question: "What does HTML stand for?",
      options: [
        "Hyper Text Markup Language",
        "High Tech Modern Language",
        "Home Tool Markup Language",
        "Hyperlink and Text Markup Language",
      ],
      answer: "Hyper Text Markup Language",
      category: "Technology",
      difficulty: "Easy",
      explanation:
        "HTML stands for HyperText Markup Language, the standard markup language for creating web pages.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "8",
      question: "Who painted the Mona Lisa?",
      options: [
        "Vincent van Gogh",
        "Pablo Picasso",
        "Leonardo da Vinci",
        "Michelangelo",
      ],
      answer: "Leonardo da Vinci",
      category: "Art",
      difficulty: "Medium",
      explanation:
        "The Mona Lisa was painted by Leonardo da Vinci between 1503 and 1519, and is housed in the Louvre Museum.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "9",
      question: "What is the largest ocean on Earth?",
      options: [
        "Atlantic Ocean",
        "Indian Ocean",
        "Arctic Ocean",
        "Pacific Ocean",
      ],
      answer: "Pacific Ocean",
      category: "Geography",
      difficulty: "Easy",
      explanation:
        "The Pacific Ocean is the largest ocean, covering about 46% of the world's water surface.",
      uploadDate: new Date().toISOString(),
    },
    {
      id: "10",
      question:
        "Which data structure uses LIFO (Last In, First Out) principle?",
      options: ["Queue", "Stack", "Array", "Linked List"],
      answer: "Stack",
      category: "Computer Science",
      difficulty: "Medium",
      explanation:
        "A stack follows the LIFO principle where the last element added is the first one to be removed.",
      uploadDate: new Date().toISOString(),
    },
  ];

  const [mcqs, setMCQs] = useState<MCQ[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);

  // Load MCQs from backend on mount
  useEffect(() => {
    async function fetchMCQs() {
      try {
        const res = await fetch("/api/mcqs");
        if (res.ok) {
          const data = await res.json();
          setMCQs(data);
        } else {
          setMCQs([]); // fallback to empty if error
        }
      } catch {
        setMCQs([]);
      }
    }
    fetchMCQs();
    // Optionally, load mockTests from backend as well
    async function fetchMockTests() {
      try {
        const res = await fetch("/api/mock-tests");
        if (res.ok) {
          let data = await res.json();
          data = data.map((t: any) => ({
            ...t,
            scheduledDate: t.scheduled_at,
            intervalMinutes: t.interval_minutes,
            whatsappGroups: t.whatsapp_groups,
            createdAt: t.created_at,
            mcqCount: t.mcq_count || 0,
          }));
          setMockTests(data);
        }
      } catch {}
    }
    fetchMockTests();
  }, []);

  // Remove localStorage logic for MCQs

  useEffect(() => {
    localStorage.setItem("mockTests", JSON.stringify(mockTests));
  }, [mockTests]);

  const addMCQs = (newMCQs: Omit<MCQ, "id" | "uploadDate">[]) => {
    const mcqsWithIds = newMCQs.map((mcq, index) => ({
      ...mcq,
      id: Date.now().toString() + index, // fallback for demo, real MCQs come from backend
      uploadDate: new Date().toISOString(),
    }));
    setMCQs((prev) => [...prev, ...mcqsWithIds]);
  };

  const updateMCQ = (id: string, updates: Partial<MCQ>) => {
    setMCQs((prev) =>
      prev.map((mcq) => (mcq.id === id ? { ...mcq, ...updates } : mcq))
    );
  };

  const deleteMCQ = async (id: string) => {
    try {
      const res = await fetch(`/api/mcqs/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete MCQ");
      setMCQs((prev) => prev.filter((mcq) => mcq.id !== id));
    } catch (err) {
      alert(
        "Error deleting MCQ: " + (err instanceof Error ? err.message : err)
      );
    }
  };

  const createMockTest = async (
    test: Omit<MockTest, "id" | "mcqCount" | "status" | "createdAt"> & {
      whatsappGroups?: string[];
    }
  ) => {
    try {
      // 1. Create quiz funnel
      const funnelRes = await fetch("/api/quiz-funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: test.name,
          scheduled_at: test.scheduledDate,
          mcq_ids: test.mcqIds,
        }),
      });
      if (!funnelRes.ok) throw new Error("Failed to create quiz funnel");
      const funnel = await funnelRes.json();
      // 2. Create mock test
      const mockTestRes = await fetch("/api/mock-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_funnel_id: funnel.id,
          whatsapp_groups: test.whatsappGroups,
          interval_minutes: test.intervalMinutes,
          status: "active", // changed from 'scheduled' to 'active'
        }),
      });
      if (!mockTestRes.ok) throw new Error("Failed to create mock test");
      // 3. Reload mock tests from backend
      const allTestsRes = await fetch("/api/mock-tests");
      let allTests = allTestsRes.ok ? await allTestsRes.json() : [];
      // Map backend fields to frontend camelCase
      allTests = allTests.map((t: any) => ({
        ...t,
        scheduledDate: t.scheduled_at,
        intervalMinutes: t.interval_minutes,
        whatsappGroups: t.whatsapp_groups,
        createdAt: t.created_at,
        mcqCount: t.mcq_count || 0,
      }));
      setMockTests(allTests);
    } catch (err) {
      alert(
        "Error creating mock test: " +
          (err instanceof Error ? err.message : err)
      );
    }
  };

  const updateMockTestStatus = (id: string, status: string) => {
    setMockTests((prev) =>
      prev.map((test) =>
        test.id === id
          ? { ...test, status: status as MockTest["status"] }
          : test
      )
    );
  };

  const deleteMockTest = (id: string) => {
    setMockTests((prev) => prev.filter((test) => test.id !== id));
  };

  const updateMockTest = (id: string, updates: Partial<MockTest>) => {
    setMockTests((prev) =>
      prev.map((test) => (test.id === id ? { ...test, ...updates } : test))
    );
  };

  return (
    <MCQContext.Provider
      value={{
        mcqs,
        mockTests,
        addMCQs,
        updateMCQ,
        deleteMCQ,
        createMockTest,
        updateMockTestStatus,
        deleteMockTest,
        updateMockTest, // add to context
      }}
    >
      {children}
    </MCQContext.Provider>
  );
};
