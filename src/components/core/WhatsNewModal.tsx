import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import type { WhatsNewRelease } from '../../lib/whats-new';

interface WhatsNewModalProps {
  isOpen: boolean;
  releases: WhatsNewRelease[];
  onDismiss: () => void;
  isSaving?: boolean;
}

export function WhatsNewModal({
  isOpen,
  releases,
  onDismiss,
  isSaving = false,
}: WhatsNewModalProps) {
  if (!isOpen || releases.length === 0) return null;

  const titleVersion =
    releases.length === 1 ? `v${releases[0].version}` : 'mise à jour';

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-950/80 backdrop-blur-md animate-fade-in"
        onClick={isSaving ? undefined : onDismiss}
      />

      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col glass-card border-white/10 shadow-2xl animate-premium-slide-up overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 sm:p-8 border-b border-white/5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
              <Sparkles className="text-blue-400" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Nouveautés
              </h2>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                Ce qui change pour toi — {titleVersion}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSaving}
            className="p-2 text-gray-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-8">
          {releases.map((release) => (
            <div key={release.version} className="space-y-4">
              {releases.length > 1 && (
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.25em]">
                  Version {release.version}
                </p>
              )}
              <ul className="space-y-3">
                {release.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm text-gray-300 leading-relaxed font-medium"
                  >
                    <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-6 sm:p-8 border-t border-white/5">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSaving}
            className="w-full py-4 rounded-2xl premium-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {isSaving ? 'Enregistrement...' : 'J’ai compris'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
