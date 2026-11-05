import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, RefreshCw, Plus, History, ShieldCheck, X } from 'lucide-react';
import { api } from '../../services/api.ts';
import { useStore } from '../../context/StoreContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const GstCenterView: React.FC = () => {
  const { products, refreshProducts } = useStore();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'summary' | 'hsn' | 'history'>('summary');
  const [rateSummary, setRateSummary] = useState<any[]>([]);
  const [hsnSummary, setHsnSummary] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // Update GST Modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [newHsn, setNewHsn] = useState('');
  const [newRate, setNewRate] = useState<number>(5);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('GST Council statutory notification revision');
  const [referenceNote, setReferenceNote] = useState<string>('Notification No. 04/2024');

  const loadData = async () => {
    try {
      const [res, hist] = await Promise.all([api.getGstSummary(), api.getGstHistory()]);
      setRateSummary(res.rateSummary || []);
      setHsnSummary(res.hsnSummary || []);
      setHistory(hist || []);
      if (products.length > 0 && !selectedProductId) {
        setSelectedProductId(products[0].id);
        setNewHsn(products[0].hsnCode);
        setNewRate(products[0].gstRate);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [products]);

  const handleUpdateGST = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    try {
      await api.updateProductTax({
        productId: selectedProductId,
        newHsn,
        newRate,
        effectiveDate,
        reason,
        referenceNote,
        changedBy: currentUser?.name || 'Administrator',
      });
      alert('GST Rate updated and historical record added to compliance ledger.');
      setShowUpdateModal(false);
      refreshProducts();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update GST rate');
    }
  };

  const handleExportHsn = () => {
    const headers = ['HSN Code', 'Product Description', 'Unit', 'Total Quantity', 'Taxable Value', 'GST Rate', 'CGST', 'SGST', 'Total Value'];
    const rows = hsnSummary.map((h) => [
      h.hsn_code,
      `"${h.product_name.replace(/"/g, '""')}"`,
      h.unit,
      h.total_qty,
      h.taxable_amount,
      `${h.gst_rate}%`,
      h.cgst,
      h.sgst,
      h.total_value,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `bharatmart_gstr1_hsn_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">GST & Statutory Tax Management Center</h2>
          <p className="text-xs text-slate-400 mt-0.5">Indian GST retail compliance, HSN schedules, and statutory rate revisions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportHsn}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export GSTR-1 HSN CSV
          </button>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            Statutory GST Revision
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'summary' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          Rate-wise Slab Summary (GSTR-3B)
        </button>
        <button
          onClick={() => setActiveTab('hsn')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'hsn' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-sky-400" />
          HSN-wise Sales (GSTR-1)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'history' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4 text-amber-400" />
          Tax Change Audit History ({history.length})
        </button>
      </div>

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 5, 12, 18, 28].map((rate) => {
            const found = rateSummary.find((r) => r.gst_rate === rate);
            const taxable = found?.taxable_amount || 0;
            const tax = found?.tax_amount || 0;
            return (
              <div key={rate} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">GST Slab {rate}%</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    CGST {rate / 2}% + SGST {rate / 2}%
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block">Taxable Sales:</span>
                  <span className="text-lg font-mono font-bold text-white">₹{Math.round(taxable)}</span>
                </div>
                <div className="pt-1">
                  <span className="text-[11px] text-slate-400 block">GST Collected:</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">₹{Math.round(tax)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'hsn' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">HSN Code</th>
                <th className="px-3 py-3">Product Name</th>
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3 text-right">Total Qty</th>
                <th className="px-3 py-3 text-right">Taxable Amount</th>
                <th className="px-3 py-3 text-center">Rate</th>
                <th className="px-3 py-3 text-right">CGST</th>
                <th className="px-3 py-3 text-right">SGST</th>
                <th className="px-3 py-3 text-right">Gross Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {hsnSummary.map((h, i) => (
                <tr key={i} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">{h.hsn_code}</td>
                  <td className="px-3 py-3 font-medium text-white">{h.product_name}</td>
                  <td className="px-3 py-3 text-slate-400">{h.unit}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{h.total_qty}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">₹{Math.round(h.taxable_amount)}</td>
                  <td className="px-3 py-3 text-center font-mono text-slate-400">{h.gst_rate}%</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">₹{Math.round(h.cgst)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">₹{Math.round(h.sgst)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-white">₹{Math.round(h.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-3 py-3">Old HSN → New HSN</th>
                <th className="px-3 py-3">Old Rate → New Rate</th>
                <th className="px-3 py-3">Effective Date</th>
                <th className="px-3 py-3">Reason / Gazette Ref</th>
                <th className="px-3 py-3">Authorized By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500">
                    No statutory GST changes recorded yet
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-semibold text-white">{item.product_name}</td>
                    <td className="px-3 py-3 font-mono text-slate-300">
                      {item.old_hsn} → <span className="text-emerald-400 font-bold">{item.new_hsn}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-300">
                      {item.old_rate}% → <span className="text-emerald-400 font-bold">{item.new_rate}%</span>
                    </td>
                    <td className="px-3 py-3 text-slate-400 font-mono">{item.effective_date}</td>
                    <td className="px-3 py-3 text-slate-300">
                      {item.reason} {item.reference_note && `(${item.reference_note})`}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{item.changed_by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* STATUTORY GST UPDATE MODAL */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-white text-base">Statutory GST & HSN Revision</h3>
                <p className="text-xs text-slate-400">Updates future billing without changing past invoices</p>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGST} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Select Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedProductId(id);
                    const p = products.find((x) => x.id === id);
                    if (p) {
                      setNewHsn(p.hsnCode);
                      setNewRate(p.gstRate);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current HSN: {p.hsnCode}, GST: {p.gstRate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">New HSN Code *</label>
                  <input
                    type="text"
                    required
                    value={newHsn}
                    onChange={(e) => setNewHsn(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">New GST Rate (%) *</label>
                  <select
                    value={newRate}
                    onChange={(e) => setNewRate(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reason for Revision *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Govt Notification / Gazette Reference</label>
                <input
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md shadow-emerald-950"
                >
                  Apply & Record Audit Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
