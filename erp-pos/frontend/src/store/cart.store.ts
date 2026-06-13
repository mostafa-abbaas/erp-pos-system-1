import { create } from 'zustand';

export interface CartItem {
  productId: string;
  internalCode: string;
  barcode?: string;
  name: string;
  nameAr?: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  total: number;
}

interface CartState {
  items: CartItem[];
  discountPct: number;
  discountAmount: number;
  customerId: string | null;
  customerName: string | null;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'MIXED';
  amountPaid: number;
  notes: string;

  addItem: (product: any) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  updateDiscount: (productId: string, discountPct: number) => void;
  setGlobalDiscount: (pct: number, amount: number) => void;
  setCustomer: (id: string | null, name: string | null) => void;
  setPaymentMethod: (method: CartState['paymentMethod']) => void;
  setAmountPaid: (amount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;

  // Computed
  subtotal: () => number;
  taxTotal: () => number;
  total: () => number;
  change: () => number;
  itemCount: () => number;
}

const calcItemTotal = (item: CartItem) => {
  const base = item.unitPrice * item.quantity;
  const afterDiscount = base * (1 - item.discountPct / 100);
  const tax = afterDiscount * (item.taxRate / 100);
  return afterDiscount + tax;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discountPct: 0,
  discountAmount: 0,
  customerId: null,
  customerName: null,
  paymentMethod: 'CASH',
  amountPaid: 0,
  notes: '',

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + 1, total: calcItemTotal({ ...i, quantity: i.quantity + 1 }) }
              : i,
          ),
        };
      }
      const newItem: CartItem = {
        productId: product.id,
        internalCode: product.internalCode,
        barcode: product.barcode,
        name: product.name,
        nameAr: product.nameAr,
        quantity: 1,
        unitPrice: Number(product.sellingPrice),
        discountPct: 0,
        taxRate: Number(product.taxRate || 0),
        total: 0,
      };
      newItem.total = calcItemTotal(newItem);
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

  updateQty: (productId, qty) => {
    if (qty < 1) return;
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, quantity: qty, total: calcItemTotal({ ...i, quantity: qty }) }
          : i,
      ),
    }));
  },

  updateDiscount: (productId, discountPct) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, discountPct, total: calcItemTotal({ ...i, discountPct }) }
          : i,
      ),
    }));
  },

  setGlobalDiscount: (pct, amount) => set({ discountPct: pct, discountAmount: amount }),
  setCustomer: (id, name) => set({ customerId: id, customerName: name }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setAmountPaid: (amount) => set({ amountPaid: amount }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      discountPct: 0,
      discountAmount: 0,
      customerId: null,
      customerName: null,
      paymentMethod: 'CASH',
      amountPaid: 0,
      notes: '',
    }),

  subtotal: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
  taxTotal: () =>
    get().items.reduce((s, i) => {
      const base = i.unitPrice * i.quantity * (1 - i.discountPct / 100);
      return s + base * (i.taxRate / 100);
    }, 0),
  total: () => {
    const state = get();
    const subtotal = state.subtotal();
    const discount = state.discountAmount || (subtotal * state.discountPct) / 100;
    const tax = state.taxTotal();
    return subtotal - discount + tax;
  },
  change: () => Math.max(0, get().amountPaid - get().total()),
  itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
}));
