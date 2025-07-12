import React, { useState, useEffect } from "react";
import { Search, Edit3, Trash2, Filter, Eye, FileText } from "lucide-react";
import { useMCQContext } from "../context/MCQContext";
import { EditMCQModal } from "./EditMCQModal";

export const MCQList: React.FC = () => {
  const { mcqs, deleteMCQ } = useMCQContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingMCQ, setEditingMCQ] = useState<any>(null);
  const [viewingMCQ, setViewingMCQ] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const categories = [
    "all",
    ...Array.from(new Set(mcqs.map((m) => m.category))),
  ];

  const filteredMCQs = mcqs.filter((mcq) => {
    const q = (mcq.question ?? "").toLowerCase();
    const c = (mcq.category ?? "").toLowerCase();
    const search = searchTerm.toLowerCase();
    return (
      (q.includes(search) || c.includes(search)) &&
      (selectedCategory === "all" || mcq.category === selectedCategory)
    );
  });

  const totalPages = Math.ceil(filteredMCQs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMCQs = filteredMCQs.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  useEffect(() => setCurrentPage(1), [searchTerm, selectedCategory]);

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header & Filters */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">MCQ Library</h1>
          <div className="text-sm text-slate-400">
            {filteredMCQs.length} of {mcqs.length} MCQs • Page {currentPage} of{" "}
            {totalPages}
          </div>
        </div>

        {/* Search & Category */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search MCQs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              size={20}
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {categories.map((cat, idx) => (
                <option key={cat + idx} value={cat}>
                  {cat === "all" ? "All Categories" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Question
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Upload Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {paginatedMCQs.map((mcq) => (
                  <tr key={mcq.id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium line-clamp-2">
                        {mcq.question}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-emerald-600 text-white text-xs rounded-full">
                        {mcq.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          mcq.difficulty === "Easy"
                            ? "bg-green-600 text-white"
                            : mcq.difficulty === "Medium"
                            ? "bg-yellow-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {mcq.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">
                      {new Date(mcq.uploadDate!).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setViewingMCQ({
                              ...mcq,
                              options: Array.isArray(mcq.options)
                                ? mcq.options
                                : Object.values(mcq.options),
                              correctAnswer: Array.isArray(mcq.options)
                                ? mcq.correctAnswer
                                : Object.keys(mcq.options).indexOf(
                                    mcq.answer || mcq.correctAnswer || ""
                                  ),
                            })
                          }
                          className="p-1 text-slate-400 hover:text-blue-400"
                          title="View MCQ"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setEditingMCQ({
                              ...mcq,
                              options: Array.isArray(mcq.options)
                                ? mcq.options
                                : Object.values(mcq.options),
                              correctAnswer: Array.isArray(mcq.options)
                                ? mcq.correctAnswer
                                : Object.keys(mcq.options).indexOf(
                                    mcq.answer || mcq.correctAnswer || ""
                                  ),
                            })
                          }
                          className="p-1 text-slate-400 hover:text-emerald-400"
                          title="Edit MCQ"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => deleteMCQ(mcq.id)}
                          className="p-1 text-slate-400 hover:text-red-400"
                          title="Delete MCQ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 bg-slate-700">
              <div className="text-sm text-slate-400">
                Showing {startIndex + 1} to{" "}
                {Math.min(startIndex + itemsPerPage, filteredMCQs.length)} of{" "}
                {filteredMCQs.length} MCQs
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-slate-600 text-white rounded disabled:opacity-50 hover:bg-slate-500"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-slate-600 text-white rounded disabled:opacity-50 hover:bg-slate-500"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum =
                      currentPage <= 3
                        ? i + 1
                        : currentPage >= totalPages - 2
                        ? totalPages - 4 + i
                        : currentPage - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === pageNum
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-600 text-white hover:bg-slate-500"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-slate-600 text-white rounded disabled:opacity-50 hover:bg-slate-500"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-slate-600 text-white rounded disabled:opacity-50 hover:bg-slate-500"
                >
                  Last
                </button>
                <div className="text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            </div>
          )}

          {filteredMCQs.length === 0 && mcqs.length > 0 && (
            <div className="text-center py-8 text-slate-400">
              No MCQs match your current filters
            </div>
          )}

          {mcqs.length === 0 && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-400 text-lg">No MCQs uploaded yet</p>
              <p className="text-slate-500 text-sm">
                Upload your first MCQ file to get started
              </p>
            </div>
          )}
        </div>

        {/* Modals */}
        {editingMCQ && (
          <EditMCQModal mcq={editingMCQ} onClose={() => setEditingMCQ(null)} />
        )}

        {viewingMCQ && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">View MCQ</h3>
                <button
                  onClick={() => setViewingMCQ(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">
                    Question:
                  </h4>
                  <p className="text-slate-300">{viewingMCQ.question}</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">
                    Options:
                  </h4>
                  <div className="space-y-2">
                    {viewingMCQ.options.map((opt: string, i: number) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg ${
                          viewingMCQ.correctAnswer === i
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
                {viewingMCQ.explanation && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      Explanation:
                    </h4>
                    <p className="text-slate-300">{viewingMCQ.explanation}</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-sm">
                    {viewingMCQ.category}
                  </span>
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      viewingMCQ.difficulty === "Easy"
                        ? "bg-green-600 text-white"
                        : viewingMCQ.difficulty === "Medium"
                        ? "bg-yellow-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {viewingMCQ.difficulty}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
