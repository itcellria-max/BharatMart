import React, { useState } from 'react';
import { Layers, Scale, Sparkles, Edit2, Check, ArrowUpDown } from 'lucide-react';
import { useStore } from '../../context/StoreContext.tsx';
import { Product } from '../../types/index.ts';

export const GroceryView: React.FC = () => {
  const { products, categories, refreshProducts } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-1');

  // Filter grocery items
  const categoryProducts = products.filter((p) => p.categoryId === selectedCategory);
  const currentCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-900">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Kirana & Grocery Department Management</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Dedicated shelf management for loose grains, pulses, spices, edible oils, and food retail items
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedCategory === c.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>{c.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategory === c.id ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {products.filter((p) => p.categoryId === c.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Category Shelf Header */}
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-white">{currentCategory?.name || 'Department'}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{currentCategory?.description || 'Department essentials'}</p>
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="font-mono text-emerald-400 font-bold">{categoryProducts.length}</span> items on shelf
        </div>
      </div>

      {/* Product Shelf Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categoryProducts.map((p) => (
          <div
            key={p.id}
            className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono">{p.brand || 'Desi Mandi'}</span>
                {p.isWeighingScale ? (
                  <span className="text-sky-400 bg-sky-950/80 border border-sky-800/80 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Weighing Scale ({p.unit})
                  </span>
                ) : (
                  <span className="font-mono">Pack: {p.packSize || p.unit}</span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-white line-clamp-2">{p.name}</h4>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Barcode: {p.barcode} · HSN: {p.hsnCode}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block">Selling Rate:</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  ₹{p.sellingPrice} <span className="text-xs text-slate-400 font-sans">/ {p.unit}</span>
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Shelf Stock:</span>
                <span
                  className={`text-xs font-mono font-bold ${
                    p.currentStock <= p.reorderLevel ? 'text-amber-400' : 'text-slate-200'
                  }`}
                >
                  {p.currentStock} {p.unit}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
