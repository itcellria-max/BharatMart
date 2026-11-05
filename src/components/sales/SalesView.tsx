import React, { useState, useEffect } from 'react';
import { Receipt, Search, RotateCcw, Eye, X, CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.ts';
import { SalesInvoice } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const SalesView: React.FC = () => {
  const { hasPermission, currentUser } = useAuth();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItem, setReturnItem] = useState<any | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<string>('Damaged / Defective pack');
  const [refundMode, setRefundMode] = useState<string>('CASH');

  const loadInvoices = async () => {
    try {
      const data = await api.getInvoices({ search: searchTerm });
      setInvoices(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [searchTerm]);

  const handleViewInvoice = async (id: string) => {
    try {
      const inv = await api.getInvoiceById(id);
      setSelectedInvoice(inv);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !returnItem) return;

    try {
      const refundAmt = Math.round(returnQty * returnItem.unit_price);
      await api.returnInvoiceItem(selectedInvoice.id, {
        productId: returnItem.product_id,
        quantity: returnQty,
        refundAmount: refundAmt,
        refundMode,
        reason: returnReason,
        authorizedBy: currentUser?.name || 'Store Manager',
      });
      alert(`Return successful! Refund amount: ₹${refundAmt}`);
      setShowReturnModal(false);
      handleViewInvoice(selectedInvoice.id);
      loadInvoices();
    } catch (err: any) {
      alert(err.message || 'Return failed');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sales Invoices & Returns Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Audited sales transaction history and customer returns</p>
        </div>
        <button
          onClick={loadInvoices}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Invoice Number, Customer Name, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-3 py-3">Date & Time</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Cashier / Counter</th>
              <th className="px-3 py-3 text-right">Taxable</th>
              <th className="px-3 py-3 text-right">GST</th>
              <th className="px-3 py-3 text-right">Grand Total</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-900/50">
                <td className="px-4 py-3 font-mono font-bold text-white">{inv.invoiceNo || (inv as any).invoice_no}</td>
                <td className="px-3 py-3 text-slate-400">
                  {new Date(inv.invoiceDate || (inv as any).invoice_date).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-slate-200">
                  {inv.customerName || (inv as any).customer_name || 'Walk-in'}
                </td>
                <td className="px-3 py-3 text-slate-400">
                  {inv.cashierName || (inv as any).cashier_name} ({(inv as any).counter_id})
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-400">
                  ₹{inv.subtotal}
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-400">
                  ₹{inv.taxTotal || (inv as any).tax_total}
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">
                  ₹{inv.grandTotal || (inv as any).grand_total}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    PAID
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleViewInvoice(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* INVOICE DETAIL & RETURN MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-white text-base">Invoice {selectedInvoice.invoice_no}</h3>
                <p className="text-xs text-slate-400">{new Date(selectedInvoice.invoice_date).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">Customer: </span>
                  <span className="text-white font-semibold">{selectedInvoice.customer_name || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Counter: </span>
                  <span className="text-white font-mono">{selectedInvoice.counter_id}</span>
                </div>
                <div>
                  <span className="text-slate-400">Cashier: </span>
                  <span className="text-white">{selectedInvoice.cashier_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Payment Mode: </span>
                  <span className="text-emerald-400 font-semibold">{selectedInvoice.payments?.[0]?.mode || 'CASH'}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right">Total</th>
                      {hasPermission('PROCESS_RETURNS') && <th className="p-2.5 text-center">Return</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {selectedInvoice.items?.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2.5 font-medium text-white">{it.product_name}</td>
                        <td className="p-2.5 text-center font-mono">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₹{it.unit_price}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400">₹{it.total}</td>
                        {hasPermission('PROCESS_RETURNS') && (
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => {
                                setReturnItem(it);
                                setReturnQty(it.quantity);
                                setShowReturnModal(true);
                              }}
                              className="px-2 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded text-[11px] flex items-center gap-1 mx-auto"
                            >
                              <RotateCcw className="w-3 h-3" /> Return
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                <span className="font-semibold text-slate-300">Grand Total:</span>
                <span className="text-xl font-mono font-bold text-emerald-400">₹{selectedInvoice.grand_total}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALES RETURN DIALOG */}
      {showReturnModal && returnItem && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5">
            <h3 className="font-bold text-white text-sm mb-1">Process Customer Sales Return</h3>
            <p className="text-xs text-slate-400 mb-4">{returnItem.product_name}</p>

            <form onSubmit={handleProcessReturn} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Return Quantity (Max {returnItem.quantity}):</label>
                <input
                  type="number"
                  max={returnItem.quantity}
                  min={1}
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Refund Method:</label>
                <select
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                >
                  <option value="CASH">Cash Refund</option>
                  <option value="STORE_CREDIT">Store Credit / Khata Balance</option>
                  <option value="UPI">UPI Refund</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason for Return:</label>
                <input
                  type="text"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between">
                <span className="text-slate-400">Total Refund Payable:</span>
                <span className="font-mono font-bold text-amber-400">₹{Math.round(returnQty * returnItem.unit_price)}</span>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Authorize Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
