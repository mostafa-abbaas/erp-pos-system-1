'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { productsApi, salesApi, shiftsApi } from '@/lib/api';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import {
  Search, Trash2, Plus, Minus, ShoppingCart,
  Banknote, X, Check, Printer, RefreshCw, AlertCircle,
  Loader2, Package, CreditCard, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── USB Barcode Scanner Hook ────────────────────────────────────────────────
function useBarcodeScanner(onScan: (barcode: string) => void, enabled = true) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) onScanRef.current(bufferRef.current);
        bufferRef.current = '';
        clearTimeout(timerRef.current);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { bufferRef.current = ''; }, 80);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(timerRef.current); };
  }, [enabled]);
}

// ─── Thermal Receipt Component ───────────────────────────────────────────────
function ThermalReceipt({ sale, onClose }: { sale: any; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>Receipt ${sale.invoice_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Arial', monospace;
    font-size: 12px;
    width: 80mm;
    padding: 4mm;
    background: #fff;
    color: #000;
    direction: rtl;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .large { font-size: 15px; }
  .small { font-size: 10px; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .total-row { font-size: 14px; font-weight: bold; border-top: 2px solid #000; margin-top: 4px; padding-top: 4px; display: flex; justify-content: space-between; }
  .item { margin: 3px 0; }
  .item-detail { color: #555; font-size: 10px; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { padding: 2mm; }
  }
</style>
</head>
<body>${content}<script>window.onload=()=>{window.print();window.close();}<\/script></body>
</html>`);
    win.document.close();
  };

  const now = new Date(sale.created_at || Date.now());
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
        {/* Action bar */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-slate-800">معاينة الإيصال</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="p-4">
          <div
            ref={printRef}
            style={{ fontFamily: "'Courier New', Arial, monospace", fontSize: 12, direction: 'rtl', background: '#fff', color: '#000', padding: 8 }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>نظام قطع غيار الأجهزة</div>
              <div style={{ fontSize: 10, color: '#666' }}>Home Appliance Spare Parts</div>
              <div style={{ fontSize: 10 }}>{sale.branch?.name || ''}</div>
              <div style={{ fontSize: 10 }}>هاتف: 01000000000</div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Invoice info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
              <span>رقم الفاتورة:</span>
              <span style={{ fontWeight: 'bold' }}>{sale.invoice_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
              <span>التاريخ:</span><span>{dateStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
              <span>الوقت:</span><span>{timeStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
              <span>الكاشير:</span><span>{sale.cashier?.fullName || '—'}</span>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items */}
            <div style={{ marginBottom: 8 }}>
              {(sale.items || []).map((item: any, idx: number) => (
                <div key={idx} style={{ marginBottom: 4 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 11 }}>{item.product?.name || item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span>{item.quantity} × {formatCurrency(Number(item.unit_price))}</span>
                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(Number(item.total))}</span>
                  </div>
                  {Number(item.discount_pct) > 0 && (
                    <div style={{ fontSize: 9, color: '#666' }}>خصم {item.discount_pct}%</div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span>الإجمالي قبل الخصم:</span>
              <span>{formatCurrency(Number(sale.subtotal))}</span>
            </div>
            {Number(sale.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, color: '#16a34a' }}>
                <span>الخصم:</span>
                <span>- {formatCurrency(Number(sale.discount_amount))}</span>
              </div>
            )}
            {Number(sale.tax_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span>الضريبة:</span>
                <span>{formatCurrency(Number(sale.tax_amount))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 15, borderTop: '2px solid #000', paddingTop: 4, marginTop: 4 }}>
              <span>الإجمالي:</span>
              <span>{formatCurrency(Number(sale.total))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3 }}>
              <span>طريقة الدفع:</span>
              <span>{PAYMENT_METHOD_LABELS[sale.payment_method] || sale.payment_method}</span>
            </div>
            {Number(sale.amount_paid) > Number(sale.total) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3 }}>
                  <span>المبلغ المدفوع:</span>
                  <span>{formatCurrency(Number(sale.amount_paid))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3, fontWeight: 'bold' }}>
                  <span>الباقي:</span>
                  <span>{formatCurrency(Number(sale.amount_paid) - Number(sale.total))}</span>
                </div>
              </>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
              <div>شكراً لتعاملكم معنا</div>
              <div>Thank you for your business</div>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 9 }}>
                #{sale.invoice_number}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────
function CheckoutModal({ open, onClose, onSuccess, branchId, shiftId }: any) {
  const cart = useCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const total = cart.total();
  const change = cart.change();

  const handleCheckout = async () => {
    if (cart.items.length === 0) { setError('السلة فارغة'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        branchId,
        shiftId: shiftId || undefined,
        paymentMethod: cart.paymentMethod,
        amountPaid: cart.amountPaid || total,
        discountAmount: cart.discountAmount || (total * cart.discountPct / 100) || 0,
        discountPct: cart.discountPct,
        notes: cart.notes || undefined,
        customerId: cart.customerId || undefined,
        items: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPct: i.discountPct,
        })),
      };
      const res: any = await salesApi.create(payload);
      cart.clearCart();
      onSuccess(res.data);
    } catch (e: any) {
      setError(e.message || 'فشل إتمام البيع');
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold text-slate-800">إتمام البيع</h3>
          <button onClick={onClose} disabled={loading}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Total */}
          <div className="bg-blue-50 rounded-2xl p-4 text-center">
            <p className="text-sm text-blue-600 font-medium mb-1">الإجمالي المطلوب</p>
            <p className="text-4xl font-black text-blue-700">{formatCurrency(total)}</p>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">طريقة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => cart.setPaymentMethod(m)}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-semibold border-2 transition',
                    cart.paymentMethod === m
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  {m === 'CASH' ? '💵 نقد' : m === 'CARD' ? '💳 بطاقة' : '🏦 تحويل'}
                </button>
              ))}
            </div>
          </div>

          {/* Amount paid (cash only) */}
          {cart.paymentMethod === 'CASH' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">المبلغ المستلم</label>
              <input
                type="number"
                step="0.01"
                min={total}
                value={cart.amountPaid || ''}
                onChange={(e) => cart.setAmountPaid(parseFloat(e.target.value) || 0)}
                placeholder={String(total.toFixed(2))}
                className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                autoFocus
              />
              {cart.amountPaid >= total && cart.amountPaid > 0 && (
                <div className="mt-2 text-center bg-green-50 rounded-xl py-2">
                  <span className="text-sm font-medium text-green-600">الباقي: </span>
                  <span className="text-lg font-black text-green-700">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick amounts */}
          {cart.paymentMethod === 'CASH' && (
            <div className="grid grid-cols-4 gap-1.5">
              {[50, 100, 200, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => cart.setAmountPaid(amt)}
                  className="py-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition text-slate-700"
                >
                  {amt}
                </button>
              ))}
            </div>
          )}

          {/* Discount */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">خصم إضافي (جنيه)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={cart.discountAmount || ''}
              onChange={(e) => cart.setGlobalDiscount(0, parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
              placeholder="0.00"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} disabled={loading} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50">
            إلغاء
          </button>
          <button
            onClick={handleCheckout}
            disabled={loading || cart.items.length === 0}
            className="flex-2 flex-grow-[2] py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-lg"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {loading ? 'جاري البيع...' : 'تأكيد البيع'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Page ────────────────────────────────────────────────────────────
export default function POSPage() {
  const { user } = useAuthStore();
  const cart = useCartStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [scanError, setScanError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const branchId = user?.branchId || '';

  // Active shift
  const { data: activeShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: () => shiftsApi.active().then((r: any) => r.data),
    refetchInterval: 60000,
  });

  // Barcode scan handler
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setScanError('');
    try {
      const res: any = await productsApi.byBarcode(barcode);
      cart.addItem({
        ...res.data,
        internalCode: res.data.internal_code,
        nameAr: res.data.name_ar,
        sellingPrice: res.data.selling_price,
        taxRate: res.data.tax_rate,
      });
    } catch {
      setScanError(`لم يُعثر على باركود: ${barcode}`);
      setTimeout(() => setScanError(''), 3000);
    }
  }, [cart]);

  useBarcodeScanner(handleBarcodeScan, !showCheckout);

  // Product search
  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res: any = await productsApi.list({ search: q, limit: 12, isActive: true });
      setSearchResults(res.items || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const addProductToCart = (product: any) => {
    cart.addItem({
      ...product,
      internalCode: product.internal_code,
      nameAr: product.name_ar,
      sellingPrice: product.selling_price,
      taxRate: product.tax_rate,
    });
    setSearch('');
    setSearchResults([]);
    searchRef.current?.focus();
  };

  const handleSaleSuccess = async (sale: any) => {
    setShowCheckout(false);
    // Fetch full sale with items for receipt
    try {
      const full: any = await salesApi.byId(sale.id);
      setCompletedSale(full.data);
    } catch { setCompletedSale(sale); }
    qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const subtotal = cart.subtotal();
  const tax = cart.taxTotal();
  const discountAmt = cart.discountAmount;
  const total = cart.total();

  return (
    <div className="pos-grid" dir="rtl">
      {/* ── Left: Product search & results ── */}
      <div className="flex flex-col bg-slate-50 border-l border-slate-200 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm"
              placeholder="ابحث بالاسم أو الكود أو امسح الباركود..."
              autoComplete="off"
            />
            {searching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
          </div>
          {scanError && (
            <div className="mt-2 flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}
          {/* Shift warning */}
          {!activeShift && (
            <div className="mt-2 flex items-center gap-2 text-amber-700 text-xs bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
              <AlertCircle className="w-3 h-3 shrink-0" /> لا توجد وردية مفتوحة — اذهب إلى الورديات لفتح وردية جديدة
            </div>
          )}
        </div>

        {/* Search results grid */}
        <div className="flex-1 overflow-auto p-4">
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProductToCart(p)}
                  className="bg-white border border-slate-200 rounded-2xl p-3 text-right hover:border-blue-400 hover:shadow-md transition-all active:scale-95 group"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-blue-100">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{p.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{p.internal_code}</p>
                  <p className="text-sm font-black text-blue-600 mt-1.5">{formatCurrency(Number(p.selling_price))}</p>
                </button>
              ))}
            </div>
          ) : search.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Search className="w-16 h-16 opacity-20 mb-4" />
              <p className="text-lg font-medium">ابحث عن منتج أو امسح الباركود</p>
              <p className="text-sm mt-2 opacity-70">يدعم قارئ الباركود USB تلقائياً</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Package className="w-12 h-12 opacity-20 mb-3" />
              <p>لا توجد نتائج لـ «{search}»</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart ── */}
      <div className="flex flex-col bg-white border-r border-slate-100 overflow-hidden">
        {/* Cart header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-800">سلة البيع</h2>
            {cart.itemCount() > 0 && (
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {cart.itemCount()}
              </span>
            )}
          </div>
          {cart.items.length > 0 && (
            <button
              onClick={() => { if (confirm('مسح السلة؟')) cart.clearCart(); }}
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> مسح
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <ShoppingCart className="w-14 h-14 mb-3" />
              <p className="text-sm">السلة فارغة</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {cart.items.map((item) => (
                <div key={item.productId} className="py-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{item.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.internalCode}</p>
                    </div>
                    <button
                      onClick={() => cart.removeItem(item.productId)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => cart.updateQty(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-9 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => cart.updateQty(item.productId, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-slate-400">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                      </span>
                      <span className="font-bold text-slate-800 block text-sm">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-100 px-5 pt-4 pb-2 space-y-2 bg-slate-50/50">
          <div className="flex justify-between text-sm text-slate-600">
            <span>الإجمالي الجزئي</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmt > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>الخصم</span>
              <span>- {formatCurrency(discountAmt)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>الضريبة</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-xl text-slate-900 border-t border-slate-200 pt-2 mt-1">
            <span>الإجمالي</span>
            <span className="text-blue-600">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Checkout button */}
        <div className="p-4">
          <button
            onClick={() => setShowCheckout(true)}
            disabled={cart.items.length === 0 || !branchId}
            className={cn(
              'w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all',
              cart.items.length > 0 && branchId
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-700/20 active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed',
            )}
          >
            <Banknote className="w-6 h-6" />
            إتمام البيع
          </button>
          {!branchId && (
            <p className="text-xs text-center text-slate-400 mt-2">يجب تعيين فرع للكاشير أولاً</p>
          )}
        </div>
      </div>

      {/* Modals */}
      <CheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleSaleSuccess}
        branchId={branchId}
        shiftId={activeShift?.id}
      />
      {completedSale && (
        <ThermalReceipt sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
    </div>
  );
}
