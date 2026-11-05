import React, { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Scale,
  Percent,
  User,
  PauseCircle,
  Play,
  ArrowRight,
  Sparkles,
  Layers,
  X,
  RotateCcw,
} from 'lucide-react';
import { usePOS } from '../../context/POSContext.tsx';
import { useStore } from '../../context/StoreContext.tsx';
import { Product } from '../../types/index.ts';
import { WeighingModal } from './WeighingModal.tsx';
import { CustomerSelectModal } from './CustomerSelectModal.tsx';
import { HoldBillsModal } from './HoldBillsModal.tsx';
import { PaymentModal } from './PaymentModal.tsx';
import { ReceiptModal } from './ReceiptModal.tsx';

export const POSScreen: React.FC = () => {
  const {
    cart,
    customer,
    subtotal,
    discountTotal,
    taxTotal,
    cgstTotal,
    sgstTotal,
    roundOff,
    grandTotal,
    addToCart,
    updateQuantity,
    updateDiscount,
    removeFromCart,
    clearCart,
    scanBarcode,
    holdCurrentBill,
    heldBills,
    showPaymentModal,
    setShowPaymentModal,
    showCustomerModal,
    setShowCustomerModal,
    showHoldModal,
    setShowHoldModal,
    showReceiptModal,
    setShowReceiptModal,
  } = usePOS();

  const { products, categories } = useStore();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [weighingProduct, setWeighingProduct] = useState<Product | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) holdCurrentBill();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, holdCurrentBill, setShowCustomerModal, setShowPaymentModal]);

  // Handle barcode scanning submit
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const found = await scanBarcode(barcodeInput.trim());
    if (found) {
      setBarcodeInput('');
    } else {
      // Check in local products list
      const matched = products.find(
        (p) => p.barcode === barcodeInput.trim() || p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
      );
      if (matched) {
        if (matched.isWeighingScale) {
          setWeighingProduct(matched);
        } else {
          addToCart(matched, 1);
        }
        setBarcodeInput('');
      } else {
        alert(`Product with barcode / SKU "${barcodeInput}" not found.`);
      }
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.isWeighingScale) {
      setWeighingProduct(product);
    } else {
      addToCart(product, 1);
    }
  };

  // Filtered catalogue
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm) ||
      p.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-900 text-slate-100">
      {/* LEFT: Product Catalogue & Barcode Scanner */}
      <div className="w-[46%] border-r border-slate-800 flex flex-col bg-slate-950/60 shrink-0">
        {/* Barcode Scan Bar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2">
          <form onSubmit={handleBarcodeSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 text-emerald-400 absolute left-3 top-2.5" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / Enter SKU (Press F2 to focus)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border-2 border-emerald-500/40 rounded-xl pl-10 pr-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950"
            >
              Add
            </button>
          </form>

          {/* Search by Name & Category Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                placeholder="Search grocery item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Category Pill Tabs */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-2 content-start">
          {filteredProducts.slice(0, 36).map((product) => {
            const inCart = cart.find((i) => i.product.id === product.id);
            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none relative group ${
                  inCart
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{product.brand || product.unit}</span>
                    {product.isWeighingScale ? (
                      <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-800/60 px-1 py-0.2 rounded flex items-center gap-0.5">
                        <Scale className="w-2.5 h-2.5" /> Scale
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-mono">GST {product.gstRate}%</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-slate-100 line-clamp-2 mt-1 leading-snug">
                    {product.name}
                  </h4>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-mono font-bold text-emerald-400">₹{product.sellingPrice}</span>
                    {product.mrp > product.sellingPrice && (
                      <span className="text-[10px] text-slate-500 line-through font-mono">₹{product.mrp}</span>
                    )}
                  </div>

                  {inCart ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  ) : (
                    <button className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER: Current Bill Line Items */}
      <div className="flex-1 flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Bill Counter Header */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Current Cart</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {heldBills.length > 0 && (
              <button
                onClick={() => setShowHoldModal(true)}
                className="px-2.5 py-1 bg-amber-950/80 border border-amber-800/80 text-amber-400 text-xs font-medium rounded-lg flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Recall ({heldBills.length})
              </button>
            )}

            {cart.length > 0 && (
              <>
                <button
                  onClick={() => holdCurrentBill()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1"
                  title="Hold bill (F4)"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  Hold (F4)
                </button>
                <button
                  onClick={clearCart}
                  className="px-2.5 py-1 text-slate-400 hover:text-rose-400 text-xs font-medium rounded-lg"
                  title="Clear current cart"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table Column Headers */}
        <div className="grid grid-cols-12 px-4 py-2 bg-slate-950/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
          <span className="col-span-5">Product Name & HSN</span>
          <span className="col-span-2 text-center">Qty / Wt</span>
          <span className="col-span-2 text-right">Price</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-1 text-center"></span>
        </div>

        {/* Cart Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
          {cart.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Barcode className="w-12 h-12 mx-auto text-slate-700 mb-2 stroke-1" />
              <p className="text-sm font-medium text-slate-400">Bill is empty</p>
              <p className="text-xs text-slate-500 mt-1">Scan barcode or select grocery items from the left catalog</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 px-2 py-2 items-center rounded-lg hover:bg-slate-800/40 transition-colors text-xs"
              >
                {/* Item Name */}
                <div className="col-span-5 pr-2">
                  <p className="font-semibold text-white truncate">{item.product.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    HSN: {item.product.hsnCode} · GST {item.gstRate}%
                    {item.discountPercent > 0 && ` · Disc ${item.discountPercent}%`}
                  </p>
                </div>

                {/* Qty with +/- buttons */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  <button
                    onClick={() => updateQuantity(idx, item.quantity - (item.product.isWeighingScale ? 0.25 : 1))}
                    className="w-5 h-5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-12 text-center font-mono font-semibold text-white">
                    {item.quantity} {item.product.isWeighingScale && item.product.unit}
                  </span>
                  <button
                    onClick={() => updateQuantity(idx, item.quantity + (item.product.isWeighingScale ? 0.25 : 1))}
                    className="w-5 h-5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Unit Price */}
                <div className="col-span-2 text-right font-mono text-slate-300">
                  ₹{item.unitPrice}
                </div>

                {/* Line Total */}
                <div className="col-span-2 text-right font-mono font-bold text-emerald-400">
                  ₹{Math.round(item.total)}
                </div>

                {/* Delete button */}
                <div className="col-span-1 text-center">
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Customer Card & Payment Summary */}
      <div className="w-72 bg-slate-950 flex flex-col p-4 shrink-0 select-none border-l border-slate-800/80">
        {/* Customer Box */}
        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-400" /> Customer (F8)
            </span>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              {customer ? 'Change' : '+ Attach'}
            </button>
          </div>

          {customer ? (
            <div>
              <p className="font-semibold text-xs text-white">{customer.name}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Phone: {customer.phone}</span>
                <span className="text-amber-400 font-mono">Due: ₹{customer.outstandingBalance}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Walk-in Customer (No Khata attached)</p>
          )}
        </div>

        {/* Bill Summary Breakdown */}
        <div className="flex-1 bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2 text-xs">
            <span className="text-xs font-semibold text-slate-300 block pb-1 border-b border-slate-800">
              Billing Breakdown
            </span>

            <div className="flex justify-between text-slate-400">
              <span>Taxable Subtotal:</span>
              <span className="font-mono text-white">₹{subtotal}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Total Discount:</span>
                <span className="font-mono">-₹{discountTotal}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-400">
              <span>CGST:</span>
              <span className="font-mono text-white">₹{cgstTotal}</span>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>SGST:</span>
              <span className="font-mono text-white">₹{sgstTotal}</span>
            </div>

            {roundOff !== 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Round Off:</span>
                <span className="font-mono text-slate-300">
                  {roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}
                </span>
              </div>
            )}
          </div>

          {/* Grand Total Card */}
          <div className="bg-slate-950 p-4 rounded-xl border-2 border-emerald-500/40 text-center">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Net Payable</span>
            <div className="text-3xl font-mono font-bold text-emerald-400 my-1 tabular-nums">
              ₹{grandTotal}
            </div>
            <span className="text-[11px] text-slate-500 block">Inclusive of all taxes</span>
          </div>

          {/* Big Action: Proceed to Pay Button (F9) */}
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            <span>PAY / CHECKOUT (F9)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODALS */}
      {weighingProduct && (
        <WeighingModal
          product={weighingProduct}
          onConfirm={(p, wt) => addToCart(p, wt)}
          onClose={() => setWeighingProduct(null)}
        />
      )}

      {showCustomerModal && <CustomerSelectModal onClose={() => setShowCustomerModal(false)} />}
      {showHoldModal && <HoldBillsModal onClose={() => setShowHoldModal(false)} />}
      {showPaymentModal && <PaymentModal onClose={() => setShowPaymentModal(false)} />}
      {showReceiptModal && <ReceiptModal onClose={() => setShowReceiptModal(false)} />}
    </div>
  );
};
