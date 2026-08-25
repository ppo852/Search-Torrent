import { useState } from 'react';
import { api as clientApi } from '../services/api';
import { showErrorToast, showToast } from '../stores/toastStore';

interface UseTorrentActionsProps {
  fetchTorrents: () => Promise<void>;
}

interface TorrentAPI {
  pauseTorrent: (hash: string) => Promise<any>;
  resumeTorrent: (hash: string) => Promise<any>;
  deleteTorrent: (hash: string, deleteFiles: boolean) => Promise<any>;
  pauseAllTorrents: () => Promise<any>;
  resumeAllTorrents: () => Promise<any>;
}

export const useTorrentActions = ({ fetchTorrents }: UseTorrentActionsProps) => {
  const [selectedTorrents, setSelectedTorrents] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteWithFiles, setDeleteWithFiles] = useState(true);
  const [torrentToDelete, setTorrentToDelete] = useState<string | null>(null);

  const api: TorrentAPI = {
    pauseTorrent: (hash: string) => clientApi.pauseTorrent(hash),
    resumeTorrent: (hash: string) => clientApi.resumeTorrent(hash),
    deleteTorrent: (hash: string, deleteFiles: boolean) =>
      clientApi.deleteTorrents(hash.includes('|') ? hash.split('|') : [hash], deleteFiles),
    pauseAllTorrents: () => clientApi.pauseTorrent('all'),
    resumeAllTorrents: () => clientApi.resumeTorrent('all'),
  };

  const toggleTorrentSelection = (hash: string) => {
    const newSelectedTorrents = new Set(selectedTorrents);
    if (newSelectedTorrents.has(hash)) {
      newSelectedTorrents.delete(hash);
    } else {
      newSelectedTorrents.add(hash);
    }
    setSelectedTorrents(newSelectedTorrents);
  };

  const selectAllTorrents = (hashes: string[]) => {
    setSelectedTorrents(new Set(hashes));
  };

  const deselectAllTorrents = () => {
    setSelectedTorrents(new Set());
  };

  const handleSingleDelete = (hash: string) => {
    setTorrentToDelete(hash);
    setIsDeleteModalOpen(true);
  };

  const handleMultipleDelete = () => {
    if (selectedTorrents.size > 0) {
      setTorrentToDelete(null);
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    try {
      if (torrentToDelete) {
        await api.deleteTorrent(torrentToDelete, deleteWithFiles);
      } else {
        const hashes = Array.from(selectedTorrents).join('|');
        await api.deleteTorrent(hashes, deleteWithFiles);
      }

      const deletedCount = torrentToDelete ? 1 : selectedTorrents.size;
      await fetchTorrents();
      showToast(deletedCount === 1 ? 'Torrent supprimé' : `${deletedCount} torrent(s) supprimé(s)`);

      setIsDeleteModalOpen(false);
      setTorrentToDelete(null);
      setSelectedTorrents(new Set());
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setTorrentToDelete(null);
  };

  return {
    api,
    selectedTorrents,
    isDeleteModalOpen,
    deleteWithFiles,
    setDeleteWithFiles,
    toggleTorrentSelection,
    selectAllTorrents,
    deselectAllTorrents,
    handleSingleDelete,
    handleMultipleDelete,
    confirmDelete,
    cancelDelete,
    torrentToDelete
  };
};
