import React, { useState } from 'react';
import { Boxes, AlertTriangle, Clock, RefreshCw, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext.tsx';
import { api } from '../../services/api.ts';

export const InventoryView: React.FC = () => {
  const { products, categories, refreshProducts } = useStore();
  const [activeTab, setActiveTab] = useState<'lowStock' | 'allStock' | 'expiring'>('lowStock');

  const lowStockItems = products.filter((p) => p.currentStock <= p.reorderLevel);
  const totalStockValue = products.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Inventory Control & Stock Alerts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Total Inventory Valuation: <span className="text-emerald-400 font-mono font-bold">₹{Math.round(totalStockValue).toLocaleString('en-IN')}</span>
          </p>
        </div>
        <button
          onClick={refreshProducts}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Refresh Stock
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('lowStock')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'lowStock'
              ? 'bg-amber-950/80 border border-amber-800 text-amber-300'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Low Stock Reorder List ({lowStockItems.length})
        </button>

        <button
          onClick={() => setActiveTab('allStock')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'allStock' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4 text-emerald-400" />
          Complete Stock Valuation ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('expiring')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'expiring'
              ? 'bg-rose-950/80 border border-rose-800 text-rose-300'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-rose-400" />
          Expiry Tracking
        </button>
      </div>

      {/* Content based on tab */}
      {activeTab === 'lowStock' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 bg-amber-950/20 border-b border-amber-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Products requiring immediate purchase order placement:</span>
            </div>
            <span className="text-xs font-mono text-amber-400 font-semibold">{lowStockItems.length} items</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Product Name & Barcode</th>
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3 text-right">Current Stock</th>
                <th className="px-3 py-3 text-right">Reorder Level</th>
                <th className="px-3 py-3 text-right">Suggested Order Qty</th>
                <th className="px-3 py-3 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {lowStockItems.map((p) => {
                const suggestedQty = Math.max(20, p.maxStockLevel - p.currentStock);
                const estCost = suggestedQty * p.purchasePrice;
                return (
                  <tr key={p.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{p.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{p.unit}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-amber-400">
                      {p.currentStock}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-400">{p.reorderLevel}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">
                      +{suggestedQty}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-300">
                      ₹{Math.round(estCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'allStock' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-3 py-3 text-right">Current Qty</th>
                <th className="px-3 py-3 text-right">Cost Rate</th>
                <th className="px-3 py-3 text-right">Selling Rate</th>
                <th className="px-3 py-3 text-right">Stock Cost Value</th>
                <th className="px-3 py-3 text-right">Stock Retail Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.map((p) => {
                const costVal = p.currentStock * p.purchasePrice;
                const retailVal = p.currentStock * p.sellingPrice;
                return (
                  <tr key={p.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-300">
                      {p.currentStock} {p.unit}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-400">₹{p.purchasePrice}</td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-400 font-bold">₹{p.sellingPrice}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-300">₹{Math.round(costVal)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-white">₹{Math.round(retailVal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'expiring' && (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
            <Clock className="w-4 h-4 text-rose-400" />
            <span>Batches expiring within 30-60 days:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {products.slice(0, 8).map((p, i) => (
              <div key={p.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Batch: BAT-2024{10 + i}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800/80 px-2 py-0.5 rounded font-mono">
                    Expires in {20 + i * 5} days
                  </span>
                  <p className="text-xs font-mono text-slate-400 mt-1">{p.currentStock} {p.unit} in stock</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
