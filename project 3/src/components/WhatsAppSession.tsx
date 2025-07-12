import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

const WhatsAppSession: React.FC = () => {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [lastConnected, setLastConnected] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [showQr, setShowQr] = useState(false);

  // Fetch session info from backend
  const fetchSession = async () => {
    setStatus('connecting');
    try {
      const res = await fetch('/api/whatsapp-session');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setPhoneNumber(data.phoneNumber || '');
        setLastConnected(data.lastConnected || '');
        setQrCode(data.qrCode || '');
        setShowQr(!!data.qrCode);
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async () => {
    await fetch('/api/whatsapp-session/disconnect', { method: 'POST' });
    fetchSession();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">WhatsApp Session</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-800 rounded-xl p-6 flex flex-col gap-4 border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-white">Connection Status</span>
            {status === 'connected' ? (
              <CheckCircle className="text-emerald-500" size={28} />
            ) : status === 'connecting' ? (
              <span className="text-yellow-400 font-bold">Connecting...</span>
            ) : (
              <XCircle className="text-red-500" size={28} />
            )}
          </div>
          <div className="flex flex-col gap-2 text-slate-300">
            <div className="flex justify-between">
              <span>Status</span>
              <span className={status === 'connected' ? 'text-emerald-400' : 'text-red-400'}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Phone Number</span>
              <span>{phoneNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Connected</span>
              <span>{lastConnected || '-'}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
              onClick={handleDisconnect}
              disabled={status !== 'connected'}
            >
              Disconnect
            </button>
            <button
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-semibold"
              onClick={fetchSession}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-700">
          {showQr && qrCode ? (
            <>
              <img src={qrCode} alt="QR Code" className="w-48 h-48 mb-4 border-2 border-emerald-500 rounded-lg" />
              <div className="text-slate-300 text-center mb-2">Scan this QR code with WhatsApp to connect.</div>
            </>
          ) : status === 'connected' ? (
            <div className="flex flex-col items-center justify-center h-full">
              <CheckCircle className="text-emerald-500 mb-2" size={48} />
              <div className="text-lg text-emerald-400 font-bold mb-2">WhatsApp Connected</div>
              <div className="text-slate-300 text-center">Your WhatsApp is successfully connected and ready to send messages.</div>
            </div>
          ) : (
            <div className="text-slate-400 text-center">Waiting for QR code...</div>
          )}
        </div>
      </div>
      <div className="mt-10 bg-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">How to Connect</h2>
        <ol className="list-decimal ml-6 text-slate-300 space-y-1">
          <li>Open WhatsApp on your phone and go to <b>Settings</b>.</li>
          <li>Tap on <b>Linked Devices</b> and then <b>Link a Device</b>.</li>
          <li>Scan the QR code above.</li>
          <li>Once connected, you can start sending messages from this dashboard.</li>
        </ol>
      </div>
    </div>
  );
};

export default WhatsAppSession;
