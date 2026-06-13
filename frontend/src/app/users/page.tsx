'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ROLE_LABELS, formatDate } from '@/lib/utils';
import { Plus, Edit2, UserX, Key, X, Check, Loader2, AlertCircle, Users, Shield } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  BRANCH_MANAGER: 'bg-purple-100 text-purple-700',
  CASHIER: 'bg-blue-100 text-blue-700',
  WAREHOUSE: 'bg-amber-100 text-amber-700',
};

function UserFormModal({ open, user, branches, onClose, onSave }: any) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username ?? '',
    email: user?.email ?? '',
    fullName: user?.full_name ?? '',
    fullNameAr: user?.full_name_ar ?? '',
    role: user?.role ?? 'CASHIER',
    branchId: user?.branch_id ?? '',
    status: user?.status ?? 'ACTIVE',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.fullName || !form.username) { setError('الاسم واسم المستخدم مطلوبان'); return; }
    if (!isEdit && form.password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    setLoading(true); setError('');
    try {
      const payload: any = { username: form.username, email: form.email || undefined, fullName: form.fullName, fullNameAr: form.fullNameAr || undefined, role: form.role, branchId: form.branchId || undefined, status: form.status };
      if (!isEdit) payload.password = form.password;
      await onSave(payload);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold">{isEdit ? 'تعديل المستخدم' : 'مستخدم جديد'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">اسم المستخدم *</label>
              <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">البريد الإلكتروني</label>
              <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">الاسم (English) *</label>
              <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">الاسم بالعربي</label>
              <input value={form.fullNameAr} onChange={e => setForm(p => ({ ...p, fullNameAr: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">الدور الوظيفي *</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">الفرع</label>
              <select value={form.branchId} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">بدون فرع</option>
                {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">الحالة</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="ACTIVE">نشط</option>
                  <option value="INACTIVE">غير نشط</option>
                  <option value="SUSPENDED">موقوف</option>
                </select>
              </div>
            )}
            {!isEdit && (
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-700 block mb-1">كلمة المرور *</label>
                <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} type="password"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="8 أحرف على الأقل" />
              </div>
            )}
          </div>
          {error && <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, limit: 20, search: search || undefined }).then((r: any) => r),
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => usersApi.branches().then((r: any) => r.data),
  });

  const handleCreate = async (form: any) => {
    await usersApi.create(form);
    qc.invalidateQueries({ queryKey: ['users'] });
    setShowCreate(false);
  };

  const handleUpdate = async (form: any) => {
    await usersApi.update(editUser.id, form);
    qc.invalidateQueries({ queryKey: ['users'] });
    setEditUser(null);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { alert('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    setResetLoading(true);
    try {
      await usersApi.resetPassword(resetUserId!, { newPassword });
      setResetUserId(null);
      setNewPassword('');
      alert('تم تغيير كلمة المرور بنجاح');
    } catch (e: any) { alert(e.message); }
    finally { setResetLoading(false); }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('هل تريد إلغاء تفعيل هذا المستخدم؟')) return;
    await usersApi.deactivate(id);
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  return (
    <AppLayout title="إدارة المستخدمين">
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">المستخدمون</h1>
            <p className="text-slate-500 text-sm">{data?.total ?? 0} مستخدم</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition text-sm">
            <Plus className="w-4 h-4" /> مستخدم جديد
          </button>
        </div>

        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          placeholder="بحث بالاسم أو اسم المستخدم..." />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                <th className="text-right px-4 py-3">المستخدم</th>
                <th className="text-right px-4 py-3">الدور</th>
                <th className="text-right px-4 py-3">الفرع</th>
                <th className="text-right px-4 py-3">آخر تسجيل دخول</th>
                <th className="text-center px-4 py-3">الحالة</th>
                <th className="text-center px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading
                ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>)
                : (data?.items || []).map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {u.full_name?.[0] ?? u.username[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.full_name}</p>
                          <p className="text-xs text-slate-400">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600')}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.branch?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('ar-EG') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        u.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500')}>
                        {u.status === 'ACTIVE' ? 'نشط' : u.status === 'SUSPENDED' ? 'موقوف' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditUser(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition" title="تعديل">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setResetUserId(u.id); setNewPassword(''); }} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition" title="إعادة تعيين كلمة المرور">
                          <Key className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && u.status === 'ACTIVE' && (
                          <button onClick={() => handleDeactivate(u.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="إلغاء التفعيل">
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormModal open={showCreate} branches={branchesData} onClose={() => setShowCreate(false)} onSave={handleCreate} />
      <UserFormModal open={!!editUser} user={editUser} branches={branchesData} onClose={() => setEditUser(null)} onSave={handleUpdate} />

      {/* Reset Password Modal */}
      {resetUserId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">إعادة تعيين كلمة المرور</h3>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)" />
            <div className="flex gap-3">
              <button onClick={() => setResetUserId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm">إلغاء</button>
              <button onClick={handleResetPassword} disabled={resetLoading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                تغيير كلمة المرور
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
