import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'EGP', locale = 'ar-EG'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, locale = 'ar-EG'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateOnly(date: string | Date, locale = 'ar-EG'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatNumber(n: number, locale = 'ar-EG'): string {
  return new Intl.NumberFormat(locale).format(n);
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقداً',
  CARD: 'بطاقة',
  BANK_TRANSFER: 'تحويل بنكي',
  CREDIT: 'آجل',
  MIXED: 'مختلط',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدير النظام',
  CASHIER: 'كاشير',
  WAREHOUSE: 'أمين مستودع',
  BRANCH_MANAGER: 'مدير الفرع',
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  APPROVED: 'مقبول',
  IN_TRANSIT: 'جاري الشحن',
  COMPLETED: 'مكتمل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغي',
};

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
