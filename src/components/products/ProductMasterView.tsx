import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Scale,
  Edit,
  SlidersHorizontal,
  Download,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Product } from '../../types/index.ts';
import { api } from '../../services/api.ts';

export const ProductMasterView: React.FC = () => {
  const { products, categories, refreshProducts } = useStore();
  const { hasPermission, currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'lowStock' | 'scale'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockVal, setNewStockVal] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Physical stock verification audit');

  // Form state
  const [formData, setFormData] = useState<Partial<Product>>({
    barcode: '',
    sku: '',
    name: '',
    categoryId: 'cat-1',
    subcategory: '',
    brand: '',
    unit: 'pc',
    isWeighingScale: false,
    purchasePrice: 0,
    sellingPrice: 0,
    mrp: 0,
    currentStock: 50,
    minStockLevel: 10,
    maxStockLevel: 500,
    reorderLevel: 20,
    hsnCode: '21069099',
    gstRate: 5,
    taxType: 'INCLUSIVE',
  });

  const handleOpenAdd = () => {
    const randomBarcode = '890' + Math.floor(100000000 + Math.random() * 900000000);
    setFormData({
      barcode: randomBarcode,
      sku: 'SKU-' + randomBarcode.slice(-6),
      name: '',
      categoryId: categories[0]?.id || 'cat-1',
      subcategory: '',
      brand: '',
      unit: 'pc',
      isWeighingScale: false,
      purchasePrice: 0,
      sellingPrice: 0,
      mrp: 0,
      currentStock: 50,
      minStockLevel: 10,
      maxStockLevel: 500,
      reorderLevel: 20,
      hsnCode: '21069099',
      gstRate: 5,
      taxType: 'INCLUSIVE',
    });
    setShowAddModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          ...formData,
          userId: currentUser?.id,
          userName: currentUser?.name,
        } as any);
      } else {
        await api.createProduct({
          ...formData,
          userId: currentUser?.id,
          userName: currentUser?.name,
        } as any);
      }
      await refreshProducts();
      setShowAddModal(false);
      setEditingProduct(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    try {
      await api.adjustStock(adjustingProduct.id, {
        newStock: newStockVal,
        reason: adjustReason,
        userId: currentUser?.id,
        userName: currentUser?.name,
      });
      await refreshProducts();
      setAdjustingProduct(null);
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  const handleExportCsv = () => {
    const headers = ['Product ID', 'Barcode', 'SKU', 'Name', 'Category', 'Unit', 'Stock', 'Cost Price', 'Selling Price', 'MRP', 'HSN Code', 'GST Rate'];
    const rows = products.map((p) => [
      p.id,
      p.barcode,
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.categoryName || ''}"`,
      p.unit,
      p.currentStock,
      p.purchasePrice,
      p.sellingPrice,
      p.mrp,
      p.hsnCode,
      p.gstRate,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bharatmart_products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const matchType =
      filterType === 'all' ||
      (filterType === 'lowStock' && p.currentStock <= p.reorderLevel) ||
      (filterType === 'scale' && p.isWeighingScale);
    const matchSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hsnCode.includes(searchTerm);
    return matchCat && matchType && matchSearch;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Product Master & Inventory Catalog</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {products.length} registered supermarket items across all categories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          {hasPermission('MANAGE_PRODUCTS') && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Product Name, Barcode, SKU or HSN Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterType === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setFilterType('lowStock')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterType === 'lowStock' ? 'bg-amber-950 text-amber-300 font-medium' : 'text-slate-400'
            }`}
          >
            Low Stock Alerts
          </button>
          <button
            onClick={() => setFilterType('scale')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterType === 'scale' ? 'bg-sky-950 text-sky-300 font-medium' : 'text-slate-400'
            }`}
          >
            Weighing Scale Items
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 select-none">
              <tr>
                <th className="px-4 py-3">Product Name & SKU</th>
                <th className="px-3 py-3">Barcode</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3 text-right">Selling Price</th>
                <th className="px-3 py-3 text-right">MRP</th>
                {hasPermission('MODIFY_PURCHASE_COST') && <th className="px-3 py-3 text-right">Cost</th>}
                <th className="px-3 py-3 text-center">HSN / GST</th>
                <th className="px-3 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((product) => {
                const isLow = product.currentStock <= product.reorderLevel;
                const isOut = product.currentStock <= 0;

                return (
                  <tr key={product.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {product.isWeighingScale && (
                          <span title="Weighing Scale item">
                            <Scale className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-white">{product.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SKU: {product.sku} · {product.unit}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 font-mono text-slate-300">{product.barcode}</td>
                    <td className="px-3 py-3 text-slate-400">{product.categoryName || 'Grocery'}</td>

                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">
                      ₹{product.sellingPrice}
                    </td>

                    <td className="px-3 py-3 text-right font-mono text-slate-400">
                      ₹{product.mrp}
                    </td>

                    {hasPermission('MODIFY_PURCHASE_COST') && (
                      <td className="px-3 py-3 text-right font-mono text-slate-400">
                        ₹{product.purchasePrice}
                      </td>
                    )}

                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-slate-300">{product.hsnCode}</span>
                      <span className="text-[10px] text-emerald-400 block font-mono">({product.gstRate}%)</span>
                    </td>

                    <td className="px-3 py-3 text-right font-mono">
                      <span
                        className={`font-bold ${
                          isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-200'
                        }`}
                      >
                        {product.currentStock} {product.unit}
                      </span>
                      {isLow && (
                        <span className="text-[10px] text-amber-400 block">Reorder ({product.reorderLevel})</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setAdjustingProduct(product);
                            setNewStockVal(product.currentStock);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded"
                          title="Adjust physical stock"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {hasPermission('MANAGE_PRODUCTS') && (
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setFormData({
                                ...product,
                                name: product.name || '',
                                barcode: product.barcode || '',
                                sku: product.sku || '',
                                categoryId: product.categoryId || (product as any).category_id || categories[0]?.id || 'cat-1',
                                subcategory: product.subcategory || '',
                                brand: product.brand || '',
                                unit: product.unit || 'pc',
                                isWeighingScale: Boolean(product.isWeighingScale ?? (product as any).is_weighing_scale),
                                purchasePrice: product.purchasePrice ?? (product as any).purchase_price ?? 0,
                                sellingPrice: product.sellingPrice ?? (product as any).selling_price ?? 0,
                                mrp: product.mrp ?? 0,
                                currentStock: product.currentStock ?? (product as any).current_stock ?? 0,
                                minStockLevel: product.minStockLevel ?? (product as any).min_stock_level ?? 10,
                                maxStockLevel: product.maxStockLevel ?? (product as any).max_stock_level ?? 500,
                                reorderLevel: product.reorderLevel ?? (product as any).reorder_level ?? 20,
                                hsnCode: product.hsnCode || (product as any).hsn_code || '21069099',
                                gstRate: product.gstRate ?? (product as any).gst_rate ?? 5,
                                taxType: product.taxType || (product as any).tax_type || 'INCLUSIVE',
                              });
                              setShowAddModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded"
                            title="Edit product"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
              <h3 className="font-bold text-white text-base">
                {editingProduct ? 'Edit Product Details' : 'Add New Supermarket Item'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Barcode (EAN/UPC) *</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category</label>
                  <select
                    value={formData.categoryId || categories[0]?.id || 'cat-1'}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Brand / Manufacturer</label>
                  <input
                    type="text"
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unit of Measure</label>
                  <select
                    value={formData.unit || 'pc'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="pc">Piece (pc)</option>
                    <option value="pkt">Packet (pkt)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="l">Litre (L)</option>
                    <option value="ml">Millilitre (ml)</option>
                    <option value="box">Box</option>
                    <option value="btl">Bottle</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="weighingScale"
                    checked={!!formData.isWeighingScale}
                    onChange={(e) => setFormData({ ...formData, isWeighingScale: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="weighingScale" className="text-xs text-slate-300 font-medium">
                    Weighing Scale Product (Decimal quantities)
                  </label>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice ?? 0}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.sellingPrice ?? 0}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.mrp ?? 0}
                    onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Current Stock</label>
                  <input
                    type="number"
                    value={formData.currentStock ?? 0}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">HSN Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.hsnCode || ''}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">GST Rate Slab (%)</label>
                  <select
                    value={formData.gstRate ?? 5}
                    onChange={(e) => setFormData({ ...formData, gstRate: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5% (Essential Food / Spices)</option>
                    <option value={12}>12% (Ghee / Dry Fruits)</option>
                    <option value={18}>18% (Packaged / Cleaning / Soap)</option>
                    <option value={28}>28% (Beverages / Luxury)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-emerald-950"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5">
            <h3 className="font-bold text-white text-sm mb-1">Physical Stock Audit & Adjustment</h3>
            <p className="text-xs text-slate-400 mb-4">{adjustingProduct.name}</p>

            <form onSubmit={handleStockAdjust} className="space-y-3">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs flex justify-between">
                <span className="text-slate-400">Current Recorded Stock:</span>
                <span className="font-mono font-bold text-white">
                  {adjustingProduct.currentStock} {adjustingProduct.unit}
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Verified Physical Quantity:</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Adjustment Reason / Audit Note:</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
