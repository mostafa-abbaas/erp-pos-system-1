'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, BarChart3,
  Users, Settings, LogOut, Truck, ArrowLeftRight, ChevronLeft,
  Clock, Tag, ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ROLE_LABELS } from '@/lib/utils';

const NAV = [
  {
    group: 'البيع',
    items: [
      { href: '/', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['ADMIN','CASHIER','WAREHOUSE','BRANCH_MANAGER'] },
      { href: '/pos', label: 'نقطة البيع', icon: ShoppingCart, roles: ['ADMIN','CASHIER','BRANCH_MANAGER'] },
      { href: '/shifts', label: 'الورديات', icon: Clock, roles: ['ADMIN','CASHIER','BRANCH_MANAGER'] },
    ],
  },
  {
    group: 'المخزون',
    items: [
      { href: '/products', label: 'المنتجات', icon: Package, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
      { href: '/inventory', label: 'المخزون', icon: Warehouse, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
      { href: '/transfers', label: 'التحويلات', icon: ArrowLeftRight, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
      { href: '/purchases', label: 'المشتريات', icon: Truck, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
    ],
  },
  {
    group: 'الإدارة',
    items: [
      { href: '/reports', label: 'التقارير', icon: BarChart3, roles: ['ADMIN','BRANCH_MANAGER'] },
      { href: '/users', label: 'المستخدمون', icon: Users, roles: ['ADMIN'] },
      { href: '/categories', label: 'الفئات والماركات', icon: Tag, roles: ['ADMIN','BRANCH_MANAGER'] },
      { href: '/settings', label: 'الإعدادات', icon: Settings, roles: ['ADMIN'] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar flex flex-col transition-all duration-300 shrink-0 z-40',
        collapsed ? 'w-16' : 'w-60',
      )}
      dir="rtl"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <div className="text-white font-bold text-sm leading-tight">نظام البيع والمستودع</div>
            <div className="text-slate-400 text-xs mt-0.5">قطع غيار الأجهزة</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-500 hover:text-white transition p-1 rounded-lg hover:bg-slate-700/50"
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {NAV.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !user || item.roles.includes(user.role),
          );
          if (!visibleItems.length) return null;

          return (
            <div key={group.group} className="mb-2">
              {!collapsed && (
                <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  {group.group}
                </p>
              )}
              <div className="px-2 space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                        active
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100',
                        collapsed && 'justify-center px-2',
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/50 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-1 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {(user.fullNameAr || user.fullName)?.[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-white text-xs font-semibold truncate">
                {user.fullNameAr || user.fullName}
              </div>
              <div className="text-slate-400 text-[10px]">
                {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition text-sm',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}
