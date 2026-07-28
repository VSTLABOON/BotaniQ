// ─── ZUSTAND CART STORE ─────────────────────────────────────────
// Store global del carrito con soporte para variantes de producto,
// cantidades múltiples y selectores derivados sin re-renders.
//
// Reemplaza funcionalmente a CartContext.jsx con las siguientes
// mejoras:
//   1. addItem fusiona duplicados (mismo productId + variantId)
//   2. Soporta cantidad arbitraria por línea
//   3. No requiere Provider envolvente (Zustand es standalone)
//   4. Los selectores (getSubtotal, getItemCount) permiten
//      suscripción granular por componente
// ────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../types';

// ── Interfaz del Store ───────────────────────────────────────────

interface CartStore {
  items: CartItem[];
  isOpen: boolean;

  // Acciones
  addItem: (item: Omit<CartItem, 'cartItemId'>) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, qty: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;

  // Selectores derivados
  getSubtotal: () => number;
  getItemCount: () => number;
}

// ── Implementación ───────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        set((state) => {
          // Buscar si ya existe un item con el mismo producto + variante
          const existingIndex = state.items.findIndex(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          );

          if (existingIndex !== -1) {
            // Incrementar cantidad del item existente
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + item.quantity,
            };
            return { items: updatedItems };
          }

          // Crear nueva línea con ID único
          const newItem: CartItem = {
            ...item,
            cartItemId: crypto.randomUUID(),
          };
          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (cartItemId) => {
        set((state) => ({
          items: state.items.filter((i) => i.cartItemId !== cartItemId),
        }));
      },

      updateQuantity: (cartItemId, qty) => {
        set((state) => {
          // Si la cantidad es 0 o negativa, eliminar el item
          if (qty <= 0) {
            return { items: state.items.filter((i) => i.cartItemId !== cartItemId) };
          }

          return {
            items: state.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity: qty } : i
            ),
          };
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      openCart: () => {
        set({ isOpen: true });
        document.body.style.overflow = 'hidden';
      },

      closeCart: () => {
        set({ isOpen: false });
        document.body.style.overflow = '';
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'botaniq-cart-storage',
      // Solo persistimos la lista de items, no el estado isOpen del cajón
      partialize: (state) => ({ items: state.items }),
    }
  )
);
