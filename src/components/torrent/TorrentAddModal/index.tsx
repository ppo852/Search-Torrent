import React, { useState } from 'react';
import { Link, PlusCircle, Tag, Upload, X } from 'lucide-react';
import { useTorrentUpload } from '../../../hooks/useTorrentUpload';
import { FilterSelect } from '../../ui/FilterSelect';

interface TorrentAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSuccess?: () => void;
  initialFiles?: FileList | null;
  onCategoryCreated?: (newCategory: string) => void;
}

const fieldClass =
  'w-full p-2.5 sm:p-3 bg-transparent border border-blue-500/20 rounded-xl text-white text-xs sm:text-sm placeholder-white/40 focus:outline-none focus:border-blue-500/40 transition-colors';

const DEFAULT_CATEGORIES = [
  'Films',
  'Séries',
  'Anime',
  'Animation',
  'Musique',
  'Logiciels',
  'Jeux',
  'Livres',
  'Autres',
  'Sport',
  'Documentaires',
];


export const TorrentAddModal: React.FC<TorrentAddModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSuccess,
  initialFiles,
  onCategoryCreated
}) => {
  const handleSuccess = () => {
    onClose();
    onSuccess?.();
  };

  const dropRef = React.useRef<HTMLDivElement>(null);

  const {
    magnetLink,
    onMagnetChange,
    handleFiles,
    selectedCategory,
    onCategoryChange,
    tags,
    onTagsChange,
    isUploading,
    uploadError,
    addTorrent,
    createCategory,
    torrentFiles
  } = useTorrentUpload(handleSuccess);

  React.useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFiles]);

  const [canSubmit, setCanSubmit] = React.useState(false);
  React.useEffect(() => {
    const hasTorrent = !!magnetLink || (torrentFiles && torrentFiles.length > 0);
    const hasCategory = !!selectedCategory;
    setCanSubmit(hasTorrent && hasCategory);
  }, [magnetLink, torrentFiles, selectedCategory]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(file =>
        file.name.toLowerCase().endsWith('.torrent')
      );
      if (files.length > 0) {
        handleFiles(files);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const [newCategory, setNewCategory] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  if (!isOpen) return null;

  const handleCreateCategory = async () => {
    if (newCategory.trim()) {
      const createdCategory = await createCategory(newCategory.trim());
      if (createdCategory && onCategoryCreated) {
        onCategoryCreated(createdCategory);
      }
      setNewCategory('');
      setShowCategoryInput(false);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Sélectionner une catégorie' },
    ...DEFAULT_CATEGORIES.map((category) => ({ value: category, label: category })),
    ...categories
      .filter((category) => !DEFAULT_CATEGORIES.includes(category))
      .map((category) => ({ value: category, label: category })),
  ];

  const categoryMissing =
    !selectedCategory && (!!magnetLink || (torrentFiles && torrentFiles.length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="bg-gray-950 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-blue-500/20 my-auto"
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Ajouter un torrent</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-blue-600/15 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 flex items-center gap-2 text-white">
              <Link className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400/70" />
              Lien magnet
            </label>
            <input
              type="text"
              value={magnetLink}
              onChange={onMagnetChange}
              placeholder="magnet:?xt=urn:btih:..."
              className={fieldClass}
            />
          </div>

          <div className="flex items-center my-2">
            <div className="flex-1 h-px bg-blue-500/20"></div>
            <span className="px-3 text-xs sm:text-sm text-blue-400/60 font-medium">OU</span>
            <div className="flex-1 h-px bg-blue-500/20"></div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 flex items-center gap-2 text-white">
              <Upload className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400/70" />
              Fichier torrent
            </label>
            <input
              type="file"
              multiple
              accept=".torrent"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              id="torrent-upload-input"
            />
            <label
              htmlFor="torrent-upload-input"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 text-blue-300 border border-blue-500/20 rounded-xl cursor-pointer hover:bg-blue-600/20 hover:border-blue-500/40 transition-all text-xs sm:text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Fichier
            </label>
            {torrentFiles && torrentFiles.length > 0 && (
              <div className="mt-2 space-y-1 text-xs text-blue-400/70">
                {torrentFiles.map((file, idx) => (
                  <div key={idx} className="truncate">{file.name}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5 sm:mb-2">
              <label className="block text-xs sm:text-sm font-medium text-white">Catégorie</label>
              <button
                type="button"
                onClick={() => setShowCategoryInput(!showCategoryInput)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                {showCategoryInput ? 'Annuler' : 'Nouvelle catégorie'}
              </button>
            </div>

            {showCategoryInput ? (
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nom de la catégorie"
                  className={`flex-1 ${fieldClass}`}
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategory.trim()}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    !newCategory.trim()
                      ? 'bg-blue-600/5 text-blue-400/40 border border-blue-500/10 cursor-not-allowed'
                      : 'bg-blue-600/10 text-blue-300 border border-blue-500/20 hover:bg-blue-600/20'
                  }`}
                >
                  Créer
                </button>
              </div>
            ) : (
              <div className={categoryMissing ? '[&_button]:border-red-500/50' : ''}>
                <FilterSelect
                  value={selectedCategory}
                  onChange={onCategoryChange}
                  options={categoryOptions}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 flex items-center gap-2 text-white">
              <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400/70" />
              Tags (séparés par des virgules)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => onTagsChange(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className={fieldClass}
            />
          </div>

          {uploadError && (
            <div className="p-2.5 sm:p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-xs sm:text-sm">
              {uploadError}
            </div>
          )}

          <div className="flex justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-transparent border border-blue-500/20 text-white/80 hover:bg-blue-600/10 hover:border-blue-500/40 transition-all text-xs sm:text-sm font-medium"
            >
              Annuler
            </button>
            <button
              onClick={addTorrent}
              disabled={isUploading || !canSubmit}
              className={`px-4 py-2 premium-gradient text-white rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/20 ${
                isUploading || !canSubmit
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Ajout en cours...
                </>
              ) : (
                'Ajouter'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
