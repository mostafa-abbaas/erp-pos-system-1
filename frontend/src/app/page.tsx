'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi, salesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';

function StatCard({ title, value, sub, icon: Icon, trend, color = 'blue' }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const branchId = user?.role !== 'ADMIN' ? user?.branchId : undefined;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: () => reportsApi.dashboard(branchId).then((r: any) => r.data),
    refetchInterval: 60000,
  });

  const { data: salesReport } = useQuery({
    queryKey: ['sales-report-week', branchId],
    queryFn: () => {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return reportsApi.sales({ branchId, dateFrom: from, dateTo: to, groupBy: 'day' }).then((r: any) => r.data);
    },
  });

  return (
    <AppLayout title="لوحة التحكم">
      <div className="space-y-6" dir="rtl">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            مرحباً، {user?.fullNameAr || user?.fullName} 👋
          </h1>
          <p className="text-slate-500 mt-1">هذا ملخص نشاط اليوم</p>
        </div>

        {/* Stats grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 h-32 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="مبيعات اليوم"
              value={formatCurrency(stats?.today?.salesTotal ?? 0)}
              sub={`${formatNumber(stats?.today?.salesCount ?? 0)} فاتورة`}
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="مبيعات الشهر"
              value={formatCurrency(stats?.thisMonth?.salesTotal ?? 0)}
              sub={`${formatNumber(stats?.thisMonth?.salesCount ?? 0)} فاتورة`}
              icon={ShoppingCart}
              color="green"
            />
            <StatCard
              title="إجمالي المنتجات"
              value={formatNumber(stats?.totalProducts ?? 0)}
              icon={Package}
              color="blue"
            />
            <StatCard
              title="منخفض المخزون"
              value={formatNumber(stats?.lowStockCount ?? 0)}
              sub="منتج يحتاج تزويد"
              icon={AlertTriangle}
              color={stats?.lowStockCount > 0 ? 'red' : 'green'}
            />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales area chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">المبيعات - آخر 7 أيام</h2>
            {salesReport?.timeSeries ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesReport.timeSeries}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#colorTotal)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] bg-slate-50 rounded-xl animate-pulse" />
            )}
          </div>

          {/* Top products */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">الأكثر مبيعاً - هذا الشهر</h2>
            <div className="space-y-3">
              {stats?.topProducts?.length ? (
                stats.topProducts.map((tp: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{tp.product?.name}</p>
                      <p className="text-xs text-slate-400">{formatNumber(tp.quantitySold)} وحدة</p>
                    </div>
                    <p className="text-sm font-bold text-blue-600 shrink-0">
                      {formatCurrency(tp.totalRevenue)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">لا توجد بيانات</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: '/pos', label: 'فتح نقطة البيع', icon: ShoppingCart, color: 'bg-blue-600' },
            { href: '/inventory', label: 'فحص المخزون', icon: Package, color: 'bg-slate-700' },
            { href: '/products?isActive=true&lowStock=true', label: 'منخفض المخزون', icon: AlertTriangle, color: 'bg-amber-500' },
            { href: '/reports', label: 'عرض التقارير', icon: TrendingUp, color: 'bg-green-600' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${a.color} hover:opacity-90 text-white rounded-2xl p-4 flex items-center gap-3 transition`}
            >
              <a.icon className="w-6 h-6 shrink-0" />
              <span className="font-medium text-sm">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
