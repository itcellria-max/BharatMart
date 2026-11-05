import React from 'react';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  Receipt,
  Users,
  Truck,
  FileSpreadsheet,
  Coins,
  UserCheck,
  TrendingDown,
  Barcode,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useStore } from '../../context/StoreContext.tsx';

export type NavTab =
  | 'pos'
  | 'dashboard'
  | 'products'
  | 'grocery'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'purchases'
  | 'gst'
  | 'counters'
  | 'staff'
  | 'expenses'
  | 'barcodes'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { hasPermission } = useAuth();
  const { lowStockCount } = useStore();

  const navItems = [
    { id: 'pos' as NavTab, label: 'POS Billing', icon: ShoppingCart, highlight: true, permission: 'POS_BILLING' },
    { id: 'dashboard' as NavTab, label: 'Main Dashboard', icon: LayoutDashboard, permission: 'VIEW_DASHBOARD' },
    { id: 'products' as NavTab, label: 'Product Master', icon: Package, permission: 'MANAGE_PRODUCTS' },
    { id: 'grocery' as NavTab, label: 'Kirana & Grocery', icon: Layers, permission: 'MANAGE_PRODUCTS' },
    { id: 'inventory' as NavTab, label: 'Inventory & Alerts', icon: Boxes, badge: lowStockCount > 0 ? lowStockCount : undefined, permission: 'INVENTORY_CONTROL' },
    { id: 'sales' as NavTab, label: 'Sales & Returns', icon: Receipt, permission: 'POS_BILLING' },
    { id: 'customers' as NavTab, label: 'Customer Khata', icon: Users, permission: 'VIEW_DASHBOARD' },
    { id: 'purchases' as NavTab, label: 'Purchase & Vendors', icon: Truck, permission: 'INVENTORY_CONTROL' },
    { id: 'gst' as NavTab, label: 'GST & Tax Center', icon: FileSpreadsheet, permission: 'MANAGE_GST' },
    { id: 'counters' as NavTab, label: 'Cash Counters', icon: Coins, permission: 'POS_BILLING' },
    { id: 'staff' as NavTab, label: 'Staff & Duty', icon: UserCheck, permission: 'STAFF_MANAGEMENT' },
    { id: 'expenses' as NavTab, label: 'Expenses & Margin', icon: TrendingDown, permission: 'FINANCIAL_REPORTS' },
    { id: 'barcodes' as NavTab, label: 'Barcode Generator', icon: Barcode, permission: 'MANAGE_PRODUCTS' },
    { id: 'audit' as NavTab, label: 'Audit Trail', icon: ShieldAlert, permission: 'VIEW_AUDIT_LOGS' },
    { id: 'settings' as NavTab, label: 'Store Settings', icon: Settings, permission: 'SYSTEM_SETTINGS' },
  ];

  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0 select-none">
      <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isAllowed = hasPermission(item.permission);

          if (!isAllowed) return null;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? item.highlight
                    ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950'
                    : 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? (item.highlight ? 'text-white' : 'text-emerald-400') : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-mono rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* POS Quick Shortcuts Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400">
        <p className="font-semibold text-slate-300 mb-1">Keyboard Shortcuts</p>
        <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
          <div><span className="text-emerald-400">F2:</span> Scan Barcode</div>
          <div><span className="text-emerald-400">F4:</span> Hold Bill</div>
          <div><span className="text-emerald-400">F8:</span> Add Customer</div>
          <div><span className="text-emerald-400">F9:</span> Pay/Checkout</div>
        </div>
      </div>
    </aside>
  );
};
