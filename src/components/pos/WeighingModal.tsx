import React, { useState } from 'react';
import { Scale, X, Check } from 'lucide-react';
import { Product } from '../../types/index.ts';

interface WeighingModalProps {
  product: Product;
  onConfirm: (product: Product, weight: number) => void;
  onClose: () => void;
}

export const WeighingModal: React.FC<WeighingModalProps> = ({ product, onConfirm, onClose }) => {
  const [weight, setWeight] = useState<number>(1.0);
  const [tareWeight, setTareWeight] = useState<number>(0);

  const netWeight = Math.max(0, Number((weight - tareWeight).toFixed(3)));
  const calculatedPrice = Math.round(netWeight * product.sellingPrice);

  const quickWeights = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0];

  const handleConfirm = () => {
    if (netWeight <= 0) return;
    onConfirm(product, netWeight);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-slate-800 px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">Electronic Weighing Scale</h3>
              <p className="text-xs text-slate-400">Sold by Weight ({product.unit.toUpperCase()})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <p className="font-semibold text-slate-200 text-sm">{product.name}</p>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
              <span>Rate per {product.unit}:</span>
              <span className="text-emerald-400 font-mono font-semibold">₹{product.sellingPrice}</span>
            </div>
          </div>

          {/* Digital Scale Display */}
          <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-xl p-4 text-center">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Net Weight</span>
            <div className="text-4xl font-mono font-bold text-emerald-400 my-1 tabular-nums">
              {netWeight.toFixed(3)} <span className="text-lg text-slate-400 font-sans">{product.unit}</span>
            </div>
            <div className="text-sm text-slate-300 font-medium">
              Calculated Total: <span className="text-white font-mono font-bold text-base">₹{calculatedPrice}</span>
            </div>
          </div>

          {/* Manual Weight Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Enter Weight ({product.unit}):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.005"
                min="0.001"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                autoFocus
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setTareWeight(weight)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium"
              >
                Tare
              </button>
            </div>
          </div>

          {/* Quick Weight Presets */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">Quick Presets:</span>
            <div className="grid grid-cols-6 gap-1.5">
              {quickWeights.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeight(w)}
                  className={`py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                    weight === w
                      ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {w < 1 ? `${w * 1000}g` : `${w}kg`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/60 px-5 py-3 border-t border-slate-700 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950"
          >
            <Check className="w-4 h-4" />
            Add to Bill (₹{calculatedPrice})
          </button>
        </div>
      </div>
    </div>
  );
};
