import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Banknote,
  QrCode,
  BookOpen,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePOS } from '../../context/POSContext.tsx';
import { useStore } from '../../context/StoreContext.tsx';
import { PaymentSplit } from '../../types/index.ts';

interface PaymentModalProps {
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ onClose }) => {
  const { grandTotal, customer, processCheckout, isProcessing } = usePOS();
  const { settings } = useStore();

  const [activeTab, setActiveTab] = useState<'SINGLE' | 'SPLIT'>('SINGLE');
  const [singleMode, setSingleMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');

  // Cash tender calculator
  const [cashTendered, setCashTendered] = useState<number>(grandTotal || 0);

  // Card reference / approval code
  const [cardRef, setCardRef] = useState<string>('');

  // UPI dynamic QR code data URL
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');

  // Split payment list
  const [splitPayments, setSplitPayments] = useState<PaymentSplit[]>([
    { mode: 'CASH', amount: Math.floor((grandTotal || 0) / 2), referenceNo: '' },
    { mode: 'UPI', amount: (grandTotal || 0) - Math.floor((grandTotal || 0) / 2), referenceNo: '' },
  ]);

  // Generate UPI QR code for the exact bill amount
  useEffect(() => {
    const upiId = settings?.upiId || 'bharatmart@upi';
    const payee = encodeURIComponent(settings?.upiPayeeName || 'BharatMart Supermarket');
    const amount = grandTotal;
    const upiUri = `upi://pay?pa=${upiId}&pn=${payee}&am=${amount}&cu=INR&tn=BharatMart_Bill`;

    QRCode.toDataURL(upiUri, { width: 220, margin: 1, color: { dark: '#022c22', light: '#ffffff' } })
      .then(setUpiQrUrl)
      .catch((err) => console.error('Failed to generate UPI QR:', err));
  }, [grandTotal, settings]);

  const changeDue = Math.max(0, cashTendered - grandTotal);
  const splitTotal = splitPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const splitDifference = Number((grandTotal - splitTotal).toFixed(2));

  // Handle final checkout submit
  const handleFinalize = async () => {
    try {
      let finalPayments: PaymentSplit[] = [];
      if (activeTab === 'SINGLE') {
        if (singleMode === 'CREDIT' && !customer) {
          alert('Please select or register a customer to bill on Digital Khata (Credit).');
          return;
        }
        if (singleMode === 'CREDIT' && customer) {
          if (customer.outstandingBalance + grandTotal > customer.creditLimit) {
            alert(`Customer credit limit of ₹${customer.creditLimit} will be exceeded! Current Khata due: ₹${customer.outstandingBalance}`);
            return;
          }
        }
        finalPayments = [{ mode: singleMode, amount: grandTotal, referenceNo: singleMode === 'CARD' ? cardRef : undefined }];
      } else {
        if (Math.abs(splitDifference) > 0.01) {
          alert(`Split payments must sum exactly to ₹${grandTotal}. Currently difference is ₹${splitDifference}`);
          return;
        }
        finalPayments = splitPayments.filter((p) => p.amount > 0);
      }

      await processCheckout(finalPayments);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Payment execution failed');
    }
  };

  const addSplitRow = () => {
    setSplitPayments([...splitPayments, { mode: 'CARD', amount: 0 }]);
  };

  const removeSplitRow = (idx: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== idx));
  };

  const updateSplit = (idx: number, field: keyof PaymentSplit, val: any) => {
    const updated = [...splitPayments];
    updated[idx] = { ...updated[idx], [field]: val };
    setSplitPayments(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div>
            <h3 className="font-bold text-white text-base">Payment & Invoicing (F9)</h3>
            <p className="text-xs text-slate-400">
              Customer: <span className="text-slate-200 font-semibold">{customer?.name || 'Walk-in'}</span>
              {customer?.phone && ` (${customer.phone})`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Due</span>
              <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                ₹{grandTotal}
              </span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Toggle: Single Payment vs Split Payment */}
        <div className="px-6 pt-4 pb-2 flex gap-2 border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('SINGLE')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'SINGLE'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Direct Payment
          </button>
          <button
            onClick={() => setActiveTab('SPLIT')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'SPLIT'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Split Payment (Multi-Mode)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {activeTab === 'SINGLE' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Payment Mode Buttons */}
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-medium block">Choose Payment Mode:</span>

                <button
                  type="button"
                  onClick={() => setSingleMode('CASH')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    singleMode === 'CASH'
                      ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-semibold text-sm">Cash Tender</p>
                      <p className="text-xs text-slate-400">Direct cash collection at counter</p>
                    </div>
                  </div>
                  {singleMode === 'CASH' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSingleMode('UPI')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    singleMode === 'UPI'
                      ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <QrCode className="w-5 h-5 text-sky-400" />
                    <div>
                      <p className="font-semibold text-sm">UPI Dynamic QR</p>
                      <p className="text-xs text-slate-400">GPay, PhonePe, Paytm, BHIM</p>
                    </div>
                  </div>
                  {singleMode === 'UPI' && <CheckCircle2 className="w-5 h-5 text-sky-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSingleMode('CARD')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    singleMode === 'CARD'
                      ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="font-semibold text-sm">Debit / Credit Card</p>
                      <p className="text-xs text-slate-400">POS Card swipe / Tap machine</p>
                    </div>
                  </div>
                  {singleMode === 'CARD' && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSingleMode('CREDIT')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    singleMode === 'CREDIT'
                      ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="font-semibold text-sm">Digital Khata (Udhaar)</p>
                      <p className="text-xs text-slate-400">Customer monthly credit ledger</p>
                    </div>
                  </div>
                  {singleMode === 'CREDIT' && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
                </button>
              </div>

              {/* Mode Specific Panel */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center items-center text-center">
                {singleMode === 'CASH' && (
                  <div className="w-full space-y-3">
                    <span className="text-xs text-slate-400 block font-medium">Cash Change Calculator:</span>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Cash Received from Customer:</label>
                      <input
                        type="number"
                        value={isNaN(cashTendered) ? 0 : cashTendered}
                        onChange={(e) => setCashTendered(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center text-xl font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    {/* Quick tender notes */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[100, 200, 500, 2000].map((note) => (
                        <button
                          key={note}
                          type="button"
                          onClick={() => setCashTendered(note)}
                          className="py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-xs font-mono text-slate-300"
                        >
                          ₹{note}
                        </button>
                      ))}
                    </div>
                    <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 mt-2">
                      <span className="text-xs text-slate-400 block">Balance / Change to Return:</span>
                      <span className={`text-2xl font-mono font-bold ${changeDue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{changeDue}
                      </span>
                    </div>
                  </div>
                )}

                {singleMode === 'UPI' && (
                  <div className="flex flex-col items-center space-y-2">
                    <span className="text-xs text-slate-300 font-semibold">Scan with Any UPI App</span>
                    {upiQrUrl ? (
                      <div className="p-2 bg-white rounded-xl shadow-lg border-2 border-emerald-500/60">
                        <img src={upiQrUrl} alt="UPI QR" className="w-44 h-44 rounded-lg" />
                      </div>
                    ) : (
                      <div className="w-44 h-44 bg-slate-900 flex items-center justify-center text-slate-500 text-xs">
                        Generating QR...
                      </div>
                    )}
                    <p className="text-xs font-mono text-emerald-400 font-bold">Amount: ₹{grandTotal}</p>
                    <p className="text-[11px] text-slate-400">{settings?.upiId || 'bharatmart@upi'}</p>
                  </div>
                )}

                {singleMode === 'CARD' && (
                  <div className="space-y-3">
                    <CreditCard className="w-12 h-12 text-purple-400 mx-auto" />
                    <p className="text-sm font-semibold text-white">Swipe / Dip / Tap POS Card Terminal</p>
                    <p className="text-xs text-slate-400">Card amount: ₹{grandTotal}</p>
                    <input
                      type="text"
                      placeholder="Optional Card Approval Code / Ref #"
                      value={cardRef}
                      onChange={(e) => setCardRef(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                )}

                {singleMode === 'CREDIT' && (
                  <div className="w-full space-y-3 text-left">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <BookOpen className="w-4 h-4" />
                      <span>Digital Khata Entry</span>
                    </div>
                    {customer ? (
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                        <p className="text-white font-medium">{customer.name}</p>
                        <p className="text-slate-400">Mobile: {customer.phone}</p>
                        <p className="text-slate-400">
                          Current Due: <span className="font-mono text-amber-400 font-semibold">₹{customer.outstandingBalance}</span>
                        </p>
                        <p className="text-slate-400">
                          Credit Limit: <span className="font-mono text-slate-200">₹{customer.creditLimit}</span>
                        </p>
                        <div className="pt-1.5 border-t border-slate-800 text-slate-300">
                          New Balance After Bill:{' '}
                          <span className="font-mono text-white font-bold">
                            ₹{customer.outstandingBalance + grandTotal}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-center">
                        <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                        <p className="text-xs text-amber-300 font-semibold">No Customer Attached</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Close this modal and press F8 to select a registered customer for Khata credit.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Split Payment Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Split Bill into Multiple Payments:</span>
                <button
                  type="button"
                  onClick={addSplitRow}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Split Mode
                </button>
              </div>

              <div className="space-y-2">
                {splitPayments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <select
                      value={p.mode}
                      onChange={(e) => updateSplit(idx, 'mode', e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                      <option value="CREDIT">Customer Khata</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>

                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-mono">₹</span>
                      <input
                        type="number"
                        value={p.amount ?? 0}
                        onChange={(e) => updateSplit(idx, 'amount', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white font-mono font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Ref / Note"
                      value={p.referenceNo || ''}
                      onChange={(e) => updateSplit(idx, 'referenceNo', e.target.value)}
                      className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300"
                    />

                    {splitPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplitRow(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Split Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400">Total Allocated: </span>
                  <span className="font-bold text-white">₹{splitTotal}</span>
                </div>
                <div>
                  <span className="text-slate-400">Remaining / Diff: </span>
                  <span className={`font-bold ${splitDifference === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{splitDifference}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-800/80 px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleFinalize}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Invoice...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                CONFIRM & GENERATE INVOICE (₹{grandTotal})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
