import React, { useState, useEffect } from 'react';
import { TrendingDown, Plus, DollarSign, Calendar, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api.ts';
import { Expense } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const ExpensesView: React.FC = () => {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [category, setCategory] = useState('Packaging Material');
  const [amount, setAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [description, setDescription] = useState('');

  const loadExpenses = async () => {
    try {
      const data = await api.getExpenses();
      setExpenses(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createExpense({
        category,
        amount,
        paymentMethod,
        description,
        authorizedBy: currentUser?.name || 'Store Manager',
      });
      alert('Expense recorded successfully');
      setShowAddModal(false);
      setAmount(500);
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Expense Management & Store Accounts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Total Logged Expenses: <span className="text-rose-400 font-mono font-bold">₹{totalExpense.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950"
        >
          <Plus className="w-4 h-4" />
          Record Store Expense
        </button>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Receipt / Ref</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3">Payment Method</th>
              <th className="px-3 py-3">Authorized By</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {expenses.map((ex) => (
              <tr key={ex.id} className="hover:bg-slate-900/40">
                <td className="px-4 py-3 font-mono text-slate-400">{ex.receiptNumber || (ex as any).receipt_number}</td>
                <td className="px-3 py-3 text-slate-400">{new Date(ex.date).toLocaleDateString()}</td>
                <td className="px-3 py-3 font-medium text-white">{ex.category}</td>
                <td className="px-3 py-3 text-slate-300">{ex.description}</td>
                <td className="px-3 py-3 text-slate-400 font-mono">{ex.paymentMethod || (ex as any).payment_method}</td>
                <td className="px-3 py-3 text-slate-400">{ex.authorizedBy || (ex as any).authorized_by}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">₹{ex.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD EXPENSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Record Store Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Expense Category:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                >
                  <option value="Packaging Material">Packaging Materials (Bags, Rolls)</option>
                  <option value="Store Electricity Bill">Electricity & Chiller Load</option>
                  <option value="Commercial Rent">Commercial Shop Rent</option>
                  <option value="Staff Tea & Refreshments">Staff Tea & Refreshments</option>
                  <option value="Weighing Scale Calibration">Weighing Scale Metrology</option>
                  <option value="Maintenance & Cleaning">Housekeeping & Maintenance</option>
                  <option value="Transport & Freight">Transport & Freight</option>
                  <option value="Other Expenses">Other Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-base font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Method:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description / Bill Notes:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 carry bags and tape roll"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
