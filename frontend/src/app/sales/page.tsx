'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import {
  Receipt, Search, X, Loader2, CheckCircle, AlertCircle,
  RotateCcw, Eye, Filter,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

const SALE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  COMPLETED: 'مكتملة',
  REFUNDED: 'مرتجعة بالكامل',
  PARTIALLY_REFUNDED: 'مرتجعة جزئياً',
  CANCELLED: 'ملغاة',
};

const SALE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  COMPLETED: 'bg-green-100 text-green-700',
  REFUNDED: 'bg-red-100 text-red-700',
  PARTIALLY_REFUNDED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

// ─── Refund Modal ───────────────────────────────────────────────────────────
function RefundModal({ open, sale, onClose, onSuccess }: any) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open || !sale) return null;

  const items = sale.items || [];

  const remainingQty = (item: any) => {
    const alreadyRefunded = Number(item.refunded_quantity || 0);
    return item.quantity - alreadyRefunded;
  };

  const setQty = (itemId: string, max: number, value: number) => {
    const clamped = Math.max(0, Math.min(max, value || 0));
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const refundTotal = items.reduce((sum: number, item: any) => {
    const qty = quantities[item.id] || 0;
    const unitNet = Number(item.unit_price) * (1 - Number(item.discount_pct || 0) / 100);
    return sum + qty * unitNet;
  }, 0);

  const handleSubmit = async () => {
    const selectedItems = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    if (selectedItems.length === 0) { setError('يرجى تحديد كمية واحدة على الأقل للإرجاع'); return; }
    if (!reason.trim()) { setError('سبب الإرجاع مطلوب'); return; }

    setLoading(true); setError('');
    try {
      await salesApi.refund(sale.id, { reason: reason.trim(), paymentMethod, items: selectedItems });
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'فشل تنفيذ عملية الإرجاع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">إرجاع فاتورة</h3>
            <p className="text-sm text-slate-500">{sale.invoice_number}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">المنتج</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية المباعة</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">كمية الإرجاع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item: any) => {
                  const max = remainingQty(item);
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-2 font-medium text-slate-800">{item.product?.name}</td>
                      <td className="px-4 py-2 text-center text-slate-500">{item.quantity}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={max}
                          value={quantities[item.id] || 0}
                          onChange={(e) => setQty(item.id, max, parseInt(e.target.value))}
                          disabled={max <= 0}
                          className="w-20 text-center border border-slate-200 rounded-lg py-1 text-sm disabled:bg-slate-50 disabled:text-slate-300"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">طريقة استرداد المبلغ</label>
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'py-2 rounded-xl text-sm font-medium border-2 transition',
                    paymentMethod === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600',
                  )}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">سبب الإرجاع *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="مثال: منتج تالف، طلب العميل..."
            />
          </div>

          <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">إجمالي المبلغ المسترد</span>
            <span className="text-xl font-black text-blue-700">{formatCurrency(refundTotal)}</span>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            تنفيذ الإرجاع
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sale Detail Modal ──────────────────────────────────────────────────────
function SaleDetailModal({ open, sale, onClose, onRefund }: any) {
  if (!open || !sale) return null;

  const canRefund = sale.status === 'COMPLETED' || sale.status === 'PARTIALLY_REFUNDED';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{sale.invoice_number}</h3>
            <span className={cn('inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium', SALE_STATUS_COLORS[sale.status])}>
              {SALE_STATUS_LABELS[sale.status] || sale.status}
            </span>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">الكاشير</p>
              <p className="font-medium text-slate-700">{sale.cashier?.fullName}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">الفرع</p>
              <p className="font-medium text-slate-700">{sale.branch?.name}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">طريقة الدفع</p>
              <p className="font-medium text-slate-700">{PAYMENT_METHOD_LABELS[sale.payment_method] || sale.payment_method}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">التاريخ</p>
              <p className="font-medium text-slate-700">{new Date(sale.created_at).toLocaleString('ar-EG')}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">المنتج</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">السعر</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(sale.items || []).map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{item.product?.name}</td>
                    <td className="px-4 py-2 text-center text-slate-500">{item.quantity}</td>
                    <td className="px-4 py-2 text-center text-slate-500">{formatCurrency(Number(item.unit_price))}</td>
                    <td className="px-4 py-2 text-center font-bold text-slate-700">{formatCurrency(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>الإجمالي الفرعي</span>
              <span>{formatCurrency(Number(sale.subtotal))}</span>
            </div>
            {Number(sale.discount_amount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>الخصم</span>
                <span>- {formatCurrency(Number(sale.discount_amount))}</span>
              </div>
            )}
            {Number(sale.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>الضريبة</span>
                <span>{formatCurrency(Number(sale.tax_amount))}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg text-slate-800 border-t pt-1.5 mt-1.5">
              <span>الإجمالي</span>
              <span>{formatCurrency(Number(sale.total))}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            إغلاق
          </button>
          {canRefund && (
            <button
              onClick={() => onRefund(sale)}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> إرجاع
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function SalesHistoryPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [refundSale, setRefundSale] = useState<any>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const branchId = user?.branchId || '';

  const { data, isLoading } = useQuery({
    queryKey: ['sales-history', page, statusFilter, branchId],
    queryFn: () => salesApi.list({
      page, limit: 20,
      branchId: branchId || undefined,
      status: statusFilter || undefined,
    }).then((r: any) => r),
  });

  const { data: selectedSale } = useQuery({
    queryKey: ['sale-detail', selectedSaleId],
    queryFn: () => salesApi.byId(selectedSaleId as string).then((r: any) => r.data),
    enabled: !!selectedSaleId,
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRefundSuccess = () => {
    setRefundSale(null);
    setSelectedSaleId(null);
    qc.invalidateQueries({ queryKey: ['sales-history'] });
    qc.invalidateQueries({ queryKey: ['sale-detail'] });
    qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    showToast('success', 'تم تنفيذ عملية الإرجاع بنجاح');
  };

  const openRefundFromDetail = async (sale: any) => {
    setRefundSale(sale);
  };

  return (
    <AppLayout title="سجل المبيعات">
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">سجل المبيعات</h1>
            <p className="text-slate-500 text-sm">{data?.total ?? 0} فاتورة</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">كل الحالات</option>
              {Object.entries(SALE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                <th className="text-right px-4 py-3">رقم الفاتورة</th>
                <th className="text-right px-4 py-3">الكاشير</th>
                <th className="text-right px-4 py-3">الفرع</th>
                <th className="text-right px-4 py-3">التاريخ</th>
                <th className="text-center px-4 py-3">الأصناف</th>
                <th className="text-right px-4 py-3">الإجمالي</th>
                <th className="text-center px-4 py-3">الحالة</th>
                <th className="text-center px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading
                ? [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : (data?.items || []).map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{s.invoice_number}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.cashier?.fullName}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.branch?.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(s.created_at).toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{s.item_count}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(Number(s.total))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', SALE_STATUS_COLORS[s.status])}>
                        {SALE_STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedSaleId(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED') && (
                          <button
                            onClick={() => setSelectedSaleId(s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="إرجاع"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!isLoading && (!data?.items || data.items.length === 0) && (
            <div className="text-center py-12 text-slate-400">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد فواتير مبيعات</p>
            </div>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40">السابق</button>
            <span className="text-sm text-slate-500">صفحة {page} من {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40">التالي</button>
          </div>
        )}
      </div>

      <SaleDetailModal
        open={!!selectedSaleId}
        sale={selectedSale}
        onClose={() => setSelectedSaleId(null)}
        onRefund={openRefundFromDetail}
      />
      <RefundModal
        key={refundSale?.id ?? 'no-refund'}
        open={!!refundSale}
        sale={refundSale}
        onClose={() => setRefundSale(null)}
        onSuccess={handleRefundSuccess}
      />

      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </AppLayout>
  );
}
