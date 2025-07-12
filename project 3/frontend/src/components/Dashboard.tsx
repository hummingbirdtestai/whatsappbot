import React from 'react';
import { useMCQContext } from '../context/MCQContext';
import { FileText, Calendar, Clock, CheckCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { mcqs, mockTests } = useMCQContext();

  const stats = [
    {
      title: 'Total MCQs',
      value: mcqs.length,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Mock Tests',
      value: mockTests.filter(test => test.status === 'scheduled').length,
      icon: Calendar,
      color: 'bg-emerald-500',
    },
    {
      title: 'Completed Tests',
      value: mockTests.filter(test => test.status === 'completed').length,
      icon: CheckCircle,
      color: 'bg-purple-500',
    },
    {
      title: 'Running Tests',
      value: mockTests.filter(test => test.status === 'running').length,
      icon: Clock,
      color: 'bg-orange-500',
    },
  ];

  const recentMockTests = mockTests.slice(-5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <div className="text-sm text-slate-400">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Mock Tests</h3>
          <div className="space-y-3">
            {recentMockTests.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No mock tests created yet</p>
            ) : (
              recentMockTests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{test.name}</p>
                    <p className="text-slate-400 text-sm">{test.mcqCount} MCQs</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      test.status === 'scheduled' ? 'bg-emerald-500 text-white' :
                      test.status === 'running' ? 'bg-orange-500 text-white' :
                      'bg-purple-500 text-white'
                    }`}>
                      {test.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};