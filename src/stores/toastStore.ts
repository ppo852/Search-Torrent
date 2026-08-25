import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  variant: ToastVariant;
  id: number;
}

interface ToastStore {
  toast: ToastState | null;
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  show: (message, variant = 'success') => {
    set({ toast: { message, variant, id: Date.now() } });
  },
  dismiss: () => set({ toast: null }),
}));

export function showToast(message: string, variant: ToastVariant = 'success') {
  useToastStore.getState().show(message, variant);
}

export function showErrorToast(message: string) {
  showToast(message, 'error');
}

export function showInfoToast(message: string) {
  showToast(message, 'info');
}

export function getApiErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  const e = err as { data?: { error?: string }; message?: string } | null;
  return e?.data?.error || e?.message || fallback;
}

/** 409 médiathèque / déjà demandé, 404 export .torrent, etc. → toast info plutôt qu’erreur. */
export function isSoftApiError(err: unknown, message?: string): boolean {
  const e = err as { status?: number } | null;
  const msg = message ?? getApiErrorMessage(err, '');
  return (
    e?.status === 409 ||
    e?.status === 404 ||
    /déjà présent|déjà demandé|non exportable/i.test(String(msg))
  );
}

export function showApiErrorToast(err: unknown, fallback = 'Une erreur est survenue') {
  const msg = getApiErrorMessage(err, fallback);
  if (isSoftApiError(err, msg)) {
    showInfoToast(msg);
  } else {
    showErrorToast(msg);
  }
}
