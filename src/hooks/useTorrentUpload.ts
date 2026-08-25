import React, { useState, useCallback } from 'react';
import { api } from '../services/api';

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

  const openModal = () => {
    setIsModalOpen(true);
    setMagnetLink('');
    setTorrentFiles([]);
    setSelectedCategory('');
    setTags('');
    setUploadError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setMagnetLink('');
    setTorrentFiles([]);
    setSelectedCategory('');
    setTags('');
    setUploadError(null);
  };

  const handleFiles = (files: FileList | File[]) => {
    if (files && files.length > 0) {
      setTorrentFiles(Array.from(files));
      setMagnetLink('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const onMagnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMagnetLink(e.target.value);
    setTorrentFiles([]);
  };

  const onCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const addTorrent = useCallback(async () => {
    try {
      setIsUploading(true);
      setUploadError(null);

      if (!magnetLink && torrentFiles.length === 0) {
        setUploadError('Veuillez fournir un lien magnet ou un fichier torrent');
        setIsUploading(false);
        return;
      }

      if (!selectedCategory) {
        setUploadError('Veuillez sélectionner une catégorie');
        setIsUploading(false);
        return;
      }

      await api.addTorrentForm({
        files: torrentFiles,
        magnet: magnetLink || undefined,
        category: selectedCategory,
        tags: tags || undefined,
      });

      setMagnetLink('');
      setTorrentFiles([]);
      setSelectedCategory('');
      setTags('');
      closeModal();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Erreur lors de l'upload:", error);
      setUploadError(error?.message || "Erreur lors de l'upload.");
    } finally {
      setIsUploading(false);
    }
  }, [onSuccess, torrentFiles, magnetLink, selectedCategory, tags]);

  const createCategory = useCallback(async (category: string) => {
    if (!category.trim()) return null;

    try {
      await api.createQbitCategory(category.trim());
      const newCategory = category.trim();
      setSelectedCategory(newCategory);
      return newCategory;
    } catch (error) {
      console.error('Erreur lors de la création de la catégorie:', error);
      setUploadError(error instanceof Error ? error.message : 'Erreur lors de la création de la catégorie');
      return null;
    }
  }, []);

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
