import {
  Product,
  Category,
  Customer,
  Supplier,
  SalesInvoice,
  PurchaseInvoice,
  StoreSettings,
  AuditLog,
  CashCounter,
  CashierSession,
  Staff,
  StaffAttendance,
  Expense,
  HeldBill,
  GstRateChangeLog,
} from '../types/index.ts';

const API_BASE = '/api';

// Offline transaction queue key
const OFFLINE_QUEUE_KEY = 'bharatmart_offline_queue';

export function getOfflineQueue(): any[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToOfflineQueue(tx: any) {
  const queue = getOfflineQueue();
  queue.push({ ...tx, queuedAt: new Date().toISOString() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: any[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(`${API_BASE}/pos/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        synced++;
      } else {
        remaining.push(item);
        failed++;
      }
    } catch {
      remaining.push(item);
      failed++;
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return { synced, failed };
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getUsers: () => request<any[]>('/auth/users'),

  // Dashboard
  getDashboard: () =>
    request<{
      today: { sales: number; bills: number; tax: number; discount: number };
      paymentModes: { mode: string; total: number }[];
      stock: { value: number; lowStock: number; outOfStock: number; expiringSoon: number };
      customerCredit: number;
      supplierPayable: number;
      todayExpenses: number;
      weeklySales: { day: string; sales: number; bills: number }[];
      topProducts: any[];
    }>('/reports/dashboard'),

  // Products
  getProducts: (params?: { search?: string; category?: string; lowStock?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.lowStock) query.set('lowStock', 'true');
    return request<Product[]>(`/products?${query.toString()}`);
  },

  getProductByBarcode: (barcode: string) =>
    request<Product>(`/products/barcode/${encodeURIComponent(barcode)}`),

  createProduct: (product: Partial<Product>) =>
    request<{ id: string; message: string }>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),

  updateProduct: (id: string, product: Partial<Product>) =>
    request<{ message: string }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    }),

  adjustStock: (id: string, data: { newStock: number; reason: string; userId?: string; userName?: string }) =>
    request<{ message: string; oldStock: number; newStock: number }>(`/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Categories
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (cat: { name: string; description?: string }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(cat) }),

  // POS & Invoicing
  checkout: async (billData: any) => {
    try {
      return await request<{ invoiceId: string; invoiceNo: string; grandTotal: number }>('/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(billData),
      });
    } catch (err) {
      // If network error, queue for offline sync
      if (!navigator.onLine || (err as any).message?.includes('Failed to fetch')) {
        saveToOfflineQueue(billData);
        return {
          invoiceId: 'offline-' + Date.now(),
          invoiceNo: 'BM-OFFLINE-' + Math.floor(1000 + Math.random() * 9000),
          grandTotal: billData.grandTotal,
          isOffline: true,
        };
      }
      throw err;
    }
  },

  holdBill: (data: any) =>
    request<{ id: string; message: string }>('/pos/hold-bill', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHeldBills: () => request<HeldBill[]>('/pos/held-bills'),
  deleteHeldBill: (id: string) => request<{ message: string }>(`/pos/held-bills/${id}`, { method: 'DELETE' }),

  getInvoices: (params?: { search?: string; date?: string; customerId?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.date) q.set('date', params.date);
    if (params?.customerId) q.set('customerId', params.customerId);
    return request<SalesInvoice[]>(`/invoices?${q.toString()}`);
  },

  getInvoiceById: (id: string) => request<SalesInvoice>(`/invoices/${id}`),

  returnInvoiceItem: (invoiceId: string, data: any) =>
    request<{ returnNo: string; refundAmount: number }>(`/invoices/${invoiceId}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Customers & Khata
  getCustomers: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<Customer[]>(`/customers${q}`);
  },

  createCustomer: (customer: Partial<Customer>) =>
    request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    }),

  getCustomerKhata: (id: string) =>
    request<{ customer: Customer; ledger: any[] }>(`/customers/${id}/khata`),

  recordKhataPayment: (customerId: string, data: any) =>
    request<{ message: string; balanceAfter: number }>(`/customers/${customerId}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Suppliers & Purchases
  getSuppliers: () => request<Supplier[]>('/suppliers'),
  createSupplier: (supplier: Partial<Supplier>) =>
    request<{ id: string; message: string }>('/suppliers', { method: 'POST', body: JSON.stringify(supplier) }),

  getPurchases: () => request<PurchaseInvoice[]>('/purchases'),
  createPurchase: (data: any) =>
    request<{ message: string }>('/purchases', { method: 'POST', body: JSON.stringify(data) }),

  // GST
  getGstSummary: () => request<{ rateSummary: any[]; hsnSummary: any[] }>('/gst/rates-summary'),
  getGstHistory: () => request<GstRateChangeLog[]>('/gst/history'),
  updateProductTax: (data: any) =>
    request<{ message: string }>('/gst/update-product-tax', { method: 'POST', body: JSON.stringify(data) }),

  // Cash Counters
  getCounters: () => request<CashCounter[]>('/counters'),
  getCashierSession: (cashierId: string) => request<CashierSession | null>(`/counters/session/${cashierId}`),
  openCashierSession: (data: any) =>
    request<{ sessionId: string; message: string }>('/counters/session/open', { method: 'POST', body: JSON.stringify(data) }),
  closeCashierSession: (data: any) =>
    request<{ message: string; expectedCash: number; actualCash: number; difference: number }>('/counters/session/close', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Staff & Attendance
  getStaff: () => request<Staff[]>('/staff'),
  getTodayAttendance: () => request<StaffAttendance[]>('/staff/attendance/today'),
  recordAttendance: (data: any) =>
    request<{ message: string }>('/staff/attendance', { method: 'POST', body: JSON.stringify(data) }),

  // Expenses
  getExpenses: () => request<Expense[]>('/expenses'),
  createExpense: (expense: Partial<Expense>) =>
    request<{ id: string; receiptNumber: string }>('/expenses', { method: 'POST', body: JSON.stringify(expense) }),

  // Audit Logs
  getAuditLogs: () => request<AuditLog[]>('/audit-logs'),

  // Settings
  getSettings: () => request<StoreSettings>('/settings'),
  saveSettings: (settings: Partial<StoreSettings>) =>
    request<{ message: string }>('/settings', { method: 'POST', body: JSON.stringify(settings) }),
};
