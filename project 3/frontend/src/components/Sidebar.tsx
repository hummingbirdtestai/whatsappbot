import React from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  FileText, 
  CheckSquare, 
  Calendar,
  Menu,
  X,
  Users
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isOpen, 
  setIsOpen 
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload MCQs', icon: Upload },
    { id: 'mcqs', label: 'MCQ Library', icon: FileText },
    { id: 'select', label: 'WhatsApp Quiz Setup', icon: CheckSquare },
    { id: 'tests', label: 'Mock Tests', icon: Calendar },
    { id: 'whatsapp-groups', label: 'WhatsApp Groups', icon: Users },
    { id: 'whatsapp-session', label: 'WhatsApp Session', icon: CheckSquare },
  ];

  return (
    <div className={`fixed left-0 top-0 h-full bg-slate-800 transition-all duration-300 z-50 ${
      isOpen ? 'w-64' : 'w-16'
    }`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {isOpen && (
          <h1 className="text-xl font-bold text-emerald-400">MCQ Dashboard</h1>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                activeTab === item.id
                  ? 'bg-emerald-600 text-white border-r-2 border-emerald-400'
                  : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Icon size={20} />
              {isOpen && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};