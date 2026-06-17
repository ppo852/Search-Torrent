import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  isDanger?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onClose,
  isDanger = true
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-gray-950/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md glass-card border-white/10 p-8 shadow-2xl animate-premium-slide-up">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ${
            isDanger ? 'bg-red-500/10 text-red-500 shadow-red-500/10' : 'bg-blue-500/10 text-blue-500 shadow-blue-500/10'
          }`}>
            <AlertTriangle size={40} />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
              {title}
            </h3>
            <p className="text-gray-400 text-sm font-medium leading-relaxed px-4">
              {message}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all order-2 sm:order-1"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] order-1 sm:order-2 ${
                isDanger 
                  ? 'bg-red-600 text-white shadow-red-600/30 hover:bg-red-500' 
                  : 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
