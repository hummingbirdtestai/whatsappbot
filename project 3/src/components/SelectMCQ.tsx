import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, Clock, Send, CheckSquare } from 'lucide-react';
import { useMCQContext } from '../context/MCQContext';
import Select from 'react-select';
import { StylesConfig, CSSObjectWithLabel, GroupBase } from 'react-select';

interface SelectMCQProps {
  setActiveTab?: (tab: string) => void;
}

export const SelectMCQ: React.FC<SelectMCQProps> = ({ setActiveTab }) => {
  const { mcqs, createMockTest } = useMCQContext();
  const [selectedMCQs, setSelectedMCQs] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [testName, setTestName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Show 10 per page for better demonstration
  const [whatsappGroups, setWhatsappGroups] = useState<{ jid: string; name: string }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/whatsapp-groups')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setWhatsappGroups(data);
      });
  }, []);

  const categories = ['all', ...new Set(mcqs.map(mcq => mcq.category))];

  const filteredMCQs = mcqs.filter(mcq => {
    const matchesSearch = mcq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mcq.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || mcq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredMCQs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMCQs = filteredMCQs.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const handleSelectMCQ = (mcqId: number) => {
    if (selectedMCQs.includes(mcqId)) {
      setSelectedMCQs(selectedMCQs.filter(id => id !== mcqId));
    } else if (selectedMCQs.length < 300) {
      setSelectedMCQs([...selectedMCQs, mcqId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedMCQs.length === paginatedMCQs.length) {
      setSelectedMCQs([]);
    } else {
      const newSelected = paginatedMCQs
        .filter(mcq => !selectedMCQs.includes(mcq.id))
        .slice(0, 300 - selectedMCQs.length)
        .map(mcq => mcq.id);
      setSelectedMCQs([...selectedMCQs, ...newSelected]);
    }
  };

  const handleCreateTest = () => {
    if (!testName || !startDate || !startTime || selectedMCQs.length === 0 || selectedGroups.length === 0) {
      alert('Please fill in all required fields, select at least one MCQ, and select at least one WhatsApp group.');
      return;
    }
    const scheduledDateTime = new Date(`${startDate}T${startTime}`);
    createMockTest({
      name: testName,
      mcqIds: selectedMCQs,
      scheduledDate: scheduledDateTime.toISOString(),
      intervalMinutes: 3,
      whatsappGroups: selectedGroups, // Pass selected group JIDs
    });
    // Reset form
    setTestName('');
    setStartDate('');
    setStartTime('');
    setSelectedMCQs([]);
    setSelectedGroups([]);
    alert('Mock test created successfully!');
    if (setActiveTab) setActiveTab('tests'); // Redirect to Mock Tests page
  };

  const customStyles: StylesConfig<any, true, GroupBase<any>> = {
    control: (provided: CSSObjectWithLabel, state) => ({
      ...provided,
      backgroundColor: '#1e293b', // Tailwind bg-slate-800
      color: '#fff',
      borderColor: state.isFocused ? '#10b981' : '#334155', // emerald-500 or slate-700
      boxShadow: state.isFocused ? '0 0 0 1px #10b981' : provided.boxShadow,
      '&:hover': {
        borderColor: '#10b981',
      },
    }),
    menu: (provided: CSSObjectWithLabel) => ({
      ...provided,
      backgroundColor: '#1e293b',
      color: '#fff',
    }),
    option: (provided: CSSObjectWithLabel, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? '#10b981'
        : state.isFocused
        ? '#334155'
        : '#1e293b',
      color: '#fff',
      '&:active': {
        backgroundColor: '#10b981',
      },
    }),
    multiValue: (provided: CSSObjectWithLabel) => ({
      ...provided,
      backgroundColor: '#334155',
      color: '#fff',
    }),
    multiValueLabel: (provided: CSSObjectWithLabel) => ({
      ...provided,
      color: '#fff',
    }),
    multiValueRemove: (provided: CSSObjectWithLabel) => ({
      ...provided,
      color: '#fff',
      backgroundColor: '#334155',
      ':hover': {
        backgroundColor: '#10b981',
        color: '#fff',
      },
    }),
    input: (provided: CSSObjectWithLabel) => ({
      ...provided,
      color: '#fff',
    }),
    singleValue: (provided: CSSObjectWithLabel) => ({
      ...provided,
      color: '#fff',
    }),
    placeholder: (provided: CSSObjectWithLabel) => ({
      ...provided,
      color: '#94a3b8', // slate-400
    }),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Create WhatsApp Quiz Session</h1>
          <p className="text-slate-400 mt-1">
            Select up to 300 MCQs to publish to WhatsApp Bot every 3 minutes
            {mcqs.length > 100 && (
              <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                {mcqs.length.toLocaleString()} MCQs available
              </span>
            )}
          </p>
        </div>
        <div className="text-sm text-slate-400">
          <div className="text-right">
            <div className="text-lg font-semibold text-emerald-400">
              {selectedMCQs.length}/300 MCQs selected
            </div>
            <div className="text-sm">
              Page {currentPage} of {totalPages} • {filteredMCQs.length.toLocaleString()} total
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search MCQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare size={20} className="text-emerald-400" />
                  <span className="text-white font-medium">Select MCQs for WhatsApp Bot</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={paginatedMCQs.length > 0 && paginatedMCQs.every(mcq => selectedMCQs.includes(mcq.id))}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                />
                <span className="text-white font-medium">Select All on Page</span>
                <span className="text-slate-400 text-sm">
                  ({filteredMCQs.length} MCQs available • {Math.min(itemsPerPage, paginatedMCQs.length)} on this page)
                </span>
              </div>
            </div>
            
            <div className="divide-y divide-slate-700">
              {paginatedMCQs.map((mcq) => (
                <div
                  key={mcq.id}
                  className={`p-4 hover:bg-slate-700/50 cursor-pointer ${
                    selectedMCQs.includes(mcq.id) ? 'bg-emerald-600/10' : ''
                  }`}
                  onClick={() => handleSelectMCQ(mcq.id)}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedMCQs.includes(mcq.id)}
                      onChange={() => handleSelectMCQ(mcq.id)}
                      className="w-4 h-4 mt-1 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium line-clamp-2 mb-2">
                        {mcq.question}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-600 text-white text-xs rounded-full">
                          {mcq.category}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          mcq.difficulty === 'Easy' ? 'bg-green-600 text-white' :
                          mcq.difficulty === 'Medium' ? 'bg-yellow-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                          {mcq.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 bg-slate-700 border-t border-slate-600">
                <div className="text-sm text-slate-400">
                  <div>Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredMCQs.length)} of {filteredMCQs.length.toLocaleString()} MCQs</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {selectedMCQs.length} selected across all pages
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {/* Quick Jump for Large Collections */}
                  {totalPages > 5 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Go to Page:</span>
                      <select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        className="px-3 py-2 text-sm bg-slate-600 text-white rounded-lg border-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[100px]"
                      >
                        {Array.from({ length: totalPages }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-500"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-500"
                    >
                      Previous
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 text-sm rounded font-medium ${
                            currentPage === pageNum
                              ? 'bg-emerald-600 text-white shadow-lg'
                              : 'bg-slate-600 text-white hover:bg-slate-500'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="text-slate-400 px-2">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-3 py-2 text-sm rounded bg-slate-600 text-white hover:bg-slate-500"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-500"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-500"
                    >
                      Last
                    </button>
                  </div>
                  
                  <div className="text-sm text-slate-400">
                    <div>Page {currentPage} of {totalPages.toLocaleString()}</div>
                    {totalPages > 50 && (
                      <div className="text-xs text-slate-500">
                        {Math.ceil(filteredMCQs.length / 300)} pages needed for 300 MCQs
                      </div>
                    )}
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
                <CheckSquare size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-400 text-lg">No MCQs available</p>
                <p className="text-slate-500 text-sm">Upload MCQs first to create mock tests</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Test Configuration</h2>
          {/* WhatsApp Groups Multi-Select */}
          <div className="mb-4">
            <label className="block text-slate-300 mb-2 font-medium">Select WhatsApp Groups <span className="text-red-400">*</span></label>
            <Select
              isMulti
              options={whatsappGroups.map(group => ({
                value: group.jid,
                label: group.name ? `${group.name} (${group.jid})` : group.jid
              }))}
              value={whatsappGroups.filter(group => selectedGroups.includes(group.jid)).map(group => ({
                value: group.jid,
                label: group.name ? `${group.name} (${group.jid})` : group.jid
              }))}
              onChange={selected => setSelectedGroups(selected.map(opt => opt.value))}
              className="text-white"
              placeholder="Select WhatsApp Groups..."
              required
              styles={customStyles}
            />
            <div className="text-xs text-slate-400 mt-1">You can select multiple groups.</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Test Name
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter test name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Start Time
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-white mb-2">Test Details</h4>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>MCQs Selected:</span>
                <span className="text-emerald-400">{selectedMCQs.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Interval:</span>
                <span>3 minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Total Duration:</span>
                <span>{Math.ceil(selectedMCQs.length * 3 / 60)} hours</span>
              </div>
              <div className="flex justify-between">
                <span>Current Page:</span>
                <span>{currentPage} of {totalPages.toLocaleString()}</span>
              </div>
              {totalPages > 10 && (
              <div className="flex justify-between">
                <span>Total MCQs:</span>
                <span>{filteredMCQs.length.toLocaleString()}</span>
              </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCreateTest}
            disabled={selectedMCQs.length === 0 || !testName || !startDate || !startTime || selectedGroups.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
            Create Mock Test
          </button>
          
          {selectedMCQs.length > 0 && (
            <div className="text-center">
              <button
                onClick={() => setSelectedMCQs([])}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Clear Selection ({selectedMCQs.length})
              </button>
            </div>
          )}
        </div>
      </div>
      
      {selectedMCQs.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Selected MCQs ({selectedMCQs.length})</h3>
            <button
              onClick={() => setSelectedMCQs([])}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
            {selectedMCQs.slice(0, 12).map((mcqId) => {
              const mcq = mcqs.find(m => m.id === mcqId);
              return mcq ? (
                <div key={mcqId} className="bg-slate-700 rounded-lg p-3">
                  <p className="text-white text-sm line-clamp-2 mb-2">{mcq.question}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400">{mcq.category}</span>
                    <button
                      onClick={() => handleSelectMCQ(mcqId)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null;
            })}
            {selectedMCQs.length > 12 && (
              <div className="bg-slate-700 rounded-lg p-3 flex items-center justify-center">
                <span className="text-slate-400 text-sm">
                  +{selectedMCQs.length - 12} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};