import React, { useState, useEffect } from 'react';
import { Settings, Save, Download, Database, CheckCircle2, RefreshCw } from 'lucide-react';
import { useStore } from '../../context/StoreContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { StoreSettings } from '../../types/index.ts';

export const SettingsView: React.FC = () => {
  const { settings, refreshSettings } = useStore();
  const { currentUser } = useAuth();

  const [form, setForm] = useState<StoreSettings>({
    storeName: 'BharatMart Supermarket & Kirana',
    tagline: 'Fresh Provisions, Daily Essentials & Wholesale Kirana',
    addressLine1: 'Plot No. 42-45, Central Commercial Complex',
    addressLine2: 'Near Metro Station, Sector 14',
    city: 'New Delhi',
    state: 'Delhi (07)',
    pincode: '110078',
    phone: '+91 98765 43210',
    email: 'contact@bharatmart.in',
    gstin: '07AAAAA0000A1Z5',
    fssaiNumber: '10019011006542',
    panNumber: 'AAAAA0000A',
    upiId: 'bharatmart@upi',
    upiPayeeName: 'BharatMart Supermarket',
    currencySymbol: '₹',
    receiptFooterMessage: 'Thank you for shopping at BharatMart! Returns accepted within 7 days with original invoice.',
    enableLoyalty: true,
    loyaltyEarnRate: 100,
    loyaltyRedeemValue: 1,
    autoBackupDaily: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm((prev) => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.saveSettings({
        ...form,
        userId: currentUser?.id,
        userName: currentUser?.name,
      } as any);
      await refreshSettings();
      alert('Store settings saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/backup/export';
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Supermarket Administration & Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">Store credentials, GSTIN registration, UPI configuration, and database backup</p>
        </div>
        <button
          onClick={handleDownloadBackup}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950"
        >
          <Database className="w-4 h-4" />
          Download SQLite Database Backup
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Profile */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-semibold text-sm text-white">Store Identity & Statutory Registration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Store Name *</label>
              <input
                type="text"
                required
                value={form.storeName || ''}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Tagline / Subtitle</label>
              <input
                type="text"
                value={form.tagline || ''}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">GSTIN Number *</label>
              <input
                type="text"
                required
                value={form.gstin || ''}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">FSSAI License Number *</label>
              <input
                type="text"
                required
                value={form.fssaiNumber || ''}
                onChange={(e) => setForm({ ...form, fssaiNumber: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Contact Phone *</label>
              <input
                type="text"
                required
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Official Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="text-slate-400 block mb-1">Store Address *</label>
              <input
                type="text"
                required
                value={form.addressLine1 || ''}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">City & Pincode *</label>
              <input
                type="text"
                required
                value={`${form.city || ''} - ${form.pincode || ''}`}
                onChange={(e) => {
                  const parts = e.target.value.split('-');
                  setForm({ ...form, city: parts[0]?.trim() || '', pincode: parts[1]?.trim() || '' });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* UPI Payments & Receipt */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-semibold text-sm text-white">POS Dynamic UPI QR & Receipt Footer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Store UPI VPA Address (for QR Generation) *</label>
              <input
                type="text"
                required
                value={form.upiId || ''}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-500 block mt-1">Customers scan this QR code directly at billing counter.</span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">UPI Payee Registered Name *</label>
              <input
                type="text"
                required
                value={form.upiPayeeName || ''}
                onChange={(e) => setForm({ ...form, upiPayeeName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Receipt Footer Terms & Greeting</label>
              <input
                type="text"
                value={form.receiptFooterMessage || ''}
                onChange={(e) => setForm({ ...form, receiptFooterMessage: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Configuration Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
