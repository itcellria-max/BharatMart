import React, { useState } from 'react';
import {
  ShoppingBag,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  User,
  Shield,
  Monitor,
  ChevronDown,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useStore } from '../../context/StoreContext.tsx';
import { usePOS } from '../../context/POSContext.tsx';
import { UserRole } from '../../types/index.ts';

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrator',
  STORE_MANAGER: 'Store Manager',
  CASHIER: 'Cashier / Billing',
  INVENTORY_MANAGER: 'Inventory Supervisor',
  ACCOUNTANT: 'Senior Accountant',
  HR_MANAGER: 'HR Manager',
  AUDITOR: 'Auditor (Read-Only)',
};

export const Header: React.FC = () => {
  const { currentUser, role, switchRole } = useAuth();
  const { isOnline, isSyncing, offlineCount, triggerSync, notifications, dismissNotification, settings } = useStore();
  const { selectedCounter, setSelectedCounter } = usePOS();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const availableRoles: UserRole[] = [
    'SUPER_ADMIN',
    'STORE_MANAGER',
    'CASHIER',
    'INVENTORY_MANAGER',
    'ACCOUNTANT',
    'HR_MANAGER',
    'AUDITOR',
  ];

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-40 select-none">
      {/* Brand & Store Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white tracking-tight">BharatMart</span>
              <span className="text-xs bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                ERP+POS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
              {settings?.storeName || 'Supermarket & Kirana'}
            </p>
          </div>
        </div>

        {/* Counter Selector */}
        <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-800 text-xs">
          <Monitor className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
          <span className="text-slate-400 mr-1">Counter:</span>
          <select
            value={selectedCounter}
            onChange={(e) => setSelectedCounter(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="POS-01">Counter 1 (Main Entrance)</option>
            <option value="POS-02">Counter 2 (Express Grocery)</option>
            <option value="POS-03">Counter 3 (Dairy & Loose Grains)</option>
            <option value="POS-04">Counter 4 (Wholesale / Bulk)</option>
          </select>
        </div>
      </div>

      {/* Center Status: Online / Syncing / Offline status */}
      <div className="flex items-center gap-3">
        {isOnline ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            <Wifi className="w-3.5 h-3.5" />
            <span className="font-medium">Online</span>
            {offlineCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="ml-1 text-[11px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded flex items-center gap-1"
                title="Synchronize offline bills"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync ({offlineCount})</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-full animate-pulse">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="font-medium">Offline Billing Mode</span>
            {offlineCount > 0 && (
              <span className="text-[11px] bg-amber-800 text-white px-1.5 py-0.2 rounded font-mono">
                {offlineCount} queued
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Notifications & User Role Switcher */}
      <div className="flex items-center gap-2">
        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg relative transition-colors"
            title="Notifications & Alerts"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-200">Alerts & System Notifications</span>
                <span className="text-slate-400 font-mono text-[11px]">{notifications.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 mt-1">
                {notifications.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No new alerts</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="py-2 flex items-start gap-2 justify-between">
                      <div className="flex items-start gap-2">
                        {n.type === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-slate-200">{n.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{n.message}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">{n.time}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => dismissNotification(n.id)}
                        className="text-slate-400 hover:text-slate-300 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role & Cashier Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-left hidden sm:block">
              <p className="font-semibold text-white leading-tight">{currentUser?.name || 'User'}</p>
              <p className="text-[10px] text-slate-400">{ROLE_LABELS[role] || role}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Switch Role / Cashier
              </div>
              <div className="py-1">
                {availableRoles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      switchRole(r);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                      role === r ? 'bg-emerald-950/60 text-emerald-400 font-semibold border border-emerald-800/40' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{ROLE_LABELS[r]}</span>
                    {role === r && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
