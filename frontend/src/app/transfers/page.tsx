'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transfersApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, ArrowLeftRight, Check, X, Truck, Eye, Loader2, AlertCircle } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  PENDING:    { label: 'قيد الانتظار', color: 'bg-amber-100 text-amber-700', next: 'APPROVED', nextLabel: 'موافقة' },
  APPROVED:   { label: 'مقبول', color: 'bg-blue-100 text-blue-700', next: 'IN_TRANSIT', nextLabel: 'شحن' },
  IN_TRANSIT: { label: 'جاري الشحن', color: 'bg-purple-100 text-purple-700', next: 'COMPLETED', nextLabel: 'استلام' },
  COMPLETED:  { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
  REJECTED:   { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
  CANCELLED:  { label: 'ملغي', color: 'bg-slate-100 text-slate-600' },
};

function NewTransferModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ productId: string; productName: string; quantity: number }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => usersApi.branches().then((r: any) => r.data),
    enabled: open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-search-transfer', searchTerm],
    queryFn: () => import('@/lib/api').then(m => m.productsApi.list({ search: searchTerm, limit: 8 })).then((r: any) => r.items),
    enabled: searchTerm.length > 1,
  });

  const handleSubmit = async () => {
    if (!fromBranchId || !toBranchId) { setError('يرجى اختيار الفرعين'); return; }
    if (fromBranchId === toBranchId) { setError('الفرع المصدر والوجهة لا يمكن أن يكونا نفس الفرع'); return; }
    if (items.length === 0) { setError('أضف منتجاً واحداً على الأقل'); return; }
    setLoading(true); setError('');
    try {
      await transfersApi.create({
        fromBranchId, toBranchId, notes: notes || undefined,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      });
      qc.invalidateQueries({ queryKey: ['transfers'] });
      onClose();
      setItems([]); setFromBranchId(''); setToBranchId(''); setNotes('');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-bold">طلب تحويل مخزون جديد</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">من فرع *</label>
              <select value={fromBranchId} onChange={e => setFromBranchId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">اختر...</option>
                {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">إلى فرع *</label>
              <select value={toBranchId} onChange={e => setToBranchId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">اختر...</option>
                {(branches || []).filter((b: any) => b.id !== fromBranchId).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">بحث عن منتج</label>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ابحث بالاسم أو الكود..." />
            {(productsData || []).length > 0 && (
              <div className="border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-lg">
                {(productsData as any[]).map((p: any) => (
                  <button key={p.id} onClick={() => { if (!items.find(i => i.productId === p.id)) setItems(prev => [...prev, { productId: p.id, productName: p.name, quantity: 1 }]); setSearchTerm(''); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-right text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-400 text-xs">{p.internal_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">المنتج</th>
                    <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية المطلوبة</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item, idx) => (
                    <tr key={item.productId}>
                      <td className="px-4 py-2 font-medium text-slate-800">{item.productName}</td>
                      <td className="px-4 py-2 text-center">
                        <input type="number" min="1" value={item.quantity}
                          onChange={e => setItems(prev => prev.map((i, j) => j === idx ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))}
                          className="w-16 text-center border border-slate-200 rounded-lg py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => setItems(prev => prev.filter((_, j) => j !== idx))} className="text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">ملاحظات</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="اختياري" />
          </div>

          {error && <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            إرسال الطلب
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page, statusFilter],
    queryFn: () => transfersApi.list({ page, limit: 20, ...(statusFilter && { status: statusFilter }) }).then((r: any) => r),
  });

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdating(id);
    try {
      await transfersApi.updateStatus(id, newStatus);
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    } catch (e: any) {
      alert(e.message);
    } finally { setUpdating(null); }
  };

  return (
    <AppLayout title="تحويلات المخزون">
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">تحويلات المخزون</h1>
            <p className="text-slate-500 text-sm">{data?.total ?? 0} طلب تحويل</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition text-sm">
            <Plus className="w-4 h-4" /> طلب تحويل جديد
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setStatusFilter(''); setPage(1); }}
            className={cn('px-3 py-1.5 rounded-xl text-sm font-medium transition', !statusFilter ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600')}>
            الكل
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-xl text-sm font-medium transition', statusFilter === key ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600')}>
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                <th className="text-right px-4 py-3">رقم التحويل</th>
                <th className="text-right px-4 py-3">من</th>
                <th className="text-right px-4 py-3">إلى</th>
                <th className="text-right px-4 py-3">التاريخ</th>
                <th className="text-center px-4 py-3">الأصناف</th>
                <th className="text-center px-4 py-3">الحالة</th>
                <th className="text-center px-4 py-3">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading
                ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>)
                : (data?.items || []).map((t: any) => {
                  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.PENDING;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">{t.transfer_number}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{t.from_branch?.name}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{t.to_branch?.name}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {t.items?.length ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cfg.color)}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cfg.next && (user?.role === 'ADMIN' || user?.role === 'WAREHOUSE' || user?.role === 'BRANCH_MANAGER') && (
                          <button
                            onClick={() => handleStatusUpdate(t.id, cfg.next!)}
                            disabled={updating === t.id}
                            className="flex items-center gap-1 mx-auto px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                          >
                            {updating === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {cfg.nextLabel}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {!isLoading && (!data?.items || data.items.length === 0) && (
            <div className="text-center py-12 text-slate-400">
              <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد طلبات تحويل</p>
            </div>
          )}
        </div>
      </div>

      <NewTransferModal open={showNew} onClose={() => setShowNew(false)} />
    </AppLayout>
  );
}
