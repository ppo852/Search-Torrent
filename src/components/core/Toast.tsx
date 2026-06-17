import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string;
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-premium-slide-up pointer-events-none w-full max-w-md px-4 sm:px-0">
      <div className="bg-gray-900/90 backdrop-blur-xl border border-white/10 px-4 sm:px-6 py-4 rounded-2xl shadow-2xl shadow-green-500/10 flex items-center gap-4 pointer-events-auto mx-auto">
        <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
          <CheckCircle2 size={24} />
        </div>
        <div className="flex-1">
          <p className="text-white font-black uppercase text-[10px] tracking-widest opacity-50 mb-0.5">Système de transfert</p>
          <p className="text-white font-bold text-sm tracking-tight">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>,
    document.body
  );
}
