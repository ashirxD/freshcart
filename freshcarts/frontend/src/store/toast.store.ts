import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Errors stay longer by default. */
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

/**
 * Toasts are genuinely global (any screen can raise one, the viewport lives in
 * the root layout), which is exactly the case Zustand is here for.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: ({ title, description, variant = 'info', duration }) => {
    const id = Math.random().toString(36).slice(2, 10);
    const timeout = duration ?? (variant === 'error' ? 6000 : 4000);

    set((state) => ({ toasts: [...state.toasts, { id, title, description, variant }] }));
    setTimeout(() => get().dismiss(id), timeout);

    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Ergonomic hook for raising toasts from components. */
export const useToast = () => useToastStore((state) => state.push);
