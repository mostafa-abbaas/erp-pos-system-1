'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api';
import { Plus, Edit2, Trash2, Tag, X, Check, Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

function CategoryModal({ open, item, onClose, onSave }: any) {
  const isEdit = !!item;
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [nameAr, setNameAr] = useState(item?.name_ar ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!code || !name) { setError('الكود والاسم مطلوبان'); return; }
    setLoading(true); setError('');
    try { await onSave({ code, name, nameAr: nameAr || undefined }); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">{isEdit ? 'تعديل الفئة' : 'فئة جديدة'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">كود الفئة *</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="مثال: ELEC" disabled={isEdit} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">الاسم بالإنجليزية *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">الاسم بالعربية</label>
            <input value={nameAr} onChange={e => setNameAr(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'categories' | 'brands'>('categories');
  const [editItem, setEditItem] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const { data: catData } = useQuery({
    queryKey: ['categories-manage', search],
    queryFn: () => categoriesApi.list({ search: search || undefined, limit: 50 }).then((r: any) => r),
    enabled: tab === 'categories',
  });

  const { data: brandData } = useQuery({
    queryKey: ['brands-manage', search],
    queryFn: () => categoriesApi.brands({ search: search || undefined }).then((r: any) => r),
    enabled: tab === 'brands',
  });

  const handleCreateCategory = async (form: any) => {
    await categoriesApi.create(form);
    qc.invalidateQueries({ queryKey: ['categories-manage'] });
    setShowCreate(false);
  };

  const handleUpdateCategory = async (form: any) => {
    await categoriesApi.update(editItem.id, form);
    qc.invalidateQueries({ queryKey: ['categories-manage'] });
    setEditItem(null);
  };

  const handleCreateBrand = async (form: any) => {
    await categoriesApi.createBrand(form);
    qc.invalidateQueries({ queryKey: ['brands-manage'] });
    setShowCreate(false);
  };

  const handleUpdateBrand = async (form: any) => {
    await categoriesApi.updateBrand(editItem.id, form);
    qc.invalidateQueries({ queryKey: ['brands-manage'] });
    setEditItem(null);
  };

  const items = tab === 'categories' ? catData?.items ?? [] : brandData?.data ?? [];

  return (
    <AppLayout title="الفئات والعلامات التجارية">
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">الفئات والعلامات التجارية</h1>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">
            <Plus className="w-4 h-4" /> إضافة جديد
          </button>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {([['categories', 'الفئات'], ['brands', 'العلامات التجارية']] as const).map(([t, l]) => (
            <button key={t} onClick={() => { setTab(t); setSearch(''); }}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}>
              {l}
            </button>
          ))}
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          placeholder="بحث..." />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item: any) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setEditItem(item)} className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
              {(item.name_ar || item.nameAr) && <p className="text-xs text-slate-400 mt-0.5">{item.name_ar || item.nameAr}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{item.code || '—'}</span>
                {item.product_count !== undefined && (
                  <span className="text-xs text-slate-400">{item.product_count} منتج</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CategoryModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={tab === 'categories' ? handleCreateCategory : handleCreateBrand}
      />
      <CategoryModal
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={tab === 'categories' ? handleUpdateCategory : handleUpdateBrand}
      />
    </AppLayout>
  );
}
