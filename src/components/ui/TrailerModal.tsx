import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getVideoEmbedUrl, type TmdbVideo } from '../../lib/tmdb-videos';

interface TrailerModalProps {
  isOpen: boolean;
  video: TmdbVideo | null;
  title?: string;
  onClose: () => void;
}

export function TrailerModal({ isOpen, video, title, onClose }: TrailerModalProps) {
  if (!isOpen || !video) return null;

  const embedUrl = getVideoEmbedUrl(video);
  if (!embedUrl) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-gray-950/90 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 mx-auto w-full max-w-4xl max-h-[90dvh] flex flex-col glass-card border-white/10 shadow-2xl animate-premium-fade overflow-hidden"
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/5 shrink-0">
          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest truncate pr-4">
            {title || video.name || 'Bande-annonce'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative w-full aspect-video bg-black shrink-0 min-h-0">
          <iframe
            src={embedUrl}
            title={title || 'Bande-annonce'}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
