'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, Package, Truck, X, Loader2, CheckCircle, AlertCircle, Check, Edit2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

// ─── New Purchase Modal ────────────────────────────────────────────────────
function NewPurchaseModal({ open, onClose, branchId }: { open: boolean; onClose: () => void; branchId: string }) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [items, setItems] = useState<Array<{ productId: string; productName: string; quantity: number; unitCost: number }>>([]);
  const [searchCode, setSearchCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => purchasesApi.suppliers({ limit: 100 }).then((r: any) => r.items),
    enabled: open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-search', searchCode],
    queryFn: () =>
      searchCode.length > 1
        ? import('@/lib/api').then(m => m.productsApi.list({ search: searchCode, limit: 8 })).then((r: any) => r.items)
        : Promise.resolve([]),
    enabled: open && searchCode.length > 1,
  });

  const addItem = (product: any) => {
    if (items.find(i => i.productId === product.id)) return;
    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost: Number(product.purchase_price),
    }]);
    setSearchCode('');
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const handleSubmit = async () => {
    if (!supplierId) { setError('Please select a supplier'); return; }
    if (items.length === 0) { setError('Please add at least one product'); return; }
    setLoading(true); setError('');
    try {
      await purchasesApi.create({
        branchId,
        supplierId,
        invoiceRef: invoiceRef || undefined,
        notes: notes || undefined,
        amountPaid: parseFloat(amountPaid) || 0,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory-stock'] });
      onClose();
      setItems([]); setSupplierId(''); setInvoiceRef(''); setNotes(''); setAmountPaid('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-bold">فاتورة شراء جديدة</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Supplier + Invoice Ref */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">المورد *</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">اختر المورد...</option>
                {(suppliersData || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">رقم فاتورة المورد</label>
              <input
                value={invoiceRef}
                onChange={e => setInvoiceRef(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="اختياري"
              />
            </div>
          </div>

          {/* Product search */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">إضافة منتج</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchCode}
                onChange={e => setSearchCode(e.target.value)}
                className="w-full pr-9 pl-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="ابحث بالاسم أو الكود..."
              />
            </div>
            {(productsData || []).length > 0 && (
              <div className="border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-lg">
                {(productsData as any[]).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-right text-sm"
                  >
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-slate-400 text-xs">{p.internal_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">المنتج</th>
                    <th className="text-center px-4 py-2 text-slate-500 font-medium">الكمية</th>
                    <th className="text-center px-4 py-2 text-slate-500 font-medium">سعر الوحدة</th>
                    <th className="text-center px-4 py-2 text-slate-500 font-medium">الإجمالي</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item, idx) => (
                    <tr key={item.productId}>
                      <td className="px-4 py-2 font-medium text-slate-800">{item.productName}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => setItems(prev => prev.map((i, j) => j === idx ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))}
                          className="w-16 text-center border border-slate-200 rounded-lg py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={e => setItems(prev => prev.map((i, j) => j === idx ? { ...i, unitCost: parseFloat(e.target.value) || 0 } : i))}
                          className="w-24 text-center border border-slate-200 rounded-lg py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-blue-600">
                        {formatCurrency(item.quantity * item.unitCost)}
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
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t">
                <span className="font-medium text-slate-600">الإجمالي:</span>
                <span className="font-bold text-xl text-blue-600">{formatCurrency(subtotal)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">المبلغ المدفوع</label>
              <input
                type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">ملاحظات</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="اختياري"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            حفظ الفاتورة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Supplier Modal (create/edit) ──────────────────────────────────────────
function SupplierModal({ open, item, onClose, onSave }: any) {
  const isEdit = !!item;
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [nameAr, setNameAr] = useState(item?.name_ar ?? '');
  const [contact, setContact] = useState(item?.contact ?? '');
  const [phone, setPhone] = useState(item?.phone ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!code || !name) { setError('الكود والاسم مطلوبان'); return; }
    setLoading(true); setError('');
    try {
      await onSave({
        code, name,
        nameAr: nameAr || undefined,
        contact: contact || undefined,
        phone: phone || undefined,
        email: email || undefined,
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">{isEdit ? 'تعديل المورد' : 'مورد جديد'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">كود المورد *</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                disabled={isEdit}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SUP-004" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">الهاتف</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">الاسم بالإنجليزية *</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">الاسم بالعربية</label>
            <input value={nameAr} onChange={e => setNameAr(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">جهة الاتصال</label>
              <input value={contact} onChange={e => setContact(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">البريد الإلكتروني</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
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

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showSupplierNew, setShowSupplierNew] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const branchId = user?.branchId || '';

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search, branchId],
    queryFn: () => purchasesApi.list({ page, limit: 20, branchId: branchId || undefined }).then((r: any) => r),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list-all'],
    queryFn: () => purchasesApi.suppliers({ limit: 100 }).then((r: any) => r),
  });

  const handleCreateSupplier = async (form: any) => {
    await purchasesApi.createSupplier(form);
    qc.invalidateQueries({ queryKey: ['suppliers-list-all'] });
    qc.invalidateQueries({ queryKey: ['suppliers-list'] });
    setShowSupplierNew(false);
  };

  const handleUpdateSupplier = async (form: any) => {
    await purchasesApi.updateSupplier(editSupplier.id, form);
    qc.invalidateQueries({ queryKey: ['suppliers-list-all'] });
    qc.invalidateQueries({ queryKey: ['suppliers-list'] });
    setEditSupplier(null);
  };

  return (
    <AppLayout title="المشتريات">
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">فواتير المشتريات</h1>
            <p className="text-slate-500 text-sm">{data?.total ?? 0} فاتورة</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSupplierNew(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium transition text-sm"
            >
              <Truck className="w-4 h-4" /> مورد جديد
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition text-sm"
            >
              <Plus className="w-4 h-4" /> فاتورة جديدة
            </button>
          </div>
        </div>

        {/* Suppliers summary cards */}
        {suppliersData?.items?.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {suppliersData.items.slice(0, 4).map((s: any) => (
              <button
                key={s.id}
                onClick={() => setEditSupplier(s)}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-right hover:border-blue-300 hover:shadow-md transition group relative"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Truck className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-slate-400">{s.code}</span>
                  <Edit2 className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition mr-auto" />
                </div>
                <p className="font-semibold text-slate-800 text-sm truncate">{s.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.purchase_count ?? 0} طلب</p>
                {Number(s.balance) > 0 && (
                  <p className="text-xs text-red-500 font-medium">مديونية: {formatCurrency(Number(s.balance))}</p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Purchases table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-100">
                <th className="text-right px-4 py-3">رقم الفاتورة</th>
                <th className="text-right px-4 py-3">المورد</th>
                <th className="text-right px-4 py-3">الفرع</th>
                <th className="text-right px-4 py-3">التاريخ</th>
                <th className="text-center px-4 py-3">الأصناف</th>
                <th className="text-right px-4 py-3">الإجمالي</th>
                <th className="text-right px-4 py-3">المدفوع</th>
                <th className="text-right px-4 py-3">المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading
                ? [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : (data?.items || []).map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{p.purchase_number}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.supplier?.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.branch?.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{p.item_count}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(Number(p.total))}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{formatCurrency(Number(p.amount_paid))}</td>
                    <td className="px-4 py-3">
                      {Number(p.total) - Number(p.amount_paid) > 0
                        ? <span className="text-red-500 font-medium">{formatCurrency(Number(p.total) - Number(p.amount_paid))}</span>
                        : <span className="text-green-500 text-xs">مسدد</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!isLoading && (!data?.items || data.items.length === 0) && (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد فواتير مشتريات</p>
              <p className="text-sm mt-1">اضغط "فاتورة جديدة" لإضافة أول فاتورة</p>
            </div>
          )}
        </div>
      </div>

      <NewPurchaseModal open={showNew} onClose={() => setShowNew(false)} branchId={branchId} />
      <SupplierModal
        key="create-supplier"
        open={showSupplierNew}
        onClose={() => setShowSupplierNew(false)}
        onSave={handleCreateSupplier}
      />
      <SupplierModal
        key={editSupplier?.id ?? 'edit-supplier-empty'}
        open={!!editSupplier}
        item={editSupplier}
        onClose={() => setEditSupplier(null)}
        onSave={handleUpdateSupplier}
      />
    </AppLayout>
  );
}
