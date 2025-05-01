import React from 'react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Confirmer la suppression
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-300">
            {isSingleDelete
              ? 'Êtes-vous sûr de vouloir supprimer ce torrent ?'
              : `Êtes-vous sûr de vouloir supprimer les ${selectedCount} torrents sélectionnés ?`}
          </p>

          <div className="mt-4 space-y-3 bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center gap-2 border border-blue-500 bg-blue-500/10 p-3 rounded-lg">
              <input
                type="radio"
                id="deleteWithFiles"
                name="deleteOption"
                checked={deleteWithFiles}
                onChange={() => setDeleteWithFiles(true)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded-full focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              <label htmlFor="deleteWithFiles" className="text-sm font-medium text-white flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-400" />
                Supprimer le torrent ET les fichiers téléchargés
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">Recommandé</span>
              </label>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg">
              <input
                type="radio"
                id="deleteWithoutFiles"
                name="deleteOption"
                checked={!deleteWithFiles}
                onChange={() => setDeleteWithFiles(false)}
                className="w-4 h-4 text-gray-400 bg-gray-700 border-gray-600 rounded-full focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              <label htmlFor="deleteWithoutFiles" className="text-sm text-gray-300">
                Supprimer uniquement le torrent (garder les fichiers)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
