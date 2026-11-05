import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Plus, Search, DollarSign, ArrowDownLeft, ArrowUpRight, Phone, Printer, X } from 'lucide-react';
import { api } from '../../services/api.ts';
import { Customer } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const CustomerKhataView: React.FC = () => {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const loadCustomers = async () => {
    try {
      const data = await api.getCustomers(searchTerm);
      setCustomers(data);
      if (data.length > 0 && !selectedCustomer) {
        handleSelectCustomer(data[1] || data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchTerm]);

  const handleSelectCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    try {
      const res = await api.getCustomerKhata(c.id);
      setLedger(res.ledger || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;

    try {
      await api.recordKhataPayment(selectedCustomer.id, {
        amount: paymentAmount,
        paymentMode,
        notes: paymentNotes,
        recordedBy: currentUser?.name || 'Cashier',
      });
      alert('Khata payment recorded successfully!');
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      // Reload customer and ledger
      const updated = await api.getCustomerKhata(selectedCustomer.id);
      setSelectedCustomer(updated.customer);
      setLedger(updated.ledger);
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);

  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col bg-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Customer Master & Digital Khata (Udhaar)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Total Supermarket Receivables: <span className="font-mono text-amber-400 font-bold">₹{totalOutstanding.toLocaleString('en-IN')}</span>
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left: Customer List */}
        <div className="w-80 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Customer or Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {customers.map((c) => {
              const isSelected = selectedCustomer?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-950/60 border border-emerald-500/80 text-white shadow-md'
                      : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-xs text-white">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.phone}</p>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold ${
                        c.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      ₹{c.outstandingBalance}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Customer Passbook / Ledger */}
        <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
          {selectedCustomer ? (
            <>
              {/* Customer Header Card */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{selectedCustomer.name}</h3>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                      {selectedCustomer.customerType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>Phone: {selectedCustomer.phone}</span>
                    <span>·</span>
                    <span>Credit Limit: ₹{selectedCustomer.creditLimit}</span>
                    <span>·</span>
                    <span>Loyalty Points: {selectedCustomer.loyaltyPoints}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Current Outstanding Due:</span>
                    <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums">
                      ₹{selectedCustomer.outstandingBalance}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setPaymentAmount(selectedCustomer.outstandingBalance);
                      setShowPaymentModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Khata Payment
                  </button>
                </div>
              </div>

              {/* Ledger Passbook Table */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Digital Khata Passbook & Statement
                  </h4>
                  <button
                    onClick={() => window.print()}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Statement
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Transaction Description</th>
                        <th className="p-3">Ref / Invoice</th>
                        <th className="p-3 text-right">Debit (Added)</th>
                        <th className="p-3 text-right">Credit (Paid)</th>
                        <th className="p-3 text-right">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {ledger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-500">
                            No ledger entries for this customer
                          </td>
                        </tr>
                      ) : (
                        ledger.map((entry) => {
                          const isCreditSale = entry.type === 'CREDIT_SALE' || entry.type === 'ADJUSTMENT';
                          return (
                            <tr key={entry.id} className="hover:bg-slate-900/40">
                              <td className="p-3 text-slate-400 font-mono">
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className="p-3 font-medium text-white">{entry.notes || entry.type}</td>
                              <td className="p-3 text-slate-400 font-mono">{entry.reference_no || '-'}</td>
                              <td className="p-3 text-right font-mono font-bold text-rose-400">
                                {isCreditSale ? `₹${entry.amount}` : '-'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                {!isCreditSale ? `₹${entry.amount}` : '-'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-200">
                                ₹{entry.balance_after}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select a customer from the left list to view Khata ledger
            </div>
          )}
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-white text-sm">Record Customer Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                <span className="text-slate-400">Current Outstanding:</span>
                <span className="font-mono font-bold text-amber-400">₹{selectedCustomer.outstandingBalance}</span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Amount Received (₹):</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Method:</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                >
                  <option value="CASH">Cash Collection</option>
                  <option value="UPI">UPI (GPay / PhonePe)</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes / Transaction Reference:</label>
                <input
                  type="text"
                  placeholder="e.g. Month-end settlement"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md shadow-emerald-950"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
