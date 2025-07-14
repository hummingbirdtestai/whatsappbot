import React, { useState } from "react";
import { Calendar, Clock, Play, Pause, Trash2, Eye } from "lucide-react";
import { useMCQContext } from "../context/MCQContext";
import Select from "react-select";

export const MockTests: React.FC = () => {
  const { mockTests, deleteMockTest, updateMockTestStatus, updateMockTest } =
    useMCQContext();
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editing, setEditing] = useState(false);
  const [whatsappGroups, setWhatsappGroups] = useState<
    { jid: string; name: string }[]
  >([]);

  React.useEffect(() => {
    fetch("/api/whatsapp-groups")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setWhatsappGroups(data);
      });
  }, []);

  const handleStatusChange = (testId: any, newStatus: string) => {
    updateMockTestStatus(String(testId), newStatus);
  };

  const handleDelete = (testId: any) => {
    if (window.confirm("Are you sure you want to delete this mock test?")) {
      deleteMockTest(String(testId));
    }
  };

  const handleEditDateTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDate || !editTime) return;
    const newDate = new Date(String(`${editDate}T${editTime}`));
    updateMockTest(String(selectedTest.id), {
      scheduledDate: String(newDate.toISOString()),
    });
    setSelectedTest({
      ...selectedTest,
      scheduledDate: String(newDate.toISOString()),
    });
    setEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500 text-white";
      case "running":
        return "bg-emerald-500 text-white";
      case "paused":
        return "bg-yellow-500 text-white";
      case "completed":
        return "bg-purple-500 text-white";
      default:
        return "bg-slate-500 text-white";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(String(dateString));
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Mock Tests</h1>
        <div className="text-sm text-slate-400">
          {mockTests.length} total tests
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockTests.map((test) => (
          <div
            key={test.id}
            className="bg-slate-800 rounded-xl p-6 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white truncate">
                {test.name}
              </h3>
              <span
                className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                  test.status
                )}`}
              >
                {test.status}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar size={16} />
                <span className="text-sm">
                  {formatDate(test.scheduledDate)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock size={16} />
                <span className="text-sm">
                  {Number(test.intervalMinutes)
                    ? Number(test.intervalMinutes) + " min intervals"
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">
                  MCQs:{" "}
                  {Number.isFinite(Number(test.mcqCount))
                    ? Number(test.mcqCount)
                    : "N/A"}
                </span>
                <span className="text-slate-300 text-sm">
                  Duration:{" "}
                  {Number.isFinite(Number(test.mcqCount)) &&
                  Number(test.intervalMinutes)
                    ? Math.ceil(
                        (Number(test.mcqCount) * Number(test.intervalMinutes)) /
                          60
                      ) + "h"
                    : "N/A"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Normalize the date field for the modal
                  setSelectedTest({
                    ...test,
                    scheduledDate:
                      test.scheduledDate || (test as any).scheduled_at || "",
                  });
                }}
                className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                title="View Details"
              >
                <Eye size={16} />
              </button>
              {test.status === "scheduled" && (
                <button
                  onClick={async () => {
                    // Call backend to start the test
                    await fetch(`/api/mock-tests/${test.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: "running",
                        started_at: new Date().toISOString(),
                      }),
                    });
                    // Optionally, reload tests or update state
                    handleStatusChange(test.id, "running");
                  }}
                  className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors ml-2 flex items-center justify-center border border-emerald-700 shadow"
                  title="Start Mock Test"
                  style={{ minWidth: 32, minHeight: 32 }}
                >
                  <Play size={18} />
                </button>
              )}

              {test.status === "running" && (
                <button
                  onClick={() => handleStatusChange(test.id, "paused")}
                  className="p-2 text-slate-400 hover:text-yellow-400 transition-colors"
                  title="Pause Test"
                >
                  <Pause size={16} />
                </button>
              )}

              {test.status === "paused" && (
                <button
                  onClick={() => handleStatusChange(test.id, "running")}
                  className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Resume Test"
                >
                  <Play size={16} />
                </button>
              )}

              <button
                onClick={() => handleDelete(test.id)}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Delete Test"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {test.status === "running" && (
              <div className="mt-4 bg-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Progress</span>
                  <span className="text-emerald-400">
                    {test.currentMCQ || 0}/{test.mcqCount}
                  </span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        ((test.currentMCQ || 0) / test.mcqCount) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {mockTests.length === 0 && (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-slate-400 mb-4" />
          <p className="text-slate-400 text-lg">No mock tests created yet</p>
          <p className="text-slate-500 text-sm">
            Create your first mock test to get started
          </p>
        </div>
      )}

      {selectedTest &&
        (() => {
          console.log("Selected Test Details:", selectedTest);
          return null;
        })()}
      {selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Test Details</h3>
              <button
                onClick={() => setSelectedTest(null)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-1">
                    Test Name
                  </h4>
                  <p className="text-white">{selectedTest.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-1">
                    Status
                  </h4>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                      selectedTest.status
                    )}`}
                  >
                    {selectedTest.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-1">
                    Scheduled Date
                  </h4>
                  {editing ? (
                    <form
                      onSubmit={handleEditDateTime}
                      className="flex gap-2 items-center"
                    >
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="px-2 py-1 rounded bg-slate-700 text-white border border-slate-600"
                        required
                      />
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="px-2 py-1 rounded bg-slate-700 text-white border border-slate-600"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="text-slate-400 hover:text-white px-2"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-white">
                        {formatDate(selectedTest.scheduledDate)}
                      </p>
                      <button
                        onClick={() => {
                          const dt = new Date(
                            String(selectedTest.scheduledDate)
                          );
                          setEditDate(
                            !isNaN(dt.getTime())
                              ? dt.toISOString().slice(0, 10)
                              : ""
                          );
                          setEditTime(
                            !isNaN(dt.getTime())
                              ? dt.toISOString().slice(11, 16)
                              : ""
                          );
                          setEditing(true);
                        }}
                        className="text-blue-400 hover:underline text-xs"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-1">
                    Interval
                  </h4>
                  <p className="text-white">
                    {selectedTest.intervalMinutes} minutes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-1">
                    Total MCQs
                  </h4>
                  <p className="text-white">{selectedTest.mcqCount}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-1">
                    Estimated Duration
                  </h4>
                  <p className="text-white">
                    {Math.ceil(
                      (selectedTest.mcqCount * selectedTest.intervalMinutes) /
                        60
                    )}{" "}
                    hours
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-1">
                  WhatsApp Groups
                </h4>
                {selectedTest.whatsapp_group_details &&
                selectedTest.whatsapp_group_details.length > 0 ? (
                  <ul className="list-disc ml-5 text-white">
                    {selectedTest.whatsapp_group_details.map(
                      (group: { jid: string; name: string }) => (
                        <li key={group.jid} className="mb-1">
                          {group.name
                            ? `${group.name} (${group.jid})`
                            : group.jid}
                        </li>
                      )
                    )}
                  </ul>
                ) : selectedTest.whatsappGroups &&
                  selectedTest.whatsappGroups.length > 0 ? (
                  <ul className="list-disc ml-5 text-white">
                    {selectedTest.whatsappGroups.map((jid: string) => {
                      const group = whatsappGroups.find((g) => g.jid === jid);
                      return (
                        <li key={jid} className="mb-1">
                          {group ? `${group.name} (${group.jid})` : jid}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span className="text-slate-400">No groups selected</span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">
                  Publishing Schedule
                </h4>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-slate-300 text-sm">
                    MCQs will be published to WhatsApp every{" "}
                    {selectedTest.intervalMinutes} minutes starting from{" "}
                    {formatDate(selectedTest.scheduledDate)}
                  </p>
                </div>
              </div>

              {selectedTest.status === "running" && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">
                    Current Progress
                  </h4>
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300">MCQs Published</span>
                      <span className="text-emerald-400">
                        {selectedTest.currentMCQ || 0}/{selectedTest.mcqCount}
                      </span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            ((selectedTest.currentMCQ || 0) /
                              selectedTest.mcqCount) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
