import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { UploadMCQ } from "./components/UploadMCQ";
import { MCQList } from "./components/MCQList";
import { SelectMCQ } from "./components/SelectMCQ";
import { MockTests } from "./components/MockTests";
import { WhatsAppGroups } from "./components/WhatsAppGroups";
import WhatsAppSession from "./components/WhatsAppSession";
import { MCQProvider } from "./context/MCQContext";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <MCQProvider>
      <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />

        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? "ml-64" : "ml-16"
          } overflow-hidden`}
        >
          <div className="h-full overflow-y-auto">
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "upload" && <UploadMCQ />}
            {activeTab === "mcqs" && <MCQList />}
            {activeTab === "select" && (
              <SelectMCQ setActiveTab={setActiveTab} />
            )}
            {activeTab === "tests" && <MockTests />}
            {activeTab === "whatsapp-groups" && <WhatsAppGroups />}
            {activeTab === "whatsapp-session" && <WhatsAppSession />}
          </div>
        </main>
      </div>
    </MCQProvider>
  );
}

export default App;
