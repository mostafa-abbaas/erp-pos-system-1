'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, categoriesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Search, Upload, Download, Filter, Edit2, Trash2,
  Package, AlertTriangle, CheckCircle, X, Loader2, Barcode, Check,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

function ProductModal({ open, item, onClose, onSave }: any) {
  const isEdit = !!item;
  const [internalCode, setInternalCode] = useState(item?.internal_code ?? item?.internalCode ?? '');
  const [barcode, setBarcode] = useState(item?.barcode ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [nameAr, setNameAr] = useState(item?.name_ar ?? item?.nameAr ?? '');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? item?.category?.id ?? '');
  const [purchasePrice, setPurchasePrice] = useState(item?.purchase_price ?? item?.purchasePrice ?? '');
  const [sellingPrice, setSellingPrice] = useState(item?.selling_price ?? item?.sellingPrice ?? '');
  const [minStockAlert, setMinStockAlert] = useState(item?.min_stock_alert ?? item?.minStockAlert ?? '5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories-for-product-modal'],
    queryFn: () => productsApi.categories().then((r: any) => r.data),
    enabled: open,
  });

  const handleSave = async () => {
    if (!internalCode || !name) { setError('الكود والاسم مطلوبان'); return; }
    setLoading(true); setError('');
    try {
      await onSave({
        internalCode,
        barcode: barcode || undefined,
        name,
        nameAr: nameAr || undefined,
        categoryId: categoryId || undefined,
        purchasePrice: parseFloat(purchasePrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        minStockAlert: parseInt(minStockAlert) || 5,
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-slate-800">{isEdit ? 'تعديل المنتج' : 'منتج جديد'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">الكود الداخلي *</label>
              <input value={internalCode} onChange={e => setInternalCode(e.target.value.toUpperCase())}
                disabled={isEdit}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SP-021" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">الباركود</label>
              <input value={barcode} onChange={e => setBarcode(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="اختياري" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">الاسم بالإنجليزية *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">الاسم بالعربية</label>
            <input value={nameAr} onChange={e => setNameAr(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">الفئة</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">بدون فئة</option>
              {(categories || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">سعر الشراء</label>
              <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">سعر البيع</label>
              <input type="number" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">حد التنبيه</label>
              <input type="number" value={minStockAlert} onChange={e => setMinStockAlert(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    default: 'bg-slate-100 text-slate-600',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => productsApi.list({ search, page, limit: 20 }).then((r: any) => r),
    placeholderData: (prev) => prev,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => productsApi.lowStock().then((r: any) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const handleCreateProduct = async (form: any) => {
    await productsApi.create(form);
    qc.invalidateQueries({ queryKey: ['products'] });
    setShowCreate(false);
  };

  const handleUpdateProduct = async (form: any) => {
    await productsApi.update(editItem.id, form);
    qc.invalidateQueries({ queryKey: ['products'] });
    setEditItem(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res: any = await productsApi.importExcel(file);
      setImportResult(res.data);
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <AppLayout title="إدارة المنتجات">
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">المنتجات</h1>
            <p className="text-slate-500 text-sm">
              {data?.total ? `${data.total} منتج` : 'جارٍ التحميل...'}
              {lowStock?.length > 0 && (
                <span className="text-red-500 mr-2">· {lowStock.length} منتج ينخفض مخزونه</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={productsApi.exportExcel()}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition text-sm"
            >
              <Download className="w-4 h-4" /> تصدير Excel
            </a>
            <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition text-sm cursor-pointer">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              استيراد Excel
              <input type="file" accept=".xlsx,.csv" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> منتج جديد
            </button>
          </div>
        </div>

        {/* Import result */}
        {importResult && (
          <div className={cn(
            'rounded-xl p-4 flex items-start gap-3',
            importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700',
          )}>
            {importResult.error
              ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              : <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm">
              {importResult.error
                ? importResult.error
                : `تم الاستيراد: ${importResult.success} منتج جديد، ${importResult.skipped} تحديث، ${importResult.errors?.length} خطأ`}
            </div>
            <button onClick={() => setImportResult(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="بحث بالاسم، الكود، أو الباركود..."
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                  <th className="text-right px-4 py-3">الكود</th>
                  <th className="text-right px-4 py-3">المنتج</th>
                  <th className="text-right px-4 py-3">الباركود</th>
                  <th className="text-right px-4 py-3">الفئة</th>
                  <th className="text-right px-4 py-3">سعر الشراء</th>
                  <th className="text-right px-4 py-3">سعر البيع</th>
                  <th className="text-right px-4 py-3">الحالة</th>
                  <th className="text-center px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading
                  ? [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                  : data?.items?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg">
                          {p.internal_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{p.name}</p>
                          {p.name_ar && <p className="text-xs text-slate-400">{p.name_ar}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.barcode ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Barcode className="w-3 h-3" />
                            {p.barcode}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.category ? (
                          <Badge>{p.category.name}</Badge>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">
                        {formatCurrency(Number(p.purchase_price))}
                      </td>
                      <td className="px-4 py-3 font-bold text-blue-600">
                        {formatCurrency(Number(p.selling_price))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={p.is_active ? 'green' : 'red'}>
                          {p.is_active ? 'نشط' : 'غير نشط'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditItem(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('هل تريد إلغاء تفعيل هذا المنتج؟'))
                                deleteMutation.mutate(p.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                صفحة {page} من {data.totalPages} — {data.total} منتج
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProductModal
        key="create-product"
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreateProduct}
      />
      <ProductModal
        key={editItem?.id ?? 'edit-product-empty'}
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleUpdateProduct}
      />
    </AppLayout>
  );
}
