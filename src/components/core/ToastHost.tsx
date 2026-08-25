import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '../../stores/toastStore';
import { Toast } from './Toast';

const AUTO_DISMISS_MS = 3500;

export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;

  return createPortal(
    <Toast message={toast.message} variant={toast.variant} onClose={dismiss} />,
    document.body
  );
}
