'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { productsApi, salesApi } from '@/lib/api';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import {
  Barcode, Search, Trash2, Plus, Minus, ShoppingCart,
  CreditCard, Banknote, X, Check, Printer, RefreshCw, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Barcode scanner hook ───────────────────────────────────────────────────
function useBarcodeScanner(onScan: (barcode: string) => void) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focused on input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        clearTimeout(timerRef.current);
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        // USB scanners fire characters very fast; reset after 100ms gap
        timerRef.current = setTimeout(() => { bufferRef.current = ''; }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}

// ─── Cart Item Row ──────────────────────────────────────────────────────────
function CartItemRow({ item }: { item: any }) {
  const { updateQty, removeItem, updateDiscount } = useCartStore();
  const [editDisc, setEditDisc] = useState(false);

  return (
    <div className="flex items-center gap-2 py-3 border-b border-slate-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
        <p className="text-xs text-slate-400">{item.internalCode}</p>
        <p className="text-xs text-blue-600 font-semibold">
          {formatCurrency(item.unitPrice)} × {item.quantity}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => updateQty(item.productId, item.quantity - 1)}
          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
        <button
          onClick={() => updateQty(item.productId, item.quantity + 1)}
          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold text-slate-800">{formatCurrency(item.total)}</p>
        {item.discountPct > 0 && (
          <p className="text-xs text-green-600">خصم {item.discountPct}%</p>
        )}
      </div>

      <button
        onClick={() => removeItem(item.productId)}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Checkout Modal ─────────────────────────────────────────────────────────
function CheckoutModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (sale: any) => void }) {
  const cart = useCartStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState('');

  const total = cart.total();
  const change = Math.max(0, (parseFloat(paid) || 0) - total);

  const handleCheckout = async () => {
    if (!user?.branchId) { setError('Branch not configured'); return; }
    setLoading(true);
    setError('');
    try {
      const res: any = await salesApi.create({
        branchId: user.branchId,
        customerId: cart.customerId || undefined,
        items: cart.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPct: i.discountPct,
        })),
        discountPct: cart.discountPct,
        discountAmount: cart.discountAmount,
        paymentMethod: cart.paymentMethod,
        amountPaid: parseFloat(paid) || total,
        notes: cart.notes,
      });
      onSuccess(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold text-slate-800">إتمام عملية البيع</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">الإجمالي الفرعي</span>
              <span>{formatCurrency(cart.subtotal())}</span>
            </div>
            {cart.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>الخصم</span>
                <span>- {formatCurrency(cart.discountAmount)}</span>
              </div>
            )}
            {cart.taxTotal() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">الضريبة</span>
                <span>{formatCurrency(cart.taxTotal())}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>الإجمالي</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">طريقة الدفع</label>
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => cart.setPaymentMethod(m)}
                  className={cn(
                    'py-2 px-3 rounded-xl border text-sm font-medium transition',
                    cart.paymentMethod === m
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300',
                  )}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Amount paid */}
          {cart.paymentMethod === 'CASH' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">المبلغ المدفوع</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold text-center"
                placeholder={total.toFixed(2)}
                autoFocus
              />
              {change > 0 && (
                <p className="text-center text-green-600 font-bold mt-2">
                  الباقي: {formatCurrency(change)}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={handleCheckout}
            disabled={loading || cart.items.length === 0}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            تأكيد البيع
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Modal ──────────────────────────────────────────────────────────
function SuccessModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">تمت عملية البيع بنجاح!</h3>
        <p className="text-slate-500 mb-1">رقم الفاتورة:</p>
        <p className="text-2xl font-mono font-bold text-blue-600 mb-6">{sale?.invoiceNumber}</p>
        <p className="text-lg font-bold mb-6">الإجمالي: {formatCurrency(Number(sale?.total))}</p>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-2 text-sm"
          >
            <Printer className="w-4 h-4" /> طباعة
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition text-sm"
          >
            بيع جديد
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Page ──────────────────────────────────────────────────────────
export default function POSPage() {
  const cart = useCartStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Barcode scanner
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    try {
      const res: any = await productsApi.byBarcode(barcode);
      if (res.data) cart.addItem(res.data);
    } catch {
      // Product not found - flash error
    }
  }, [cart]);

  useBarcodeScanner(handleBarcodeScan);

  // Manual search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res: any = await productsApi.list({ search, limit: 8, isActive: true });
        setSearchResults(res.items || []);
      } catch {} finally { setSearching(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const handleSaleSuccess = (sale: any) => {
    setCheckoutOpen(false);
    setCompletedSale(sale);
    cart.clearCart();
  };

  // Keyboard shortcut: F2 = focus search, F10 = checkout
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F10') { e.preventDefault(); if (cart.items.length > 0) setCheckoutOpen(true); }
      if (e.key === 'Escape') { setSearch(''); setSearchResults([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.items.length]);

  return (
    <>
      <div className="pos-grid gap-0 -m-6" dir="rtl">
        {/* ── LEFT: Product search ──────────────────────────── */}
        <div className="flex flex-col bg-white border-l border-slate-200 overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800"
                placeholder="ابحث بالاسم، الكود، أو الباركود... (F2)"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                <Barcode className="w-4 h-4" />
                <span className="text-xs">USB</span>
              </div>
            </div>
          </div>

          {/* Search results */}
          <div className="flex-1 overflow-y-auto p-4">
            {search && searchResults.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => { cart.addItem(product); setSearch(''); setSearchResults([]); }}
                    className="pos-item-btn bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-xl p-3 text-right"
                  >
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-2 mx-auto">
                      <ShoppingCart className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{product.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{product.internalCode}</p>
                    <p className="text-sm font-bold text-blue-600 mt-1">{formatCurrency(Number(product.sellingPrice))}</p>
                  </button>
                ))}
              </div>
            )}

            {search && searchResults.length === 0 && !searching && (
              <div className="text-center text-slate-400 py-12">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد نتائج لـ "{search}"</p>
              </div>
            )}

            {!search && (
              <div className="text-center text-slate-300 py-16">
                <Barcode className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg font-medium">امسح الباركود أو ابحث عن المنتج</p>
                <p className="text-sm mt-2">F2 = بحث · F10 = إتمام البيع · ESC = إلغاء</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Cart ──────────────────────────────────── */}
        <div className="flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">
          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800">السلة</span>
              {cart.itemCount() > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.itemCount()}
                </span>
              )}
            </div>
            {cart.items.length > 0 && (
              <button
                onClick={() => cart.clearCart()}
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> مسح الكل
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {cart.items.length === 0 ? (
              <div className="text-center text-slate-300 py-16">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm">السلة فارغة</p>
              </div>
            ) : (
              cart.items.map((item) => <CartItemRow key={item.productId} item={item} />)
            )}
          </div>

          {/* Totals */}
          <div className="bg-white border-t border-slate-200 p-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>الإجمالي الفرعي</span>
              <span className="font-medium">{formatCurrency(cart.subtotal())}</span>
            </div>
            {cart.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>الخصم</span>
                <span>- {formatCurrency(cart.discountAmount)}</span>
              </div>
            )}
            {cart.taxTotal() > 0 && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>الضريبة</span>
                <span>{formatCurrency(cart.taxTotal())}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl border-t pt-2 mt-2">
              <span>الإجمالي</span>
              <span className="text-blue-600">{formatCurrency(cart.total())}</span>
            </div>

            {/* Checkout button */}
            <button
              onClick={() => setCheckoutOpen(true)}
              disabled={cart.items.length === 0}
              className="w-full mt-3 py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition flex items-center justify-center gap-3"
            >
              <Banknote className="w-6 h-6" />
              <span>إتمام البيع (F10)</span>
            </button>
          </div>
        </div>
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={handleSaleSuccess}
      />

      {completedSale && (
        <SuccessModal sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
    </>
  );
}
