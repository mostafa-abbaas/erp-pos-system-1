'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Eye, EyeOff, ShoppingBag, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f172a] flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-4">نظام إدارة المتجر والمستودع</h1>
          <p className="text-slate-400 text-lg mb-8">
            نظام متكامل لإدارة قطع غيار الأجهزة المنزلية — نقطة البيع، المستودع، التقارير
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: 'نقطة بيع سريعة', desc: 'دعم الباركود والكيبورد' },
              { label: 'إدارة المخزون', desc: 'تتبع حركة البضاعة' },
              { label: 'تقارير متقدمة', desc: 'أرباح ومبيعات ومخزون' },
              { label: 'متزامن في الوقت الفعلي', desc: 'بين المتجر والمستودع' },
            ].map((f) => (
              <div key={f.label} className="bg-slate-800 rounded-xl p-4 text-right">
                <div className="font-semibold text-blue-400 mb-1">{f.label}</div>
                <div className="text-slate-400 text-xs">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="lg:hidden w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">تسجيل الدخول</h2>
              <p className="text-slate-500 mt-1">أدخل بيانات حسابك للمتابعة</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 text-slate-800 transition"
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 text-slate-800 transition pl-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جارٍ تسجيل الدخول...
                  </>
                ) : (
                  'تسجيل الدخول'
                )}
              </button>
            </form>

            <div className="mt-6 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
              الحساب الافتراضي: <span className="font-mono font-semibold">admin / Admin@1234</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
