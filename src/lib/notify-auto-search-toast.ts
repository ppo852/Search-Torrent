import { showErrorToast, showInfoToast, showToast } from '../stores/toastStore';
import type { AutoSearchToastPayload } from './auto-search-toast-payloads';

/** Affiche un toast à partir d’un payload auto-search (film ou TV). */
export function notifyAutoSearchToastPayload(
  payload: AutoSearchToastPayload | null | undefined
): void {
  if (!payload) return;

  if (payload.variant === 'success') showToast(payload.message);
  else if (payload.variant === 'info') showInfoToast(payload.message);
  else showErrorToast(payload.message);
}
