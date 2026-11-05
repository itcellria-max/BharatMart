import React, { useState } from 'react';
import { Barcode, Printer, Search, CheckSquare, Square } from 'lucide-react';
import { useStore } from '../../context/StoreContext.tsx';
import { Product } from '../../types/index.ts';

export const BarcodeLabelView: React.FC = () => {
  const { products } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [labelSize, setLabelSize] = useState<'SHELF_TAG' | 'STICKER'>('SHELF_TAG');

  const filtered = products.filter(
    (p) =>
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Barcode Label & Shelf Tag Generator</h2>
          <p className="text-xs text-slate-400 mt-0.5">Generate printable barcode price tags for shelves and product packaging</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950"
          >
            <Printer className="w-4 h-4" />
            Print Selected Labels ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Selector & Search */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
        <button
          onClick={selectAll}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs flex items-center gap-1.5"
        >
          {selectedIds.length === filtered.length && filtered.length > 0 ? (
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          Select All
        </button>

        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search items for barcode label batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={labelSize}
          onChange={(e: any) => setLabelSize(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
        >
          <option value="SHELF_TAG">Shelf Edge Tag (50mm x 30mm)</option>
          <option value="STICKER">Barcode Sticker (38mm x 25mm)</option>
        </select>
      </div>

      {/* Printable Preview Sheet */}
      {selectedProducts.length > 0 && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <h3 className="font-semibold text-xs text-slate-300 uppercase tracking-wider mb-3">
            Print Preview Sheet ({selectedProducts.length} Tags)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white text-black p-3 rounded-lg border-2 border-dashed border-gray-400 font-mono text-center flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-bold text-xs truncate uppercase">{p.name}</h4>
                  <p className="text-[10px] text-gray-600 font-sans">{p.brand} · {p.unit}</p>
                </div>

                <div className="my-2 py-1 bg-gray-100 rounded flex flex-col items-center">
                  {/* SVG Barcode bars representation */}
                  <div className="flex items-center gap-[2px] h-8 my-0.5">
                    {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2].map((w, i) => (
                      <div key={i} className="bg-black h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <span className="text-[9px] font-bold tracking-widest">{p.barcode}</span>
                </div>

                <div className="flex items-center justify-between border-t border-gray-300 pt-1 text-[10px]">
                  <span className="text-gray-500 line-through">MRP: ₹{p.mrp}</span>
                  <span className="text-xs font-bold font-sans text-emerald-800">OUR PRICE: ₹{p.sellingPrice}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Selection Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 w-10">Select</th>
              <th className="px-3 py-3">Product Name</th>
              <th className="px-3 py-3">Barcode</th>
              <th className="px-3 py-3 text-right">Selling Price</th>
              <th className="px-3 py-3 text-right">MRP</th>
              <th className="px-3 py-3 text-right">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.slice(0, 50).map((p) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <tr
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className="hover:bg-slate-900/50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-3 py-3 font-mono text-slate-300">{p.barcode}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">₹{p.sellingPrice}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">₹{p.mrp}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">
                    {p.currentStock} {p.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
