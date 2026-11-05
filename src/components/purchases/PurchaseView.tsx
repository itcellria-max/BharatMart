import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, FileText, Calendar, X, CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.ts';
import { Supplier, PurchaseInvoice } from '../../types/index.ts';
import { useStore } from '../../context/StoreContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const PurchaseView: React.FC = () => {
  const { products, refreshProducts } = useStore();
  const { currentUser } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');

  // New purchase modal
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [purchaseQty, setPurchaseQty] = useState<number>(10);
  const [purchaseCost, setPurchaseCost] = useState<number>(100);
  const [purchaseMrp, setPurchaseMrp] = useState<number>(140);
  const [purchaseSelling, setPurchaseSelling] = useState<number>(125);
  const [batchNo, setBatchNo] = useState<string>('BAT-' + Date.now().toString().slice(-6));
  const [expiryDays, setExpiryDays] = useState<number>(180);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  const loadData = async () => {
    try {
      const [sup, pur] = await Promise.all([api.getSuppliers(), api.getPurchases()]);
      setSuppliers(sup);
      setPurchases(pur);
      if (sup.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(sup[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.id === selectedProductId);
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!product || !supplier) {
      alert('Please select both product and supplier');
      return;
    }

    const subtotal = purchaseQty * purchaseCost;
    const taxAmt = (subtotal * product.gstRate) / 100;
    const grandTotal = subtotal + taxAmt;

    const expiryDate = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];

    try {
      await api.createPurchase({
        supplierId: supplier.id,
        supplierName: supplier.name,
        invoiceNo: invoiceNo || `PI-${Date.now().toString().slice(-6)}`,
        items: [
          {
            productId: product.id,
            productName: product.name,
            barcode: product.barcode,
            hsnCode: product.hsnCode,
            batchNumber: batchNo,
            expiryDate,
            quantity: purchaseQty,
            freeQuantity: 0,
            unitPrice: purchaseCost,
            mrp: purchaseMrp,
            sellingPrice: purchaseSelling,
            gstRate: product.gstRate,
            taxAmount: taxAmt,
            total: grandTotal,
          },
        ],
        subtotal,
        taxTotal: taxAmt,
        grandTotal,
        paidAmount,
        userId: currentUser?.id,
        userName: currentUser?.name,
      });

      alert('Purchase recorded! Stock updated automatically.');
      setShowAddPurchaseModal(false);
      refreshProducts();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase');
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Purchase Management & Mandi / FMCG Suppliers</h2>
          <p className="text-xs text-slate-400 mt-0.5">Goods Received Notes (GRN), vendor payables and inward stock replenishment</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (products.length > 0) {
                setSelectedProductId(products[0].id);
                setPurchaseCost(products[0].purchasePrice);
                setPurchaseMrp(products[0].mrp);
                setPurchaseSelling(products[0].sellingPrice);
              }
              setShowAddPurchaseModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            Inward Goods / New Purchase
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'purchases' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          Purchase Invoices ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'suppliers' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4 text-sky-400" />
          Registered Suppliers ({suppliers.length})
        </button>
      </div>

      {activeTab === 'purchases' ? (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Supplier Name</th>
                <th className="px-3 py-3 text-right">Taxable</th>
                <th className="px-3 py-3 text-right">GST</th>
                <th className="px-3 py-3 text-right">Total Amount</th>
                <th className="px-3 py-3 text-right">Paid</th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-mono font-bold text-white">{(p as any).invoice_no || p.invoiceNo}</td>
                  <td className="px-3 py-3 text-slate-400">
                    {new Date((p as any).invoice_date || p.invoiceDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-200">
                    {(p as any).supplier_name || p.supplierName}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">₹{p.subtotal}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">₹{(p as any).tax_total || p.taxTotal}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">
                    ₹{(p as any).grand_total || p.grandTotal}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">
                    ₹{(p as any).paid_amount || p.paidAmount}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      RECEIVED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map((s) => (
            <div key={s.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{s.name}</h4>
                  <p className="text-xs text-slate-400">{s.company}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {s.paymentTerms}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>Contact: {s.contactPerson || 'N/A'}</p>
                <p>Phone: {s.phone}</p>
                <p className="font-mono">GSTIN: {s.gstin || 'N/A'}</p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-500">Outstanding Payable:</span>
                <span className="font-mono font-bold text-amber-400">₹{s.outstandingBalance}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW PURCHASE INWARD MODAL */}
      {showAddPurchaseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-white text-base">Inward Goods / Purchase Receipt</h3>
              <button onClick={() => setShowAddPurchaseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Select Supplier *</label>
                  <select
                    value={selectedSupplierId || ''}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Supplier Invoice Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-ITC-8921"
                    value={invoiceNo || ''}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Select Product to Inward *</label>
                  <select
                    value={selectedProductId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedProductId(id);
                      const p = products.find((x) => x.id === id);
                      if (p) {
                        setPurchaseCost(p.purchasePrice || (p as any).purchase_price || 0);
                        setPurchaseMrp(p.mrp || 0);
                        setPurchaseSelling(p.sellingPrice || (p as any).selling_price || 0);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                  >
                    <option value="">-- Select Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit}) - Barcode: {p.barcode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Inward Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={purchaseQty ?? 1}
                    onChange={(e) => setPurchaseQty(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Purchase Cost Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={purchaseCost ?? 0}
                    onChange={(e) => setPurchaseCost(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={batchNo || ''}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Shelf Life / Expiry (Days from today)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={expiryDays ?? 180}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Amount Paid to Supplier Now (₹)</label>
                  <input
                    type="number"
                    value={paidAmount ?? 0}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-400 block">Total Inward Value:</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      ₹{Math.round(purchaseQty * purchaseCost)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md shadow-emerald-950"
                >
                  Receive Goods & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
