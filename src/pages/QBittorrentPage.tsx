import React, { useState, useEffect, useRef } from 'react';
import { useGlobalDragAndDrop } from '../hooks/useGlobalDragAndDrop';
import { useAuthStore } from '../stores/authStore';
import { Trash2, ArrowDown, ArrowUp, Filter, ArrowUpDown, Check, X, Upload, Pause, Play } from 'lucide-react';
import { StatsDisplay } from '../components/Stats/StatsDisplay';
import { useQBittorrentStats } from '../hooks/useQBittorrentStats';
import { Torrent, TorrentFilters as TorrentFiltersType, TorrentStatus, SortField } from '../types/qbittorrent';
import { formatSize, formatSpeed, formatRatioWithColor, formatDate } from '../utils/formatters';
import { getTorrentColor, getTrackerName, isTorrentError } from '../utils/torrentUtils';
import { api } from '../lib/api';
import { 
  TorrentList, 
  TorrentListPagination, 
  TorrentFilters, 
  TorrentAddModal, 
  TorrentDeleteModal,
  TorrentContextMenu 
} from '../components/torrent';
import { useTorrentFilters } from '../hooks/useTorrentFilters';
import { useTorrentActions } from '../hooks/useTorrentActions';
import { useTorrentUpload } from '../hooks/useTorrentUpload';

interface TorrentFile {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'adding' | 'added' | 'error';
  error?: string;
}

export const QBittorrentPage: React.FC = () => {
  // Drag & drop global via hook personnalisé
  const [invalidDrop, setInvalidDrop] = React.useState(false);
  const [droppedTorrentFiles, setDroppedTorrentFiles] = useState<File[]>([]);
  const { isAuthenticated } = useAuthStore();
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [syncRid, setSyncRid] = useState<number>(0); // Jeton de synchronisation

  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const itemsPerPageOptions = [5, 10, 20, 50, 100];
  
  // Tri
  const [sorting, setSorting] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({
    field: 'added_on',
    direction: 'desc'
  });
  
  // Stats
  const { stats, loading: statsLoading, error: statsError } = useQBittorrentStats();
  
  // Refs
  const torrentsContainerRef = useRef<HTMLDivElement>(null);
  
  // Récupérer les torrents avec synchronisation
  const fetchTorrents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Utiliser l'API de synchronisation avec le jeton rid
      const response = await fetch(`/api/qbittorrent/sync/maindata?rid=${syncRid}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }
        throw new Error('Erreur lors de la récupération des torrents');
      }
      
      const data = await response.json();
      
      // Mettre à jour le jeton de synchronisation pour la prochaine requête
      if (data.rid) {
        setSyncRid(data.rid);
      }
      
      // Si c'est la première requête ou si on a reçu tous les torrents
      if (syncRid === 0 || data.full_update) {
        if (data.torrents) {
          // Convertir l'objet en tableau
          const torrentArray = Object.entries(data.torrents).map(([hash, torrent]: [string, any]) => ({
            hash,
            ...torrent
          }));
          setTorrents(torrentArray);
        }
      } else if (data.torrents) {
        // Mise à jour partielle - ajouter/modifier les torrents existants
        setTorrents(prevTorrents => {
          const updatedTorrents = [...prevTorrents];
          
          // Mettre à jour ou ajouter les torrents modifiés
          Object.entries(data.torrents).forEach(([hash, torrentData]: [string, any]) => {
            const existingIndex = updatedTorrents.findIndex(t => t.hash === hash);
            
            if (existingIndex >= 0) {
              // Mettre à jour un torrent existant
              updatedTorrents[existingIndex] = {
                ...updatedTorrents[existingIndex],
                ...torrentData,
                hash
              };
            } else {
              // Ajouter un nouveau torrent
              updatedTorrents.push({
                hash,
                ...torrentData
              });
            }
          });
          
          // Supprimer les torrents qui ont été supprimés
          if (data.torrents_removed) {
            return updatedTorrents.filter(t => !data.torrents_removed.includes(t.hash));
          }
          
          return updatedTorrents;
        });
      }
      
      // Réinitialiser la page si nécessaire
      if (currentPage > Math.ceil(torrents.length / itemsPerPage) && currentPage > 1) {
        setCurrentPage(1);
      }
    } catch (err) {
      // console.log('Erreur:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      
      // En cas d'erreur, réinitialiser le rid pour forcer une mise à jour complète
      setSyncRid(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Récupérer les catégories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/qbittorrent/categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des catégories');
      }
      
      const data = await response.json();
      setCategories(Object.keys(data));
    } catch (err) {
      console.log('Erreur:', err);
    }
  };

  // Utiliser nos hooks personnalisés
  const { 
    filteredTorrents, 
    searchQuery, 
    setSearchQuery, 
    currentStatus, 
    setCurrentStatus, 
    currentCategory, 
    setCurrentCategory 
  } = useTorrentFilters({ torrents });
  
  const {
    api: torrentApi,
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
  } = useTorrentActions({ fetchTorrents });
  
  const {
    isModalOpen: isAddModalOpen,
    openModal: openAddModal,
    closeModal: closeAddModal,
    magnetLink,
    onMagnetChange: handleMagnetChange,
    handleFileChange,
    handleFiles, // Ajouté pour drag & drop
    selectedCategory,
    onCategoryChange: setSelectedCategory,
    tags,
    onTagsChange,
    isUploading,
    uploadError,
    addTorrent,
    createCategory
  } = useTorrentUpload(() => {
    fetchTorrents();
    fetchCategories();
  });

  // Drag & drop global via hook personnalisé - Déplacer après l'initialisation de useTorrentUpload
  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useGlobalDragAndDrop((files) => {
    // Stocker les fichiers dans l'état local
    setDroppedTorrentFiles(files);
    // Ouvrir la modale
    openAddModal();
    setInvalidDrop(false);
  });
  
  // Tri des torrents
  const sortedTorrents = [...filteredTorrents].sort((a, b) => {
    let valueA = a[sorting.field];
    let valueB = b[sorting.field];
    
    // Gestion spéciale pour certains champs
    if (sorting.field === 'name') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    if (valueA < valueB) return sorting.direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return sorting.direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Pagination
  const totalPages = Math.ceil(sortedTorrents.length / itemsPerPage);
  const paginatedTorrents = sortedTorrents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Changer le tri
  const changeSorting = (field: SortField) => {
    if (sorting.field === field) {
      setSorting({
        field,
        direction: sorting.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSorting({
        field,
        direction: 'asc'
      });
    }
  };

  // Charger les données initiales
  useEffect(() => {
    // Charger les données même si l'utilisateur n'est pas encore authentifié
    // L'API renverra une erreur 401 si nécessaire, qui sera gérée dans fetchTorrents
    fetchTorrents();
    fetchCategories();
    
    // Rafraîchir les torrents toutes les 5 secondes
    const interval = setInterval(() => {
      fetchTorrents();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []); // Supprimer la dépendance à isAuthenticated pour s'assurer que l'effet s'exécute toujours

  // Mettre à jour la pagination lorsque les filtres changent
  useEffect(() => {
    if (currentPage > Math.ceil(filteredTorrents.length / itemsPerPage) && currentPage > 1) {
      setCurrentPage(1);
    }
  }, [filteredTorrents, itemsPerPage]);

  // Nous ne bloquons plus l'accès à la page, mais nous afficherons un message d'erreur
  // si l'utilisateur n'est pas authentifié ou si les paramètres qBittorrent ne sont pas configurés



  return (
    <div 
      className="container mx-auto px-4 py-6 space-y-6 min-h-screen"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col md:flex-row justify-end items-start md:items-center mb-8 gap-4">
        
        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <ArrowDown className="h-5 w-5" />
            Ajouter un torrent
          </button>
        </div>
      </div>
      
      {/* Statistiques */}
      {stats && <StatsDisplay stats={stats} />}
      
      {/* Filtres */}
      <div className="mb-6">
        <TorrentFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentSortField={sorting.field}
          sortDirection={sorting.direction}
          onSortChange={changeSorting}
          onDirectionChange={() => setSorting(prev => ({
            field: prev.field,
            direction: prev.direction === 'asc' ? 'desc' : 'asc'
          }))}
          currentStatus={currentStatus}
          onStatusChange={setCurrentStatus}
          categories={categories}
          currentCategory={currentCategory}
          onCategoryChange={setCurrentCategory}
        />
      </div>
      

      
      {/* Actions sur les torrents sélectionnés */}
      {selectedTorrents.size > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
          <span className="text-sm text-gray-300">
            {selectedTorrents.size} torrent{selectedTorrents.size > 1 ? 's' : ''} sélectionné{selectedTorrents.size > 1 ? 's' : ''}
          </span>
          
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => {
                const hashes = Array.from(selectedTorrents).join('|');
                torrentApi.pauseTorrent(hashes).then(fetchTorrents);
              }}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Mettre en pause
            </button>
            
            <button
              onClick={() => {
                const hashes = Array.from(selectedTorrents).join('|');
                torrentApi.resumeTorrent(hashes).then(fetchTorrents);
              }}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Reprendre
            </button>
            
            <button
              onClick={handleMultipleDelete}
              className="px-3 py-1.5 rounded-lg text-sm bg-red-800 hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
            
            <button
              onClick={deselectAllTorrents}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Désélectionner tout
            </button>
          </div>
        </div>
      )}
      
      {/* Liste des torrents */}
      {isLoading && torrents.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement des torrents...</p>
        </div>
      ) : error ? (
        <div className="text-center my-8">
          <p className="text-base text-gray-200 mb-4">
            qBittorrent non configuré, contactez l’administrateur.
          </p>
          <button
            onClick={fetchTorrents}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-100"
          >
            Réessayer
          </button>
        </div>
      ) : filteredTorrents.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">Aucun torrent ne correspond aux critères de recherche.</p>
        </div>
      ) : (
        <>
          <div ref={torrentsContainerRef}>
            <TorrentList
              torrents={paginatedTorrents}
              selectedTorrents={selectedTorrents}
              toggleTorrentSelection={toggleTorrentSelection}
              handleSingleDelete={handleSingleDelete}
              fetchTorrents={fetchTorrents}
              api={torrentApi}
            />
          </div>
          
          {/* Pagination */}
          {filteredTorrents.length > 0 && (
            <TorrentListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredTorrents.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              itemsPerPageOptions={itemsPerPageOptions}
            />
          )}
        </>
      )}
      
      {/* Zone de drop qui apparaît quand on glisse un fichier */}
      {isDragging && (
        <div
          className="fixed inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex items-center justify-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Déposez vos fichiers torrent</h3>
            <p className="text-gray-400">Vous pouvez déposer plusieurs fichiers à la fois.<br/>Les fichiers seront ajoutés à qBittorrent.</p>
            {invalidDrop && (
              <div className="mt-4 text-red-400">Seuls les fichiers .torrent sont acceptés.</div>
            )}
          </div>
        </div>
      )}
      
      {/* Modal d'ajout de torrent */}
      {isAddModalOpen && (
        <TorrentAddModal
          isOpen={isAddModalOpen}
          onClose={() => {
            closeAddModal();
            setDroppedTorrentFiles([]);
          }}
          categories={categories}
          onSuccess={fetchTorrents}
          initialFiles={droppedTorrentFiles}
          onCategoryCreated={(newCategory) => {
            // Mettre à jour la liste des catégories après la création d'une nouvelle catégorie
            setCategories(prevCategories => [...prevCategories, newCategory]);
          }}
        />
      )}
      
      {/* Modal de suppression */}
      <TorrentDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        deleteWithFiles={deleteWithFiles}
        setDeleteWithFiles={setDeleteWithFiles}
        isSingleDelete={!!torrentToDelete}
        selectedCount={selectedTorrents.size}
      />
    </div>
  );
};
