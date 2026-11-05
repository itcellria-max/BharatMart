import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Boxes,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Banknote,
  QrCode,
  BookOpen,
  DollarSign,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.ts';

export const DashboardView: React.FC<{ onNavigateToTab?: (tab: string) => void }> = ({ onNavigateToTab }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mr-2" />
        Loading Supermarket Dashboard...
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-900">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Supermarket Executive Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time sales, inventory valuation, and Kirana operations</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Today's Gross Sales</span>
            <div className="p-2 bg-emerald-950/60 rounded-xl text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-mono font-bold text-white tabular-nums">
              ₹{data.today.sales.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>{data.today.bills} bills completed</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-mono">Tax: ₹{data.today.tax}</span>
            </div>
          </div>
        </div>

        {/* Current Stock Valuation */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Inventory Valuation</span>
            <div className="p-2 bg-sky-950/60 rounded-xl text-sky-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-mono font-bold text-white tabular-nums">
              ₹{data.stock.value.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-2 mt-1 text-[11px]">
              <span className="text-amber-400 font-medium">{data.stock.lowStock} Low Stock</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400 font-medium">{data.stock.outOfStock} Out of Stock</span>
            </div>
          </div>
        </div>

        {/* Customer Khata Outstanding */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Customer Khata Due</span>
            <div className="p-2 bg-amber-950/60 rounded-xl text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums">
              ₹{data.customerCredit.toLocaleString('en-IN')}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">Total pending customer credit</div>
          </div>
        </div>

        {/* Supplier Payables */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Supplier Payables</span>
            <div className="p-2 bg-purple-950/60 rounded-xl text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-mono font-bold text-slate-200 tabular-nums">
              ₹{data.supplierPayable.toLocaleString('en-IN')}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">Pending payments to mandi & FMCG</div>
          </div>
        </div>
      </div>

      {/* Payment Modes & Sales Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Payment Modes Today */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <h3 className="font-semibold text-sm text-white mb-3">Today's Payment Methods</h3>
          <div className="space-y-3">
            {data.paymentModes.map((p: any) => {
              const icons: Record<string, any> = {
                CASH: Banknote,
                UPI: QrCode,
                CARD: CreditCard,
                CREDIT: BookOpen,
              };
              const Icon = icons[p.mode] || Banknote;
              const pct = data.today.sales > 0 ? Math.round((p.total / data.today.sales) * 100) : 0;

              return (
                <div key={p.mode} className="p-3 bg-slate-900 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-slate-200">{p.mode}</span>
                    </div>
                    <span className="font-mono font-bold text-white">₹{p.total} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7-Day Sales Trend */}
        <div className="lg:col-span-2 bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-white">Recent Sales Performance</h3>
            <span className="text-xs text-slate-400 font-mono">Past 7 Days</span>
          </div>

          <div className="h-44 flex items-end gap-3 pt-4 px-2">
            {data.weeklySales.map((w: any, idx: number) => {
              const maxVal = Math.max(...data.weeklySales.map((s: any) => s.sales), 10000);
              const heightPct = Math.max(15, Math.round((w.sales / maxVal) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    ₹{w.sales}
                  </span>
                  <div
                    className="w-full bg-emerald-600/80 group-hover:bg-emerald-500 rounded-t-lg transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-slate-400 font-mono truncate w-full text-center">
                    {w.day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Selling Products & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Selling Items */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <h3 className="font-semibold text-sm text-white mb-3">Top Moving Supermarket Items</h3>
          <div className="divide-y divide-slate-800/80">
            {data.topProducts.map((p: any, idx: number) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 font-mono text-[11px] text-slate-400 flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{p.product_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{p.qty} units sold</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-emerald-400">₹{p.revenue}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Alerts */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-white mb-3">Critical Operational Alerts</h3>
            <div className="space-y-2.5">
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-200">
                    {data.stock.lowStock} Products at Reorder Level
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Essential staples (Atta, Dal, Mustard Oil) need replenishment from suppliers.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-rose-200">
                    {data.stock.expiringSoon} Batches Expiring in 30 Days
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dairy and bakery items nearing expiry date. Put on clearance or return to vendor.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Counter Synchronization:</span>
            <span className="text-emerald-400 font-mono">Live Multi-Counter Sync Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
