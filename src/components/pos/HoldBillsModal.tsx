import React from 'react';
import { PauseCircle, X, RotateCcw, Trash2, Clock, User } from 'lucide-react';
import { usePOS } from '../../context/POSContext.tsx';
import { HeldBill } from '../../types/index.ts';
import { api } from '../../services/api.ts';

interface HoldBillsModalProps {
  onClose: () => void;
}

export const HoldBillsModal: React.FC<HoldBillsModalProps> = ({ onClose }) => {
  const { heldBills, recallBill, loadHeldBills } = usePOS();

  const handleRecall = (bill: HeldBill) => {
    recallBill(bill);
    onClose();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to discard this held bill?')) {
      await api.deleteHeldBill(id);
      await loadHeldBills();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="bg-slate-800 px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">Held / Parked Bills</h3>
              <p className="text-xs text-slate-400">Recall parked counter tickets</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
          {heldBills.length === 0 ? (
            <div className="text-center py-8">
              <PauseCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-300 font-medium">No Held Bills</p>
              <p className="text-xs text-slate-500 mt-1">Press F4 on the POS screen to park a customer bill</p>
            </div>
          ) : (
            heldBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => handleRecall(bill)}
                className="bg-slate-950 border border-slate-800 hover:border-emerald-500/60 p-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {bill.customer?.name || 'Walk-in Customer'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">({bill.items.length} items)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(bill.heldAt).toLocaleTimeString()}</span>
                    {bill.note && <span className="text-amber-400/90 font-medium">· {bill.note}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                      ₹{bill.grandTotal}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(bill.id, e)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Discard"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRecall(bill)}
                    className="px-3 py-1.5 bg-emerald-600 group-hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-md shadow-emerald-950"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Recall
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
