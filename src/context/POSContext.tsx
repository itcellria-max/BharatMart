import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, CartItem, Customer, HeldBill, PaymentSplit } from '../types/index.ts';
import { api } from '../services/api.ts';
import { useAuth } from './AuthContext.tsx';

interface POSContextType {
  cart: CartItem[];
  customer: Customer | null;
  selectedCounter: string;
  heldBills: HeldBill[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  roundOff: number;
  grandTotal: number;
  isProcessing: boolean;
  lastInvoice: any | null;
  showPaymentModal: boolean;
  showCustomerModal: boolean;
  showHoldModal: boolean;
  showReceiptModal: boolean;
  barcodeInput: string;
  setBarcodeInput: (code: string) => void;
  setCustomer: (cust: Customer | null) => void;
  setSelectedCounter: (counterId: string) => void;
  setShowPaymentModal: (open: boolean) => void;
  setShowCustomerModal: (open: boolean) => void;
  setShowHoldModal: (open: boolean) => void;
  setShowReceiptModal: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  updateDiscount: (index: number, discountPercent: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  scanBarcode: (barcode: string) => Promise<boolean>;
  holdCurrentBill: (note?: string) => Promise<void>;
  recallBill: (bill: HeldBill) => void;
  loadHeldBills: () => Promise<void>;
  processCheckout: (payments: PaymentSplit[]) => Promise<any>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<string>('POS-01');
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Load held bills on init
  const loadHeldBills = useCallback(async () => {
    try {
      const data = await api.getHeldBills();
      setHeldBills(data);
    } catch (e) {
      console.error('Failed to load held bills:', e);
    }
  }, []);

  useEffect(() => {
    loadHeldBills();
  }, [loadHeldBills]);

  // Calculations
  const calculateTotals = useCallback(() => {
    let sub = 0;
    let disc = 0;
    let tax = 0;
    let cgst = 0;
    let sgst = 0;

    cart.forEach((item) => {
      const lineGross = item.quantity * item.unitPrice;
      const lineDisc = (lineGross * item.discountPercent) / 100;
      const taxable = lineGross - lineDisc;

      // GST calculation
      const lineTax = (taxable * item.gstRate) / (100 + (item.product.taxType === 'INCLUSIVE' ? item.gstRate : 0));
      const lineCgst = lineTax / 2;
      const lineSgst = lineTax / 2;

      sub += taxable;
      disc += lineDisc;
      tax += lineTax;
      cgst += lineCgst;
      sgst += lineSgst;
    });

    const rawGrand = sub + (cart.some((i) => i.product.taxType === 'EXCLUSIVE') ? tax : 0);
    const rounded = Math.round(rawGrand);
    const roundOffDiff = Number((rounded - rawGrand).toFixed(2));

    return {
      subtotal: Number(sub.toFixed(2)),
      discountTotal: Number(disc.toFixed(2)),
      taxTotal: Number(tax.toFixed(2)),
      cgstTotal: Number(cgst.toFixed(2)),
      sgstTotal: Number(sgst.toFixed(2)),
      roundOff: roundOffDiff,
      grandTotal: rounded,
    };
  }, [cart]);

  const { subtotal, discountTotal, taxTotal, cgstTotal, sgstTotal, roundOff, grandTotal } = calculateTotals();

  // Add product to cart
  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === product.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = product.isWeighingScale ? Number((item.quantity + quantity).toFixed(3)) : item.quantity + quantity;
        const lineGross = newQty * item.unitPrice;
        const lineDisc = (lineGross * item.discountPercent) / 100;
        const taxable = lineGross - lineDisc;
        const lineTax = (taxable * item.gstRate) / 100;

        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          discountAmount: lineDisc,
          taxAmount: lineTax,
          total: taxable + (product.taxType === 'EXCLUSIVE' ? lineTax : 0),
        };
        return updated;
      }

      const unitPrice = product.sellingPrice ?? (product as any).selling_price ?? 0;
      const gstRate = product.gstRate ?? (product as any).gst_rate ?? 5;
      const lineGross = quantity * unitPrice;
      const lineDisc = 0;
      const taxable = lineGross;
      const lineTax = (taxable * gstRate) / 100;

      const newItem: CartItem = {
        product,
        quantity,
        unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        gstRate,
        taxAmount: lineTax,
        total: taxable + (product.taxType === 'EXCLUSIVE' ? lineTax : 0),
      };

      return [newItem, ...prev];
    });
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }

    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const validQty = item.product.isWeighingScale ? Number(quantity.toFixed(3)) : Math.floor(quantity);
      const lineGross = validQty * item.unitPrice;
      const lineDisc = (lineGross * item.discountPercent) / 100;
      const taxable = lineGross - lineDisc;
      const lineTax = (taxable * item.gstRate) / 100;

      updated[index] = {
        ...item,
        quantity: validQty,
        discountAmount: lineDisc,
        taxAmount: lineTax,
        total: taxable + (item.product.taxType === 'EXCLUSIVE' ? lineTax : 0),
      };
      return updated;
    });
  };

  const updateDiscount = (index: number, discountPercent: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const validDisc = Math.min(100, Math.max(0, discountPercent));
      const lineGross = item.quantity * item.unitPrice;
      const lineDisc = (lineGross * validDisc) / 100;
      const taxable = lineGross - lineDisc;
      const lineTax = (taxable * item.gstRate) / 100;

      updated[index] = {
        ...item,
        discountPercent: validDisc,
        discountAmount: lineDisc,
        taxAmount: lineTax,
        total: taxable + (item.product.taxType === 'EXCLUSIVE' ? lineTax : 0),
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
  };

  // Barcode scanning
  const scanBarcode = async (code: string): Promise<boolean> => {
    if (!code.trim()) return false;
    try {
      const product = await api.getProductByBarcode(code.trim());
      if (product) {
        addToCart(product, 1);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Barcode not found:', code, e);
      return false;
    }
  };

  // Hold current bill
  const holdCurrentBill = async (note = '') => {
    if (cart.length === 0) return;
    const payload = {
      customer,
      items: cart,
      subtotal,
      discount: discountTotal,
      taxTotal,
      grandTotal,
      note,
    };
    await api.holdBill(payload);
    await loadHeldBills();
    clearCart();
    setShowHoldModal(false);
  };

  // Recall held bill
  const recallBill = async (bill: HeldBill) => {
    setCart(bill.items);
    setCustomer(bill.customer || null);
    await api.deleteHeldBill(bill.id);
    await loadHeldBills();
  };

  // Process checkout & payment
  const processCheckout = async (payments: PaymentSplit[]) => {
    if (cart.length === 0) throw new Error('Cart is empty');
    setIsProcessing(true);

    try {
      const payload = {
        cashierId: currentUser?.id || 'usr-3',
        cashierName: currentUser?.name || 'Priya Verma',
        counterId: selectedCounter,
        customerId: customer?.id,
        customerName: customer?.name || 'Walk-in Customer',
        customerPhone: customer?.phone,
        customerGstin: customer?.gstin,
        items: cart.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          barcode: i.product.barcode || 'NO-BARCODE',
          hsnCode: i.product.hsnCode || (i.product as any).hsn_code || '21069099',
          unit: i.product.unit || 'pc',
          quantity: i.quantity,
          mrp: i.product.mrp ?? i.unitPrice ?? 0,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount || 0,
          taxableAmount: Number((i.quantity * i.unitPrice - (i.discountAmount || 0)).toFixed(2)),
          gstRate: i.gstRate || 0,
          cgstAmount: Number(((i.taxAmount || 0) / 2).toFixed(2)),
          sgstAmount: Number(((i.taxAmount || 0) / 2).toFixed(2)),
          igstAmount: 0,
          cessAmount: 0,
          total: Number(i.total.toFixed(2)),
          batchNumber: i.batchNumber,
        })),
        payments,
        subtotal,
        discountTotal,
        cgstTotal,
        sgstTotal,
        igstTotal: 0,
        cessTotal: 0,
        taxTotal,
        roundOff,
        grandTotal,
      };

      const result = await api.checkout(payload);
      const invoiceData = {
        ...payload,
        id: result.invoiceId,
        invoiceNo: result.invoiceNo,
        invoiceDate: new Date().toISOString(),
      };

      setLastInvoice(invoiceData);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
      clearCart();
      return result;
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <POSContext.Provider
      value={{
        cart,
        customer,
        selectedCounter,
        heldBills,
        subtotal,
        discountTotal,
        taxTotal,
        cgstTotal,
        sgstTotal,
        roundOff,
        grandTotal,
        isProcessing,
        lastInvoice,
        showPaymentModal,
        showCustomerModal,
        showHoldModal,
        showReceiptModal,
        barcodeInput,
        setBarcodeInput,
        setCustomer,
        setSelectedCounter,
        setShowPaymentModal,
        setShowCustomerModal,
        setShowHoldModal,
        setShowReceiptModal,
        addToCart,
        updateQuantity,
        updateDiscount,
        removeFromCart,
        clearCart,
        scanBarcode,
        holdCurrentBill,
        recallBill,
        loadHeldBills,
        processCheckout,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) throw new Error('usePOS must be used within POSProvider');
  return context;
};
