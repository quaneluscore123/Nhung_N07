import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { notifications, removeNotification } = useSocket();

  if (notifications.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'info': return <Info className="w-5 h-5 text-blue-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBgClass = (type) => {
    switch (type) {
      case 'success': return 'border-emerald-500/30 bg-emerald-500/10';
      case 'error': return 'border-red-500/30 bg-red-500/10';
      case 'info': return 'border-blue-500/30 bg-blue-500/10';
      default: return 'border-slate-500/30 bg-slate-500/10';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-lg shadow-2xl animate-slide-in ${getBgClass(notif.type)}`}
        >
          {getIcon(notif.type)}
          <p className="text-sm text-white flex-1">{notif.message}</p>
          <button
            onClick={() => removeNotification(notif.id)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
