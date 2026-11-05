import React, { useState, useEffect } from 'react';
import { Users, X, Search, UserPlus, Check, Phone } from 'lucide-react';
import { Customer } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { usePOS } from '../../context/POSContext.tsx';

interface CustomerSelectModalProps {
  onClose: () => void;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({ onClose }) => {
  const { customer, setCustomer } = usePOS();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState(5000);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const loadCustomers = async () => {
    try {
      const data = await api.getCustomers(search);
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelect = (c: Customer | null) => {
    setCustomer(c);
    onClose();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setIsLoading(true);
    try {
      const created = await api.createCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        customerType: 'RETAIL',
        creditLimit: newCreditLimit,
        openingBalance: 0,
      });
      setCustomer(created);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-800 px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">Customer Master & Khata</h3>
              <p className="text-xs text-slate-400">Attach customer to current bill (F8)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {/* Default Walk-in Button */}
          <div className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
            <div>
              <p className="text-sm font-semibold text-white">Default Walk-in Customer</p>
              <p className="text-xs text-slate-400">Cash / UPI / Card billing without personal credit</p>
            </div>
            <button
              onClick={() => handleSelect(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !customer
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {!customer ? 'Currently Selected' : 'Select Walk-in'}
            </button>
          </div>

          {!isAddingNew ? (
            <>
              {/* Search bar + New button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by Mobile Number or Name..."
                    value={search || ''}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 shadow-md shadow-emerald-950"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New Customer
                </button>
              </div>

              {/* Customer List */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {customers.map((c) => {
                  const isSelected = customer?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-950/60 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {c.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs mt-1">
                          <span className="text-slate-400">
                            Khata Due: <span className="font-mono text-amber-400">₹{c.outstandingBalance}</span>
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">
                            Points: <span className="font-mono text-emerald-400">{c.loyaltyPoints}</span>
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <button className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded">
                          Select
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Quick Add Customer Form */
            <form onSubmit={handleCreateCustomer} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-white">Register New Customer</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={newName || ''}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Mobile Number (10 digits) *</label>
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  placeholder="e.g. 9812345678"
                  value={newPhone || ''}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Credit Limit (Khata) ₹</label>
                <input
                  type="number"
                  value={newCreditLimit ?? 5000}
                  onChange={(e) => setNewCreditLimit(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg shadow-md shadow-emerald-950 mt-2"
              >
                {isLoading ? 'Registering...' : 'Save & Attach to Bill'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
