import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw, Clock } from 'lucide-react';
import { api } from '../../services/api.ts';
import { AuditLog } from '../../types/index.ts';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      !searchTerm ||
      (l as any).user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l as any).entity_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Security Audit Logs & Compliance Trail</h2>
          <p className="text-xs text-slate-400 mt-0.5">Immutable record of financial transactions, price updates, GST revisions, and user actions</p>
        </div>
        <button
          onClick={loadLogs}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit trail by User Name, Action, or Record Type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-3 py-3">User & Role</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Entity</th>
              <th className="px-4 py-3">Details / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-slate-900/40">
                <td className="px-4 py-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-3 py-3">
                  <span className="font-semibold text-white">{(log as any).user_name}</span>
                  <span className="text-[10px] text-slate-500 block font-sans">({(log as any).user_role})</span>
                </td>
                <td className="px-3 py-3">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-bold">
                    {log.action}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {(log as any).entity_type} <span className="text-slate-500">#{(log as any).entity_id?.slice(0, 8)}</span>
                </td>
                <td className="px-4 py-3 text-slate-300 font-sans max-w-xs truncate">
                  {log.reason || (log as any).new_value || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
