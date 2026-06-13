'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { Settings, Key, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPwError('كلمات المرور غير متطابقة'); return; }
    if (newPassword.length < 8) { setPwError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    setPwLoading(true); setPwError(''); setPwSuccess(false);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (e: any) {
      setPwError(e.message || 'فشل تغيير كلمة المرور');
    } finally { setPwLoading(false); }
  };

  return (
    <AppLayout title="الإعدادات">
      <div className="max-w-2xl space-y-6" dir="rtl">
        <div>
          <h1 className="text-xl font-bold text-slate-800">إعدادات الحساب</h1>
          <p className="text-slate-500 text-sm mt-1">إدارة بيانات حسابك وإعدادات الأمان</p>
        </div>

        {/* Profile info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
              {(user?.fullNameAr || user?.fullName)?.[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">{user?.fullNameAr || user?.fullName}</h2>
              <p className="text-slate-400 text-sm">@{user?.username}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: 'اسم المستخدم', value: user?.username },
              { label: 'البريد الإلكتروني', value: user?.email || '—' },
              { label: 'الدور الوظيفي', value: user?.role },
              { label: 'الفرع', value: user?.branch?.name || '—' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">{item.label}</p>
                <p className="font-medium text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">تغيير كلمة المرور</h3>
              <p className="text-slate-400 text-xs">يُنصح بتغيير كلمة المرور دورياً</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">كلمة المرور الحالية</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">كلمة المرور الجديدة</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="8 أحرف على الأقل"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm',
                  confirmPassword && newPassword !== confirmPassword ? 'border-red-300' : 'border-slate-200',
                )}
                placeholder="أعد كتابة كلمة المرور"
              />
            </div>

            {pwError && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" /> {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3">
                <CheckCircle className="w-4 h-4 shrink-0" /> تم تغيير كلمة المرور بنجاح
              </div>
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm transition"
            >
              {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {pwLoading ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
            </button>
          </form>
        </div>

        {/* System info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="font-bold text-slate-800">معلومات النظام</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'الإصدار', value: 'v1.0.0' },
              { label: 'قاعدة البيانات', value: 'PostgreSQL 16' },
              { label: 'الواجهة الخلفية', value: 'NestJS' },
              { label: 'الواجهة الأمامية', value: 'Next.js 14' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-medium text-slate-700">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
