'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { Warehouse, AlertTriangle, Search, History, SlidersHorizontal, ClipboardCheck, X, Loader2, CheckCircle } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// ─── Manual Adjustment Modal ────────────────────────────────────────────────
function AdjustmentModal({ open, inv, onClose, onSuccess }: any) {
  const [delta, setDelta] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open || !inv) return null;

  const parsedDelta = parseInt(delta) || 0;
  const newQty = inv.quantity + parsedDelta;

  const handleSubmit = async () => {
    if (!delta || parsedDelta === 0) { setError('يرجى إدخال كمية تعديل غير صفرية'); return; }
    if (newQty < 0) { setError('لا يمكن أن تقل الكمية عن صفر'); return; }
    setLoading(true); setError('');
    try {
      await inventoryApi.adjust({
        productId: inv.product.id,
        branchId: inv.branch.id,
        quantity: parsedDelta,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'فشل تنفيذ التسوية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">تسوية يدوية للمخزون</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <p className="text-sm text-slate-500 mb-4">{inv.product.name}</p>

        <div className="bg-slate-50 rounded-xl p-3 text-center mb-4">
          <p className="text-xs text-slate-400 mb-1">الكمية الحالية</p>
          <p className="text-xl font-bold text-slate-700">{inv.quantity}</p>
        </div>

        <label className="text-sm font-medium text-slate-700 block mb-1.5">
          التعديل (موجب للزيادة، سالب للنقص)
        </label>
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          autoFocus
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xl font-bold text-center mb-2"
          placeholder="مثال: 5 أو -3"
        />
        {delta && (
          <p className={cn('text-center text-sm font-medium mb-3', newQty < 0 ? 'text-red-500' : 'text-slate-500')}>
            الكمية الجديدة: <span className="font-bold">{newQty}</span>
          </p>
        )}

        <label className="text-sm font-medium text-slate-700 block mb-1.5">سبب التسوية</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
          placeholder="اختياري"
        />

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm">إلغاء</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SlidersHorizontal className="w-4 h-4" />}
            تنفيذ التسوية
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Physical Count Modal ───────────────────────────────────────────────────
function PhysicalCountModal({ open, items, branchId, onClose, onSuccess }: any) {
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const setActual = (productId: string, value: string) => {
    setActuals((prev) => ({ ...prev, [productId]: value }));
  };

  const countedItems = Object.entries(actuals)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([productId, v]) => ({ productId, actualQty: parseInt(v) || 0 }));

  const handleSubmit = async () => {
    if (!branchId) { setError('لا يوجد فرع محدد لتنفيذ الجرد'); return; }
    if (countedItems.length === 0) { setError('يرجى إدخال الكمية الفعلية لصنف واحد على الأقل'); return; }
    setLoading(true); setError('');
    try {
      await inventoryApi.count({ branchId, items: countedItems });
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'فشل تنفيذ الجرد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-slate-800">جرد فعلي للمخزون</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">أدخل الكمية الفعلية المعدودة لكل صنف. اترك الحقل فارغاً لتجاهل الصنف.</p>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">المنتج</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية بالنظام</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية الفعلية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(items || []).map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{inv.product.name}</td>
                    <td className="px-4 py-2 text-center text-slate-500">{inv.quantity}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={actuals[inv.product.id] ?? ''}
                        onChange={(e) => setActual(inv.product.id, e.target.value)}
                        className="w-24 text-center border border-slate-200 rounded-lg py-1 text-sm"
                        placeholder={String(inv.quantity)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            حفظ الجرد
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');
  const [adjustInv, setAdjustInv] = useState<any>(null);
  const [showCount, setShowCount] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const branchId = user?.role !== 'ADMIN' ? user?.branchId : undefined;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshInventory = () => {
    qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    qc.invalidateQueries({ queryKey: ['inventory-movements'] });
  };

  const handleAdjustSuccess = () => {
    setAdjustInv(null);
    refreshInventory();
    showToast('success', 'تم تنفيذ التسوية بنجاح');
  };

  const handleCountSuccess = () => {
    setShowCount(false);
    refreshInventory();
    showToast('success', 'تم حفظ الجرد وتحديث المخزون بنجاح');
  };

  const { data: stock, isLoading } = useQuery({
    queryKey: ['inventory-stock', branchId],
    queryFn: () => inventoryApi.stock({ branchId }).then((r: any) => r.data),
    refetchInterval: 30000,
  });

  const { data: movements, isLoading: loadingMov } = useQuery({
    queryKey: ['inventory-movements', branchId],
    queryFn: () => inventoryApi.movements({ branchId, limit: 50 }).then((r: any) => r),
    enabled: tab === 'movements',
  });

  const filtered = (stock ?? []).filter((inv: any) =>
    !search ||
    inv.product.name.toLowerCase().includes(search.toLowerCase()) ||
    inv.product.internalCode.toLowerCase().includes(search.toLowerCase()),
  );

  const lowStockItems = filtered.filter((inv: any) => inv.quantity <= inv.product.minStockAlert);
  const outOfStock = filtered.filter((inv: any) => inv.quantity === 0);

  const movTypeColor: Record<string, string> = {
    SALE: 'text-red-600 bg-red-50',
    PURCHASE: 'text-green-600 bg-green-50',
    TRANSFER_IN: 'text-blue-600 bg-blue-50',
    TRANSFER_OUT: 'text-amber-600 bg-amber-50',
    ADJUSTMENT: 'text-purple-600 bg-purple-50',
    RETURN: 'text-teal-600 bg-teal-50',
    DAMAGE: 'text-red-600 bg-red-50',
  };
  const movTypeLabel: Record<string, string> = {
    SALE: 'بيع', PURCHASE: 'شراء', TRANSFER_IN: 'تحويل وارد',
    TRANSFER_OUT: 'تحويل صادر', ADJUSTMENT: 'تسوية', RETURN: 'مرتجع', DAMAGE: 'تالف', INITIAL: 'رصيد افتتاحي',
  };

  return (
    <AppLayout title="إدارة المخزون">
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={() => setShowCount(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition text-sm"
          >
            <ClipboardCheck className="w-4 h-4" /> جرد فعلي
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'إجمالي الأصناف', value: filtered.length, icon: Warehouse, color: 'blue' },
            { label: 'مخزون منخفض', value: lowStockItems.length, icon: AlertTriangle, color: 'amber' },
            { label: 'نفد من المخزون', value: outOfStock.length, icon: AlertTriangle, color: 'red' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${s.color}-50 text-${s.color}-600`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {([['stock', 'المخزون الحالي', Warehouse], ['movements', 'سجل الحركات', History]] as const).map(([t, l, Icon]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500',
              )}
            >
              <Icon className="w-4 h-4" />{l}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="بحث في المخزون..."
          />
        </div>

        {/* Stock Table */}
        {tab === 'stock' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                  <th className="text-right px-4 py-3">الكود</th>
                  <th className="text-right px-4 py-3">المنتج</th>
                  <th className="text-right px-4 py-3">الفرع</th>
                  <th className="text-right px-4 py-3">الموقع</th>
                  <th className="text-center px-4 py-3">الكمية</th>
                  <th className="text-center px-4 py-3">الحد الأدنى</th>
                  <th className="text-center px-4 py-3">الحالة</th>
                  <th className="text-center px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading
                  ? [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                  : filtered.map((inv: any) => {
                    const isLow = inv.quantity <= inv.product.minStockAlert;
                    const isOut = inv.quantity === 0;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg">
                            {inv.product.internalCode}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{inv.product.name}</p>
                          {inv.product.category && (
                            <p className="text-xs text-slate-400">{inv.product.category.name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{inv.branch?.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{inv.location || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'font-bold text-base',
                            isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-600',
                          )}>
                            {formatNumber(inv.quantity)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400 text-sm">
                          {inv.product.minStockAlert}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            isOut ? 'bg-red-100 text-red-700' :
                            isLow ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700',
                          )}>
                            {isOut ? 'نفد' : isLow ? 'منخفض' : 'متوفر'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setAdjustInv(inv)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="تسوية يدوية"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Movements Table */}
        {tab === 'movements' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                  <th className="text-right px-4 py-3">التاريخ</th>
                  <th className="text-right px-4 py-3">المنتج</th>
                  <th className="text-right px-4 py-3">نوع الحركة</th>
                  <th className="text-center px-4 py-3">الكمية</th>
                  <th className="text-center px-4 py-3">قبل</th>
                  <th className="text-center px-4 py-3">بعد</th>
                  <th className="text-right px-4 py-3">المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingMov
                  ? [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                  : movements?.items?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(m.createdAt).toLocaleString('ar-EG')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 text-xs">{m.product?.name}</p>
                        <p className="text-xs text-slate-400">{m.product?.internalCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          movTypeColor[m.type] || 'text-slate-600 bg-slate-100',
                        )}>
                          {movTypeLabel[m.type] || m.type}
                        </span>
                      </td>
                      <td className={cn('px-4 py-3 text-center font-bold', m.quantity > 0 ? 'text-green-600' : 'text-red-600')}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">{m.quantityBefore}</td>
                      <td className="px-4 py-3 text-center font-medium text-slate-700">{m.quantityAfter}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.creator?.fullName || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdjustmentModal
        key={adjustInv?.id ?? 'no-adjust'}
        open={!!adjustInv}
        inv={adjustInv}
        onClose={() => setAdjustInv(null)}
        onSuccess={handleAdjustSuccess}
      />
      <PhysicalCountModal
        open={showCount}
        items={filtered}
        branchId={branchId || filtered[0]?.branch?.id}
        onClose={() => setShowCount(false)}
        onSuccess={handleCountSuccess}
      />

      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </AppLayout>
  );
}
