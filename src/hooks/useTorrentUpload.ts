import React, { useState, useCallback } from 'react';

interface UseTorrentUploadReturn {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  magnetLink: string;
  onMagnetChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFiles: (files: FileList | File[]) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  tags: string;
  onTagsChange: (tags: string) => void;
  isUploading: boolean;
  uploadError: string | null;
  addTorrent: () => Promise<void>;
  createCategory: (category: string) => Promise<void>;
  torrentFiles: File[];
}

export const useTorrentUpload = (onSuccess?: () => void): UseTorrentUploadReturn => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [magnetLink, setMagnetLink] = useState('');
  const [torrentFiles, setTorrentFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tags, setTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Ouvrir la modal d'ajout
  const openModal = () => {
    setIsModalOpen(true);
    setMagnetLink('');
    setTorrentFiles([]);
    setSelectedCategory('');
    setTags('');
    setUploadError(null);
  };

  // Fermer la modal d'ajout
  const closeModal = () => {
    setIsModalOpen(false);
    setMagnetLink('');
    setTorrentFiles([]);
    setSelectedCategory('');
    setTags('');
    setUploadError(null);
  };

  // Gérer un tableau de fichiers (input ou drag & drop)
  const handleFiles = (files: FileList | File[]) => {
    if (files && files.length > 0) {
      setTorrentFiles(Array.from(files));
      setMagnetLink('');
    }
  };

  // Gérer le changement de fichiers torrent (multiple)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // Gérer le changement de lien magnet
  const onMagnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMagnetLink(e.target.value);
    setTorrentFiles([]); // Réinitialiser les fichiers si un lien magnet est saisi
  };

  // Gérer le changement de catégorie
  const onCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  // Ajouter un torrent
  const addTorrent = useCallback(async () => {
    // console.log('torrentFiles:', torrentFiles);
    try {
      setIsUploading(true);
      setUploadError(null);

      // Vérification déplacée au début
      if (!magnetLink && torrentFiles.length === 0) {
        setUploadError('Veuillez fournir un lien magnet ou un fichier torrent');
        setIsUploading(false); // Important : arrêter le chargement
        return; // Important : sortir de la fonction
      }
      
      // Vérification de la catégorie
      if (!selectedCategory) {
        setUploadError('Veuillez sélectionner une catégorie');
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      torrentFiles.forEach((file: File) => {
        formData.append('torrents', file);
      });
      if (magnetLink) {
        formData.append('magnet', magnetLink);
      }
      if (selectedCategory) {
        formData.append('category', selectedCategory);
      }
      if (tags) {
        formData.append('tags', tags);
      }

      // Utilisation de fetch natif pour l'upload
      const response = await fetch('/api/qbittorrent/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          // Ne pas définir Content-Type ici, le navigateur le gère pour FormData
        },
        body: formData
      });

      let data: any = null;
      let rawText = '';
      try {
        rawText = await response.text();
        data = JSON.parse(rawText);
      } catch (jsonErr) {
        console.error('Réponse non JSON lors de l\'upload:', rawText);
        setUploadError("Erreur inattendue du serveur (réponse non JSON). Détail : " + rawText.slice(0, 200));
        return;
      }
      if (response.ok) {
        // Réinitialiser le formulaire et fermer la modal
        setMagnetLink('');
        setTorrentFiles([]);
        setSelectedCategory('');
        setTags('');
        closeModal();
        if (onSuccess) onSuccess();
      } else {
        setUploadError(data.error || "Erreur lors de l'upload.");
      }
    } catch (error: any) {
      console.error("Erreur lors de l'upload:", error);
      setUploadError(error?.message || "Erreur lors de l'upload.");
    } finally {
      setIsUploading(false);
    }
  }, [onSuccess, torrentFiles, magnetLink, selectedCategory, tags]);

  // Fonction pour créer une nouvelle catégorie
  const createCategory = useCallback(async (category: string) => {
    if (!category.trim()) return null;
    
    try {
      const response = await fetch('/api/qbittorrent/createCategory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ category: category.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création de la catégorie');
      }
      
      // Définir automatiquement la catégorie créée comme sélectionnée
      const newCategory = category.trim();
      setSelectedCategory(newCategory);
      
      // Retourner la nouvelle catégorie pour que le composant parent puisse mettre à jour sa liste
      return newCategory;
    } catch (error) {
      console.error('Erreur lors de la création de la catégorie:', error);
      setUploadError(error instanceof Error ? error.message : 'Erreur lors de la création de la catégorie');
      return null;
    }
  }, []);

  // Fonction pour gérer le changement de tags
  const onTagsChange = useCallback((value: string) => {
    setTags(value);
  }, []);

  return {
    isModalOpen,
    openModal,
    closeModal,
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
  };
};
