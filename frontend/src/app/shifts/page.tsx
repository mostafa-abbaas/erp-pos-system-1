'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import { Clock, DollarSign, CheckCircle, Plus, Lock, Unlock, X, Loader2, BarChart2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

// ─── Shift Report Modal ─────────────────────────────────────────────────────
function ShiftReportModal({ open, shiftId, onClose }: { open: boolean; shiftId: string | null; onClose: () => void }) {
  const { data: report, isLoading } = useQuery({
    queryKey: ['shift-report', shiftId],
    queryFn: () => shiftsApi.report(shiftId as string).then((r: any) => r.data),
    enabled: open && !!shiftId,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-slate-800">تقرير الوردية</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-400" /></div>
        ) : !report ? (
          <div className="text-center py-12 text-slate-400">تعذر تحميل التقرير</div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">الكاشير</p>
                <p className="font-medium text-slate-700">{report.shift.cashier_name}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">الفرع</p>
                <p className="font-medium text-slate-700">{report.shift.branch_name}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-2">المبيعات حسب طريقة الدفع</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right px-4 py-2 text-slate-500 font-medium">طريقة الدفع</th>
                      <th className="text-center px-4 py-2 text-slate-500 font-medium">العدد</th>
                      <th className="text-center px-4 py-2 text-slate-500 font-medium">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(report.salesByPayment || []).map((p: any) => (
                      <tr key={p.payment_method}>
                        <td className="px-4 py-2 font-medium text-slate-800">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                        <td className="px-4 py-2 text-center text-slate-500">{p.count}</td>
                        <td className="px-4 py-2 text-center font-bold text-slate-700">{formatCurrency(Number(p.total))}</td>
                      </tr>
                    ))}
                    {(!report.salesByPayment || report.salesByPayment.length === 0) && (
                      <tr><td colSpan={3} className="text-center py-6 text-slate-400">لا توجد مبيعات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-2">الأكثر مبيعاً</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right px-4 py-2 text-slate-500 font-medium">المنتج</th>
                      <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية</th>
                      <th className="text-center px-4 py-2 text-slate-500 font-medium">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(report.topProducts || []).map((p: any) => (
                      <tr key={p.internal_code}>
                        <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                        <td className="px-4 py-2 text-center text-slate-500">{p.qty}</td>
                        <td className="px-4 py-2 text-center font-bold text-slate-700">{formatCurrency(Number(p.revenue))}</td>
                      </tr>
                    ))}
                    {(!report.topProducts || report.topProducts.length === 0) && (
                      <tr><td colSpan={3} className="text-center py-6 text-slate-400">لا توجد بيانات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 pt-0">
          <button onClick={onClose} className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function ActiveShiftCard({ shift, branchId, onClose }: { shift: any; branchId: string; onClose: () => void }) {
  const [closingBalance, setClosingBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const qc = useQueryClient();

  const openedAt = new Date(shift.opened_at);
  const duration = Math.floor((Date.now() - openedAt.getTime()) / 60000);

  const handleClose = async () => {
    setLoading(true);
    try {
      const res: any = await shiftsApi.close(shift.id, {
        closingBalance: parseFloat(closingBalance) || undefined,
        notes: notes || undefined,
      });
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ['active-shift'] });
      qc.invalidateQueries({ queryKey: ['shifts'] });
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  if (result) {
    const s = result.summary;
    return (
      <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">تم إغلاق الوردية</h3>
            <p className="text-sm text-slate-500">تقرير الوردية</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي المبيعات', value: formatCurrency(s.totalSales), color: 'text-blue-600' },
            { label: 'عدد الفواتير', value: s.salesCount, color: 'text-slate-700' },
            { label: 'رصيد الافتتاح', value: formatCurrency(s.openingBalance), color: 'text-slate-700' },
            { label: 'الفرق', value: formatCurrency(Math.abs(s.difference)), color: s.difference >= 0 ? 'text-green-600' : 'text-red-500' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className={cn('text-xl font-bold', item.color)}>{item.value}</p>
              <p className="text-xs text-slate-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="bg-blue-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">وردية مفتوحة</h3>
              <p className="text-blue-200 text-sm">{shift.branch?.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-200">المدة</p>
            <p className="font-bold text-lg">{duration}د</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{formatCurrency(Number(shift.sales_total ?? 0))}</p>
            <p className="text-xs text-slate-500 mt-1">إجمالي المبيعات</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-slate-700">{shift.sales_count ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">عدد الفواتير</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-slate-700">{formatCurrency(Number(shift.opening_balance ?? 0))}</p>
            <p className="text-xs text-slate-500 mt-1">رصيد الافتتاح</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">رصيد الإغلاق (النقدي الفعلي)</label>
          <input
            type="number"
            value={closingBalance}
            onChange={e => setClosingBalance(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold text-center"
            placeholder={String(Number(shift.opening_balance) + Number(shift.sales_total || 0))}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">ملاحظات</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="اختياري" />
        </div>

        <button onClick={handleClose} disabled={loading}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-bold flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
          إغلاق الوردية
        </button>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showOpen, setShowOpen] = useState(false);
  const [reportShiftId, setReportShiftId] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingLoading, setOpeningLoading] = useState(false);
  const [page, setPage] = useState(1);

  const branchId = user?.branchId || '';

  const { data: activeShift, isLoading: loadingActive } = useQuery({
    queryKey: ['active-shift'],
    queryFn: () => shiftsApi.active().then((r: any) => r.data),
    refetchInterval: 30000,
  });

  const { data: shiftsList, isLoading: loadingList } = useQuery({
    queryKey: ['shifts', page, branchId],
    queryFn: () => shiftsApi.list({ page, limit: 10, ...(branchId && { branchId }) }).then((r: any) => r),
  });

  const handleOpenShift = async () => {
    setOpeningLoading(true);
    try {
      await shiftsApi.open({ branchId, openingBalance: parseFloat(openingBalance) || 0 });
      qc.invalidateQueries({ queryKey: ['active-shift'] });
      setShowOpen(false);
      setOpeningBalance('');
    } catch (e: any) { alert(e.message); }
    finally { setOpeningLoading(false); }
  };

  return (
    <AppLayout title="إدارة الورديات">
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">إدارة الورديات</h1>
            <p className="text-slate-500 text-sm">تتبع ورديات الكاشير والتسويات النقدية</p>
          </div>
          {!activeShift && (
            <button onClick={() => setShowOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm">
              <Unlock className="w-4 h-4" /> فتح وردية
            </button>
          )}
        </div>

        {/* Active shift */}
        {loadingActive ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400" />
          </div>
        ) : activeShift ? (
          <ActiveShiftCard shift={activeShift} branchId={branchId} onClose={() => {}} />
        ) : (
          <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <Lock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">لا توجد وردية مفتوحة</p>
            <p className="text-slate-400 text-sm mt-1">افتح وردية جديدة لبدء تسجيل المبيعات</p>
          </div>
        )}

        {/* Shifts history */}
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-3">سجل الورديات</h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                  <th className="text-right px-4 py-3">الكاشير</th>
                  <th className="text-right px-4 py-3">الفرع</th>
                  <th className="text-right px-4 py-3">وقت الفتح</th>
                  <th className="text-right px-4 py-3">وقت الإغلاق</th>
                  <th className="text-center px-4 py-3">الفواتير</th>
                  <th className="text-right px-4 py-3">إجمالي المبيعات</th>
                  <th className="text-center px-4 py-3">الحالة</th>
                  <th className="text-center px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingList
                  ? [...Array(4)].map((_, i) => <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>)
                  : (shiftsList?.items || []).map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.cashier?.fullName}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.branch?.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(s.opened_at).toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {s.closed_at ? new Date(s.closed_at).toLocaleString('ar-EG') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{s.sales_count ?? 0}</td>
                      <td className="px-4 py-3 font-bold text-blue-600">{formatCurrency(Number(s.sales_total ?? 0))}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                          s.closed_at ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                          {s.closed_at ? 'مغلقة' : 'مفتوحة'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setReportShiftId(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="عرض التقرير"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Open Shift Modal */}
      {showOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">فتح وردية جديدة</h3>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">رصيد الافتتاح (النقدي في الصندوق)</label>
            <input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-2xl font-bold text-center mb-4"
              placeholder="0.00" />
            <div className="flex gap-3">
              <button onClick={() => setShowOpen(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm">إلغاء</button>
              <button onClick={handleOpenShift} disabled={openingLoading}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                {openingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                فتح الوردية
              </button>
            </div>
          </div>
        </div>
      )}

      <ShiftReportModal open={!!reportShiftId} shiftId={reportShiftId} onClose={() => setReportShiftId(null)} />
    </AppLayout>
  );
}
