'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { Warehouse, AlertTriangle, Search, History } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');

  const branchId = user?.role !== 'ADMIN' ? user?.branchId : undefined;

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
    </AppLayout>
  );
}
