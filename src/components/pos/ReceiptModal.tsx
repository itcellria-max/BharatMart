import React, { useState } from 'react';
import { Printer, X, Download, CheckCircle, FileText } from 'lucide-react';
import { usePOS } from '../../context/POSContext.tsx';
import { useStore } from '../../context/StoreContext.tsx';

interface ReceiptModalProps {
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ onClose }) => {
  const { lastInvoice } = usePOS();
  const { settings } = useStore();
  const [printFormat, setPrintFormat] = useState<'THERMAL' | 'A4'>('THERMAL');

  if (!lastInvoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-800 px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-white text-sm">Invoice Finalized Successfully</h3>
              <p className="text-xs text-slate-400 font-mono">{lastInvoice.invoiceNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  printFormat === 'THERMAL' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Thermal (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  printFormat === 'A4' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400'
                }`}
              >
                A4 Tax Invoice
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-950 flex justify-center">
          <div
            id="printable-receipt"
            className={`bg-white text-black p-5 shadow-2xl font-mono text-xs select-text ${
              printFormat === 'THERMAL' ? 'w-80 rounded-sm' : 'w-full max-w-lg rounded-sm text-[11px]'
            }`}
          >
            {/* Store Header */}
            <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
              <h2 className="font-bold text-sm uppercase tracking-tight">{settings?.storeName || 'BHARATMART SUPERMARKET'}</h2>
              <p className="text-[10px] text-gray-700">{settings?.addressLine1 || 'Main Market, Sector 14'}</p>
              <p className="text-[10px] text-gray-700">{settings?.city} - {settings?.pincode}</p>
              <p className="text-[10px] text-gray-700">Phone: {settings?.phone || '+91 98765 43210'}</p>
              <div className="mt-1 pt-1 border-t border-gray-200 text-[10px] flex justify-between">
                <span>GSTIN: {settings?.gstin || '07AAAAA0000A1Z5'}</span>
                <span>FSSAI: {settings?.fssaiNumber || '10019011006542'}</span>
              </div>
            </div>

            {/* Bill & Customer Metadata */}
            <div className="text-[10px] border-b border-dashed border-gray-400 pb-2 mb-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Bill No: <strong>{lastInvoice.invoiceNo}</strong></span>
                <span>Date: {new Date(lastInvoice.invoiceDate || Date.now()).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Counter: {lastInvoice.counterId}</span>
                <span>Time: {new Date(lastInvoice.invoiceDate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {lastInvoice.cashierName}</span>
                <span>Cust: {lastInvoice.customerName}</span>
              </div>
              {lastInvoice.customerPhone && (
                <div>Phone: {lastInvoice.customerPhone}</div>
              )}
            </div>

            {/* Items Table */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="grid grid-cols-12 font-bold text-[10px] border-b border-gray-300 pb-1 mb-1">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-2 text-right">Amount</span>
              </div>

              <div className="space-y-1">
                {lastInvoice.items.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 text-[10px]">
                    <div className="col-span-6 truncate font-medium">
                      {item.productName}
                      <span className="text-[8px] text-gray-500 block">HSN: {item.hsnCode} ({item.gstRate}%)</span>
                    </div>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-2 text-right">₹{item.unitPrice}</span>
                    <span className="col-span-2 text-right font-bold">₹{item.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="text-[10px] space-y-1 border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span>Subtotal (Taxable):</span>
                <span>₹{lastInvoice.subtotal}</span>
              </div>
              {lastInvoice.discountTotal > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Total Discount:</span>
                  <span>-₹{lastInvoice.discountTotal}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>CGST:</span>
                <span>₹{lastInvoice.cgstTotal}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>SGST:</span>
                <span>₹{lastInvoice.sgstTotal}</span>
              </div>
              {lastInvoice.roundOff !== 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Round Off:</span>
                  <span>{lastInvoice.roundOff > 0 ? `+₹${lastInvoice.roundOff}` : `-₹${Math.abs(lastInvoice.roundOff)}`}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-gray-400 pt-1 mt-1">
                <span>GRAND TOTAL:</span>
                <span>₹{lastInvoice.grandTotal}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-gray-400 pb-2 mb-3">
              <span className="font-bold">Payment Modes:</span>
              {lastInvoice.payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-gray-700">
                  <span>{p.mode}:</span>
                  <span>₹{p.amount}</span>
                </div>
              ))}
            </div>

            {/* Footer Greeting */}
            <div className="text-center text-[9px] text-gray-600 space-y-0.5">
              <p className="font-bold uppercase tracking-wider">{settings?.receiptFooterMessage || 'Thank you for shopping at BharatMart!'}</p>
              <p>Items once sold can be returned within 7 days with bill.</p>
              <p className="font-mono text-[8px] pt-1">*** COMPUTER GENERATED TAX INVOICE ***</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-slate-800 px-5 py-3 border-t border-slate-700 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 rounded-lg"
          >
            Start Next Bill
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
