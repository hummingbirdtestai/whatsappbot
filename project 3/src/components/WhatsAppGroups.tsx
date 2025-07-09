import React, { useEffect, useState } from 'react';

interface WhatsAppGroup {
  id: string;
  jid: string;
  name?: string;
  created_at?: string;
}

export const WhatsAppGroups: React.FC = () => {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [jid, setJid] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp-groups');
      const data = await res.json();
      if (Array.isArray(data)) setGroups(data);
      else setError(data.error || 'Failed to fetch groups');
    } catch (err) {
      setError('Failed to fetch groups');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid, name }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setJid('');
        setName('');
        fetchGroups();
      }
    } catch (err) {
      setError('Failed to add group');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp-groups/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) setError(data.error);
      else fetchGroups();
    } catch (err) {
      setError('Failed to delete group');
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">WhatsApp Groups</h2>
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="WhatsApp Group JID"
          value={jid}
          onChange={e => setJid(e.target.value)}
          className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white flex-1"
          required
        />
        <input
          type="text"
          placeholder="Group Name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white flex-1"
        />
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          Add
        </button>
      </form>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="bg-slate-800 rounded shadow p-4">
        {loading ? (
          <div>Loading...</div>
        ) : groups.length === 0 ? (
          <div>No WhatsApp groups added yet.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-2">JID</th>
                <th className="py-2">Name</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.id} className="border-t border-slate-700">
                  <td className="py-2 font-mono">{group.jid}</td>
                  <td className="py-2">{group.name || '-'}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="text-red-400 hover:underline"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}; 