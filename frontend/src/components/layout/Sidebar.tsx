'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, BarChart3,
  Users, Settings, LogOut, Bell, Truck, ArrowLeftRight, ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const NAV = [
  { href: '/', label: 'لوحة التحكم', labelEn: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN','CASHIER','WAREHOUSE','BRANCH_MANAGER'] },
  { href: '/pos', label: 'نقطة البيع', labelEn: 'POS', icon: ShoppingCart, roles: ['ADMIN','CASHIER','BRANCH_MANAGER'] },
  { href: '/products', label: 'المنتجات', labelEn: 'Products', icon: Package, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
  { href: '/inventory', label: 'المخزون', labelEn: 'Inventory', icon: Warehouse, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
  { href: '/transfers', label: 'التحويلات', labelEn: 'Transfers', icon: ArrowLeftRight, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
  { href: '/purchases', label: 'المشتريات', labelEn: 'Purchases', icon: Truck, roles: ['ADMIN','WAREHOUSE','BRANCH_MANAGER'] },
  { href: '/reports', label: 'التقارير', labelEn: 'Reports', icon: BarChart3, roles: ['ADMIN','BRANCH_MANAGER'] },
  { href: '/users', label: 'المستخدمون', labelEn: 'Users', icon: Users, roles: ['ADMIN'] },
  { href: '/settings', label: 'الإعدادات', labelEn: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = NAV.filter((n) => !user || n.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar flex flex-col transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60',
      )}
      dir="rtl"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-sm leading-tight">نظام البيع</div>
            <div className="text-slate-400 text-xs">قطع غيار الأجهزة</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mr-auto text-slate-400 hover:text-white transition"
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-sidebar-hover hover:text-white',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-700 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user.fullName[0]}
            </div>
            <div className="overflow-hidden">
              <div className="text-white text-sm font-medium truncate">{user.fullName}</div>
              <div className="text-slate-400 text-xs">{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition text-sm',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}
