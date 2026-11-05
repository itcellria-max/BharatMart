import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { StoreProvider, useStore } from './context/StoreContext.tsx';
import { POSProvider } from './context/POSContext.tsx';
import { Header } from './components/layout/Header.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { POSScreen } from './components/pos/POSScreen.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { ProductMasterView } from './components/products/ProductMasterView.tsx';
import { GroceryView } from './components/grocery/GroceryView.tsx';
import { InventoryView } from './components/inventory/InventoryView.tsx';
import { SalesView } from './components/sales/SalesView.tsx';
import { CustomerKhataView } from './components/customers/CustomerKhataView.tsx';
import { PurchaseView } from './components/purchases/PurchaseView.tsx';
import { GstCenterView } from './components/gst/GstCenterView.tsx';
import { CashCounterView } from './components/counters/CashCounterView.tsx';
import { StaffAttendanceView } from './components/staff/StaffAttendanceView.tsx';
import { ExpensesView } from './components/expenses/ExpensesView.tsx';
import { BarcodeLabelView } from './components/barcodes/BarcodeLabelView.tsx';
import { AuditLogsView } from './components/audit/AuditLogsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('pos');
  const { isLoading } = useStore();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-bold mb-4 shadow-xl shadow-emerald-950/80 animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">BharatMart ERP & POS</h1>
        <p className="text-xs text-slate-500 mt-1 font-mono">Initializing Supermarket SQLite Database...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-900 text-slate-100 font-sans">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'pos' && <POSScreen />}
          {activeTab === 'dashboard' && <DashboardView onNavigateToTab={(tab) => setActiveTab(tab as NavTab)} />}
          {activeTab === 'products' && <ProductMasterView />}
          {activeTab === 'grocery' && <GroceryView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'sales' && <SalesView />}
          {activeTab === 'customers' && <CustomerKhataView />}
          {activeTab === 'purchases' && <PurchaseView />}
          {activeTab === 'gst' && <GstCenterView />}
          {activeTab === 'counters' && <CashCounterView />}
          {activeTab === 'staff' && <StaffAttendanceView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'barcodes' && <BarcodeLabelView />}
          {activeTab === 'audit' && <AuditLogsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <POSProvider>
          <AppContent />
        </POSProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
