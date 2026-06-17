import React, { useEffect } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface TorrentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleteWithFiles: boolean;
  setDeleteWithFiles: (value: boolean) => void;
  isSingleDelete: boolean;
  selectedCount?: number;
}

export const TorrentDeleteModal: React.FC<TorrentDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  deleteWithFiles,
  setDeleteWithFiles,
  isSingleDelete,
  selectedCount = 0
}) => {
  // Verrouiller le scroll de la page arrière sur mobile
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
      {/* Overlay avec flou */}
      <div
        className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm animate-premium-fade"
        onClick={onClose}
      />

      <div className="relative w-[260px] landscape:w-[320px] md:w-full md:max-w-[550px] max-h-[85vh] flex flex-col glass-card border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-premium-fade mx-auto">
        {/* Contenu scrollable si l'écran est vraiment minuscule */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* En-tête */}
          <div className="p-3 landscape:p-2 md:p-8 pb-0">
            <div className="flex justify-between items-center mb-2 md:mb-8">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="p-1.5 landscape:p-1 md:p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4 landscape:h-3 landscape:w-3 md:h-8 md:w-8 text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm landscape:text-xs md:text-2xl font-black text-white uppercase tracking-tighter">
                    Confirmation
                  </h2>
                  <p className="hidden md:block text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">Action irréversible</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 landscape:p-1 md:p-3 rounded-xl bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-4 w-4 landscape:h-3 landscape:w-3 md:h-6 md:w-6" />
              </button>
            </div>

            <div className="space-y-2 landscape:space-y-1.5 md:space-y-8">
              <p className="text-[11px] landscape:text-[9px] md:text-xl text-gray-300 font-medium leading-tight md:leading-relaxed">
                {isSingleDelete
                  ? 'Voulez-vous vraiment supprimer ce torrent ?'
                  : `Voulez-vous supprimer ces ${selectedCount} torrents ?`}
              </p>

              <div className="flex flex-col landscape:flex-row md:flex-col gap-1.5 landscape:gap-1 md:gap-5">
                <label
                  className={`flex items-center gap-2 landscape:gap-1.5 md:gap-6 p-2 landscape:p-1.5 md:p-6 rounded-xl md:rounded-2xl border transition-all cursor-pointer flex-1 ${deleteWithFiles
                      ? 'bg-red-500/10 border-red-500/40 text-white shadow-[0_0_30px_rgba(239,68,68,0.15)]'
                      : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                    }`}
                >
                  <input
                    type="radio"
                    checked={deleteWithFiles}
                    onChange={() => setDeleteWithFiles(true)}
                    className="hidden"
                  />
                  <div className={`w-3.5 h-3.5 landscape:w-2.5 landscape:h-2.5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${deleteWithFiles ? 'border-red-500' : 'border-gray-700'}`}>
                    {deleteWithFiles && <div className="w-1.5 h-1.5 landscape:w-1 landscape:h-1 md:w-3 md:h-3 bg-red-500 rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] landscape:text-[8px] md:text-lg font-black uppercase tracking-tight truncate">Avec fichiers</div>
                    <div className="hidden md:block text-[12px] font-medium opacity-60 mt-1">Le torrent et les données sur le disque</div>
                  </div>
                  <Trash2 size={24} className={`hidden md:block ${deleteWithFiles ? 'text-red-500' : 'text-gray-700'}`} />
                </label>

                <label
                  className={`flex items-center gap-2 landscape:gap-1.5 md:gap-6 p-2 landscape:p-1.5 md:p-6 rounded-xl md:rounded-2xl border transition-all cursor-pointer flex-1 ${!deleteWithFiles
                      ? 'bg-blue-500/10 border-blue-500/40 text-white shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                      : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                    }`}
                >
                  <input
                    type="radio"
                    checked={!deleteWithFiles}
                    onChange={() => setDeleteWithFiles(false)}
                    className="hidden"
                  />
                  <div className={`w-3.5 h-3.5 landscape:w-2.5 landscape:h-2.5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${!deleteWithFiles ? 'border-blue-500' : 'border-gray-700'}`}>
                    {!deleteWithFiles && <div className="w-1.5 h-1.5 landscape:w-1 landscape:h-1 md:w-3 md:h-3 bg-blue-500 rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] landscape:text-[8px] md:text-lg font-black uppercase tracking-tight truncate">Torrent seul</div>
                    <div className="hidden md:block text-[12px] font-medium opacity-60 mt-1">Conserve les fichiers sur votre serveur</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="p-3 landscape:p-2 md:p-8 mt-2 landscape:mt-1 md:mt-4 flex gap-2 md:gap-4 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="flex-1 px-3 landscape:px-2 py-2 landscape:py-1.5 md:py-5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl text-gray-400 font-bold uppercase text-[9px] landscape:text-[8px] md:text-sm tracking-widest transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-[1.5] px-3 landscape:px-2 py-2 landscape:py-1.5 md:py-5 bg-red-600 hover:bg-red-500 rounded-xl md:rounded-2xl text-white font-black uppercase text-[9px] landscape:text-[8px] md:text-sm tracking-widest transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 md:gap-3"
          >
            <Trash2 size={14} className="landscape:w-3 landscape:h-3 md:w-5 md:h-5" />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};
