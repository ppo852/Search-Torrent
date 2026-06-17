import React, { useState } from 'react';
import { Link, PlusCircle, Tag, Upload, X } from 'lucide-react';
import { useTorrentUpload } from '../../../hooks/useTorrentUpload';

interface TorrentAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSuccess?: () => void;
  initialFiles?: FileList | null;
  onCategoryCreated?: (newCategory: string) => void;
}

export const TorrentAddModal: React.FC<TorrentAddModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSuccess,
  initialFiles,
  onCategoryCreated
}) => {
  // Fermer le modal puis déclencher le callback de succès éventuel
  const handleSuccess = () => {
    onClose();
    onSuccess?.();
  };

  // Gestion du drag & drop
  const dropRef = React.useRef<HTMLDivElement>(null);

  const {
    magnetLink,
    onMagnetChange,
    handleFileChange,
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

  // Charger les fichiers passés par drag & drop à l'ouverture
  React.useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFiles]);

  const [canSubmit, setCanSubmit] = React.useState(false);
  React.useEffect(() => {
    // Vérifier que nous avons un torrent ET une catégorie sélectionnée
    const hasTorrent = !!magnetLink || (torrentFiles && torrentFiles.length > 0);
    const hasCategory = !!selectedCategory;
    setCanSubmit(hasTorrent && hasCategory);
  }, [magnetLink, torrentFiles, selectedCategory]);

  // Handler pour le drop de fichiers
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

  // Empêcher le comportement par défaut sur dragover
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
        // Informer le composant parent qu'une nouvelle catégorie a été créée
        onCategoryCreated(createdCategory);
      }
      setNewCategory('');
      setShowCategoryInput(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        className="bg-gray-800 rounded-lg w-full max-w-lg p-4 sm:p-6 shadow-xl my-auto"
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Ajouter un torrent</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Lien magnet */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center gap-2">
              <Link className="h-3 w-3 sm:h-4 sm:w-4" />
              Lien magnet
            </label>
            <input
              type="text"
              value={magnetLink}
              onChange={onMagnetChange}
              placeholder="magnet:?xt=urn:btih:..."
              className="w-full p-2 sm:p-3 bg-gray-700 border border-gray-600 rounded-lg text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Séparateur */}
          <div className="flex items-center my-2">
            <div className="flex-1 h-px bg-gray-700"></div>
            <span className="px-3 text-xs sm:text-sm text-gray-400">OU</span>
            <div className="flex-1 h-px bg-gray-700"></div>
          </div>

          {/* Upload de fichier */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center gap-2">
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
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
              className="px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600"
            >
              <Upload className="w-4 h-4 inline-block" />
              Fichier
            </label>
            {/* Afficher la liste des fichiers sélectionnés */}
            {torrentFiles && torrentFiles.length > 0 && (
              <div className="mt-2 text-xs text-gray-300">
                {torrentFiles.map((file, idx) => (
                  <div key={idx}>{file.name}</div>
                ))}
              </div>
            )}
          </div>

          {/* Catégorie avec option de création */}
          <div>
            <div className="flex justify-between items-center mb-1 sm:mb-2">
              <label className="block text-xs sm:text-sm font-medium">Catégorie</label>
              <button 
                type="button" 
                onClick={() => setShowCategoryInput(!showCategoryInput)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
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
                  className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategory.trim()}
                  className={`px-2 py-1 rounded-lg text-xs sm:text-sm ${!newCategory.trim() ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  Créer
                </button>
              </div>
            ) : (
              <select
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className={`w-full p-2 sm:p-3 bg-gray-700 border ${!selectedCategory && (magnetLink || torrentFiles.length > 0) ? 'border-red-500' : 'border-gray-600'} rounded-lg text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500`}
                required
              >
                <option value="">Sélectionner une catégorie</option>
                <option value="Films">Films</option>
                <option value="Séries">Séries</option>
                <option value="Anime">Anime</option>
                <option value="Musique">Musique</option>
                <option value="Logiciels">Logiciels</option>
                <option value="Jeux">Jeux</option>
                <option value="Livres">Livres</option>
                <option value="Autres">Autres</option>
                <option value="Sport">Sport</option>
                <option value="Documentaires">Documentaires</option>
                {/* Filtrer les catégories dynamiques pour éviter les doublons */}
                {categories
                  .filter((category: string) => 
                    !["Films", "Séries", "Anime", "Musique", "Logiciels", "Jeux", "Livres", "Autres", "Sport", "Documentaires"]
                    .includes(category)
                  )
                  .map((category: string) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))
                }
              </select>
            )}
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 flex items-center gap-2">
              <Tag className="h-3 w-3 sm:h-4 sm:w-4" />
              Tags (séparés par des virgules)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => onTagsChange(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full p-2 sm:p-3 bg-gray-700 border border-gray-600 rounded-lg text-xs sm:text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Message d'erreur */}
          {uploadError && (
            <div className="p-2 sm:p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-300 text-xs sm:text-sm">
              {uploadError}
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-xs sm:text-sm"
            >
              Annuler
            </button>
            <button
              onClick={addTorrent}
              disabled={isUploading || !canSubmit}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                isUploading || !canSubmit
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
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
