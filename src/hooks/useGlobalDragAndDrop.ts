import { useState, useEffect, useCallback } from 'react';

/**
 * Hook global pour gérer le drag & drop de fichiers (ex: .torrent) sur toute la page.
 * Fournit l'état isDragging, la surcouche, et la logique de drop.
 */
export function useGlobalDragAndDrop(onFiles: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false);

  // Empêche le comportement natif du navigateur (téléchargement)
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  // Handlers React pour la zone principale
  const handleDragEnter = useCallback(() => setIsDragging(true), []);
  const handleDragOver = useCallback((e: import('react').DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDragLeave = useCallback((e: import('react').DragEvent) => {
    if (e.target === e.currentTarget) setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: import('react').DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      typeof f === 'object' && 'name' in f && typeof (f as File).name === 'string' && (f as File).name.toLowerCase().endsWith('.torrent')
    ) as File[];
    if (files.length > 0 && typeof onFiles === 'function') {
      onFiles(files);
    }
  }, [onFiles]);

  return {
    isDragging,
    setIsDragging,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}
