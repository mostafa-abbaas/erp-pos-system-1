'use client';

import { Bell, Search, Moon, Sun, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';

export function Header({ title }: { title?: string }) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  useEffect(() => {
    notificationsApi.unreadCount().then((res: any) => {
      setUnread(res.data?.count ?? 0);
    }).catch(() => {});
  }, []);

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-4 shrink-0">
      {title && (
        <h1 className="text-lg font-bold text-slate-800 dark:text-white ml-auto">{title}</h1>
      )}

      <div className="flex items-center gap-2 mr-auto">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 text-sm font-medium"
        >
          <Globe className="w-4 h-4" />
          {lang === 'ar' ? 'EN' : 'عر'}
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        {/* User avatar */}
        {user && (
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user.fullName[0]}
          </div>
        )}
      </div>
    </header>
  );
}
