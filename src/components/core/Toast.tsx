import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastVariant } from '../../stores/toastStore';

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; iconWrap: string; shadow: string; label: string }
> = {
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-green-500/10 text-green-500',
    shadow: 'shadow-green-500/10',
    label: 'Succès',
  },
  error: {
    icon: AlertCircle,
    iconWrap: 'bg-red-500/10 text-red-500',
    shadow: 'shadow-red-500/10',
    label: 'Erreur',
  },
  info: {
    icon: Info,
    iconWrap: 'bg-blue-500/10 text-blue-500',
    shadow: 'shadow-blue-500/10',
    label: 'Information',
  },
};

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
}

export function Toast({ message, variant = 'success', onClose }: ToastProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-premium-slide-up pointer-events-none w-full max-w-md px-4 sm:px-0 pb-safe">
      <div
        className={`bg-gray-900/90 backdrop-blur-xl border border-white/10 px-4 sm:px-6 py-4 rounded-2xl shadow-2xl ${styles.shadow} flex items-center gap-4 pointer-events-auto mx-auto`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconWrap}`}>
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black uppercase text-[10px] tracking-widest opacity-50 mb-0.5">
            {styles.label}
          </p>
          <p className="text-white font-bold text-sm tracking-tight break-words">{message}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
