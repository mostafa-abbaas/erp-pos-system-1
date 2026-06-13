'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { formatCurrency, formatNumber } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { Download, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ReportsPage() {
  const { user } = useAuthStore();
  const branchId = user?.role !== 'ADMIN' ? user?.branchId : undefined;

  const [range, setRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const dateRanges = {
    week: { from: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    month: { from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    quarter: { from: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
  };

  const { from, to } = dateRanges[range];

  const { data: salesReport, isLoading: loadingSales } = useQuery({
    queryKey: ['report-sales', branchId, from, to, groupBy],
    queryFn: () => reportsApi.sales({ branchId, dateFrom: from, dateTo: to, groupBy }).then((r: any) => r.data),
  });

  const { data: profitReport, isLoading: loadingProfit } = useQuery({
    queryKey: ['report-profit', branchId, from, to],
    queryFn: () => reportsApi.profit({ branchId, dateFrom: from, dateTo: to }).then((r: any) => r.data),
  });

  const summary = salesReport?.summary;
  const profit = profitReport;

  return (
    <AppLayout title="التقارير والتحليلات">
      <div className="space-y-6" dir="rtl">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(['week', 'month', 'quarter'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  range === r ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r === 'week' ? 'أسبوع' : r === 'month' ? 'شهر' : 'ربع سنة'}
              </button>
            ))}
          </div>

          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(['day', 'week', 'month'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-2 text-xs font-medium transition ${
                  groupBy === g ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {g === 'day' ? 'يوماً' : g === 'week' ? 'أسبوعاً' : 'شهراً'}
              </button>
            ))}
          </div>

          <a
            href={`/api/v1/reports/sales/export?dateFrom=${from}&dateTo=${to}${branchId ? `&branchId=${branchId}` : ''}`}
            className="mr-auto flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition text-sm"
          >
            <Download className="w-4 h-4" /> تصدير Excel
          </a>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي المبيعات', value: formatCurrency(summary?.totalRevenue ?? 0), icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
            { label: 'إجمالي الفواتير', value: formatNumber(summary?.salesCount ?? 0), icon: ShoppingCart, color: 'text-green-600 bg-green-50' },
            { label: 'متوسط قيمة الفاتورة', value: formatCurrency(summary?.avgOrderValue ?? 0), icon: DollarSign, color: 'text-amber-600 bg-amber-50' },
            { label: 'إجمالي الربح', value: formatCurrency(profit?.grossProfit ?? 0), icon: profit?.grossProfit >= 0 ? TrendingUp : TrendingDown, color: profit?.grossProfit >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-xl font-bold text-slate-800">{card.value}</p>
              <p className="text-sm text-slate-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue over time */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">إيرادات المبيعات</h2>
            {loadingSales ? (
              <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={salesReport?.timeSeries ?? []}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="total" name="الإيراد" stroke="#3b82f6" fill="url(#gradRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top products pie */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">أعلى المبيعات</h2>
            {loadingSales ? (
              <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={salesReport?.topProducts?.slice(0, 5).map((p: any) => ({
                      name: p.product?.name,
                      value: p.totalRevenue,
                    })) ?? []}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(salesReport?.topProducts ?? []).slice(0, 5).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Profit by product */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">أرباح المنتجات (أعلى 10)</h2>
            {profit && (
              <span className="text-sm text-slate-500">
                هامش الربح الإجمالي: <span className="font-bold text-green-600">{profit.marginPct}%</span>
              </span>
            )}
          </div>
          {loadingProfit ? (
            <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={profitReport?.byProduct?.slice(0, 10).map((p: any) => ({
                name: p.product?.name?.substring(0, 20),
                revenue: p.revenue,
                cost: p.cost,
                profit: p.profit,
              })) ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="revenue" name="الإيراد" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="الربح" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
