export type UserRole =
  | 'SUPER_ADMIN'
  | 'STORE_MANAGER'
  | 'CASHIER'
  | 'INVENTORY_MANAGER'
  | 'ACCOUNTANT'
  | 'HR_MANAGER'
  | 'AUDITOR';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  avatarUrl?: string;
  assignedCounterId?: string;
  permissions?: string[];
}

export interface Unit {
  id: string;
  name: string;
  code: 'kg' | 'g' | 'l' | 'ml' | 'pc' | 'pkt' | 'box' | 'btl' | 'doz';
  isDecimal: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  itemCount?: number;
}

export interface ProductBatch {
  id: string;
  productId: string;
  batchNumber: string;
  mfgDate?: string;
  expiryDate: string;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  quantity: number;
}

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  subcategory?: string;
  brand?: string;
  unit: string; // kg, g, pc, pkt, etc.
  packSize?: string;
  isWeighingScale: boolean; // decimal quantity enabled
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  wholesalePrice?: number;
  minSellingPrice?: number;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderLevel: number;
  hsnCode: string;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  taxType: 'INCLUSIVE' | 'EXCLUSIVE';
  cessRate?: number;
  supplierId?: string;
  supplierName?: string;
  active: boolean;
  batches?: ProductBatch[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  taxAmount: number;
  total: number;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface HeldBill {
  id: string;
  heldAt: string;
  customer?: Customer;
  items: CartItem[];
  subtotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  note?: string;
}

export interface PaymentSplit {
  mode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER';
  amount: number;
  referenceNo?: string;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  cashierId: string;
  cashierName: string;
  counterId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  items: SalesInvoiceItem[];
  subtotal: number;
  discountTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  payments: PaymentSplit[];
  paymentStatus: 'PAID' | 'PARTIAL' | 'CREDIT' | 'REFUNDED' | 'CANCELLED';
  status: 'COMPLETED' | 'CANCELLED' | 'RETURNED';
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  notes?: string;
}

export interface SalesInvoiceItem {
  id?: string;
  invoiceId?: string;
  productId: string;
  productName: string;
  barcode: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  total: number;
  batchNumber?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  customerType: 'WALK_IN' | 'RETAIL' | 'WHOLESALE' | 'BUSINESS';
  creditLimit: number;
  outstandingBalance: number;
  openingBalance: number;
  loyaltyPoints: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
  createdAt: string;
}

export interface CustomerKhataTransaction {
  id: string;
  customerId: string;
  date: string;
  type: 'CREDIT_SALE' | 'PAYMENT_RECEIVED' | 'RETURN_CREDIT' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  referenceNo?: string;
  notes?: string;
  recordedBy: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  paymentTerms?: string;
  creditPeriodDays: number;
  outstandingBalance: number;
  openingBalance: number;
  createdAt: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  items: PurchaseItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  status: 'RECEIVED' | 'DRAFT' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  barcode: string;
  hsnCode: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  freeQuantity: number;
  unitPrice: number;
  mrp: number;
  sellingPrice: number;
  discountAmount: number;
  gstRate: number;
  taxAmount: number;
  total: number;
}

export interface GstRateChangeLog {
  id: string;
  productId: string;
  productName: string;
  oldHsn: string;
  newHsn: string;
  oldRate: number;
  newRate: number;
  effectiveDate: string;
  changedBy: string;
  createdAt: string;
  reason: string;
  referenceNote?: string;
}

export interface CashCounter {
  id: string;
  name: string;
  code: string;
  currentCashierId?: string;
  currentCashierName?: string;
  activeSessionId?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface CashierSession {
  id: string;
  counterId: string;
  counterName: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  creditSales: number;
  totalSales: number;
  cashRefunds: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface Staff {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  email?: string;
  designation: string;
  department: string;
  joiningDate: string;
  salary: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
  userRole?: UserRole;
  systemUserId?: string;
}

export interface StaffAttendance {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  inTime?: string;
  outTime?: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WEEKLY_OFF';
  workingHours?: number;
  overtimeHours?: number;
  notes?: string;
}

export interface ShiftRoster {
  id: string;
  staffId: string;
  staffName: string;
  counterId?: string;
  counterName?: string;
  date: string;
  shiftName: 'Morning' | 'General' | 'Afternoon' | 'Evening' | 'Night';
  startTime: string;
  endTime: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  description: string;
  authorizedBy: string;
  receiptNumber?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  fssaiNumber: string;
  panNumber: string;
  upiId: string;
  upiPayeeName: string;
  currencySymbol: string;
  receiptFooterMessage: string;
  enableLoyalty: boolean;
  loyaltyEarnRate: number; // Rs spent per 1 point
  loyaltyRedeemValue: number; // Rs value of 1 point
  autoBackupDaily: boolean;
}
