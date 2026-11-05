import React, { useState, useEffect } from 'react';
import { Coins, Monitor, User, Clock, ArrowRight, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.ts';
import { CashCounter, CashierSession } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const CashCounterView: React.FC = () => {
  const { currentUser } = useAuth();
  const [counters, setCounters] = useState<CashCounter[]>([]);
  const [activeSession, setActiveSession] = useState<CashierSession | null>(null);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedCounterId, setSelectedCounterId] = useState('cnt-1');
  const [openingFloat, setOpeningFloat] = useState<number>(2000);
  const [actualCashCount, setActualCashCount] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState<string>('');

  const session: any = activeSession;
  const expectedCash = session ? (session.expectedCash ?? session.expected_cash ?? 0) : 0;
  const openingCash = session ? (session.openingCash ?? session.opening_cash ?? 0) : 0;
  const cashSales = session ? (session.cashSales ?? session.cash_sales ?? 0) : 0;
  const counterName = session ? (session.counterName ?? session.counter_name ?? '') : '';
  const cashierName = session ? (session.cashierName ?? session.cashier_name ?? '') : '';
  const openedAt = session ? (session.openedAt ?? session.opened_at ?? '') : '';

  const loadData = async () => {
    try {
      const cnts = await api.getCounters();
      setCounters(cnts);
      if (currentUser) {
        const ses: any = await api.getCashierSession(currentUser.id);
        setActiveSession(ses);
        if (ses) setActualCashCount(ses.expectedCash ?? ses.expected_cash ?? 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnt = counters.find((c) => c.id === selectedCounterId);
    if (!cnt) return;

    try {
      await api.openCashierSession({
        counterId: cnt.id,
        counterName: cnt.name,
        cashierId: currentUser?.id || 'usr-3',
        cashierName: currentUser?.name || 'Cashier',
        openingCash: openingFloat,
      });
      alert('Shift opened successfully!');
      setShowOpenModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to open shift');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    try {
      const res = await api.closeCashierSession({
        sessionId: activeSession.id,
        actualCash: actualCashCount,
        notes: closeNotes,
        cashierId: currentUser?.id,
        cashierName: currentUser?.name,
      });
      alert(`Shift closed! Expected: ₹${res.expectedCash}, Counted: ₹${res.actualCash}, Diff: ₹${res.difference}`);
      setShowCloseModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to close shift');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Cash Counter & Cashier Shift Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Shift reconciliation, opening float, cash refunds, and expected vs physical cash tally
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Refresh Counters
        </button>
      </div>

      {/* Active Cashier Session Card */}
      {activeSession ? (
        <div className="p-5 bg-slate-950 border-2 border-emerald-500/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Active Shift in Progress
              </span>
              <span className="text-xs text-slate-500 font-mono">({counterName})</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">Cashier: {cashierName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Opened: {openedAt ? new Date(openedAt).toLocaleTimeString() : 'Recently'} with ₹{openingCash} opening float
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Expected Drawer Cash:</span>
              <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                ₹{expectedCash}
              </span>
            </div>
            <button
              onClick={() => {
                setActualCashCount(expectedCash);
                setShowCloseModal(true);
              }}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-950 transition-colors"
            >
              End Shift & Tally Cash
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">No Active Shift for Current Cashier</h3>
            <p className="text-xs text-slate-400 mt-0.5">Open a counter shift to begin POS billing sessions</p>
          </div>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-950"
          >
            Open New Shift
          </button>
        </div>
      )}

      {/* Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {counters.map((c) => (
          <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm text-white">{c.code}</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  c.status === 'OPEN'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-900 text-slate-500'
                }`}
              >
                {c.status}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-200">{c.name}</p>
            <div className="text-xs text-slate-400">
              Cashier: <span className="text-white">{c.currentCashierName || (c as any).current_cashier_name || 'None'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* OPEN SHIFT MODAL */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Open Cashier Shift</h3>
              <button onClick={() => setShowOpenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Select Counter:</label>
                <select
                  value={selectedCounterId}
                  onChange={(e) => setSelectedCounterId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                >
                  {counters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Opening Cash Float in Drawer (₹):</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Start Counter Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT MODAL */}
      {showCloseModal && activeSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Close Shift & Cash Reconciliation</h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Opening Float:</span>
                  <span className="font-mono text-white">₹{openingCash}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cash Sales Recorded:</span>
                  <span className="font-mono text-white">₹{cashSales}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-slate-800 pt-1 mt-1 text-slate-200">
                  <span>System Expected Cash:</span>
                  <span className="font-mono text-emerald-400">₹{expectedCash}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Actual Physical Cash Counted in Drawer (₹):</label>
                <input
                  type="number"
                  required
                  value={actualCashCount}
                  onChange={(e) => setActualCashCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Difference indication */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Cash Difference:</span>
                <span
                  className={`text-base font-mono font-bold ${
                    actualCashCount - expectedCash === 0
                      ? 'text-emerald-400'
                      : actualCashCount - expectedCash > 0
                      ? 'text-sky-400'
                      : 'text-rose-400'
                  }`}
                >
                  {actualCashCount - expectedCash === 0
                    ? '₹0 (Exact Tally)'
                    : actualCashCount - expectedCash > 0
                    ? `+₹${actualCashCount - expectedCash} (Excess)`
                    : `-₹${Math.abs(actualCashCount - expectedCash)} (Shortage)`}
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Shift Closing Notes:</label>
                <input
                  type="text"
                  placeholder="Optional remarks"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold"
                >
                  Confirm & Finalize Closing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
