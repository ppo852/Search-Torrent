import { useState } from 'react';

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
  const [deleteWithFiles, setDeleteWithFiles] = useState(true); // Activé par défaut
  const [torrentToDelete, setTorrentToDelete] = useState<string | null>(null);

  // API pour les actions sur les torrents
  const api: TorrentAPI = {
    pauseTorrent: async (hash: string) => {
      try {
        const response = await fetch('/api/qbittorrent/pause', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ hashes: hash })
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la mise en pause du torrent');
        }
        
        return await response.json();
      } catch (error) {
        "console.error('Erreur:', error);"
        throw error;
      }
    },
    
    resumeTorrent: async (hash: string) => {
      try {
        const response = await fetch('/api/qbittorrent/resume', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ hashes: hash })
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la reprise du torrent');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Erreur:', error);
        throw error;
      }
    },
    
    deleteTorrent: async (hash: string, deleteFiles: boolean) => {
      try {
        const response = await fetch('/api/qbittorrent/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ 
            hashes: hash,
            deleteFiles
          })
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la suppression du torrent');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Erreur:', error);
        throw error;
      }
    },
    
    pauseAllTorrents: async () => {
      try {
        const response = await fetch('/api/qbittorrent/pauseAll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la mise en pause de tous les torrents');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Erreur:', error);
        throw error;
      }
    },
    
    resumeAllTorrents: async () => {
      try {
        const response = await fetch('/api/qbittorrent/resumeAll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de la reprise de tous les torrents');
        }
        
        return await response.json();
      } catch (error) {
        "console.error('Erreur:', error);"
        throw error;
      }
    }
  };

  // Gérer la sélection des torrents
  const toggleTorrentSelection = (hash: string) => {
    const newSelectedTorrents = new Set(selectedTorrents);
    if (newSelectedTorrents.has(hash)) {
      newSelectedTorrents.delete(hash);
    } else {
      newSelectedTorrents.add(hash);
    }
    setSelectedTorrents(newSelectedTorrents);
  };

  // Sélectionner tous les torrents
  const selectAllTorrents = (hashes: string[]) => {
    setSelectedTorrents(new Set(hashes));
  };

  // Désélectionner tous les torrents
  const deselectAllTorrents = () => {
    setSelectedTorrents(new Set());
  };

  // Ouvrir la modal de suppression pour un seul torrent
  const handleSingleDelete = (hash: string) => {
    setTorrentToDelete(hash);
    setIsDeleteModalOpen(true);
  };

  // Ouvrir la modal de suppression pour plusieurs torrents
  const handleMultipleDelete = () => {
    if (selectedTorrents.size > 0) {
      setTorrentToDelete(null);
      setIsDeleteModalOpen(true);
    }
  };

  // Confirmer la suppression
  const confirmDelete = async () => {
    try {
      if (torrentToDelete) {
        // Suppression d'un seul torrent
        await api.deleteTorrent(torrentToDelete, deleteWithFiles);
      } else {
        // Suppression de plusieurs torrents
        const hashes = Array.from(selectedTorrents).join('|');
        await api.deleteTorrent(hashes, deleteWithFiles);
      }
      
      // Rafraîchir la liste des torrents
      await fetchTorrents();
      
      // Fermer la modal et réinitialiser
      setIsDeleteModalOpen(false);
      setTorrentToDelete(null);
      setSelectedTorrents(new Set());
      // Ne pas réinitialiser deleteWithFiles pour conserver le choix de l'utilisateur
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  // Annuler la suppression
  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setTorrentToDelete(null);
    // Ne pas réinitialiser deleteWithFiles pour conserver le choix de l'utilisateur
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
    cancelDelete
  };
};
