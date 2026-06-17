import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGlobalDragAndDrop } from '../hooks/useGlobalDragAndDrop';
import { Trash2, ArrowDown, X, Upload, Pause, Play } from 'lucide-react';
import { StatsDisplay } from '../components/Stats/StatsDisplay';
import { useQBittorrentStats } from '../hooks/useQBittorrentStats';
import { Torrent, SortField } from '../types/qbittorrent';
import { getTrackerName } from '../utils/torrentUtils';
import { 
  TorrentList, 
  TorrentListPagination, 
  TorrentFilters, 
  TorrentAddModal, 
  TorrentDeleteModal
} from '../components/torrent';
import { useTorrentFilters } from '../hooks/useTorrentFilters';
import { useTorrentActions } from '../hooks/useTorrentActions';
import { useTorrentUpload } from '../hooks/useTorrentUpload';

export const QBittorrentPage: React.FC = () => {
  const [invalidDrop, setInvalidDrop] = React.useState(false);
  const [droppedTorrentFiles, setDroppedTorrentFiles] = useState<File[]>([]);
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [syncRid, setSyncRid] = useState<number>(0);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const itemsPerPageOptions = [5, 10, 20, 50, 100];
  
  const [sorting, setSorting] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({
    field: 'added_on',
    direction: 'desc'
  });
  
  const { stats } = useQBittorrentStats();
  const torrentsContainerRef = useRef<HTMLDivElement>(null);
  
  const fetchTorrents = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/qbittorrent/sync/maindata?rid=${syncRid}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!response.ok) throw new Error('Erreur de synchronisation');
      const data = await response.json();
      if (data.rid) setSyncRid(data.rid);
      
      if (syncRid === 0 || data.full_update) {
        if (data.torrents) {
          const arr = Object.entries(data.torrents).map(([hash, t]: [string, any]) => ({ hash, ...t }));
          setTorrents(arr);
        }
      } else if (data.torrents) {
        setTorrents((prev) => {
          let next = [...prev];
          Object.entries(data.torrents).forEach(([hash, t]: [string, any]) => {
            const idx = next.findIndex(item => item.hash === hash);
            if (idx >= 0) next[idx] = { ...next[idx], ...t, hash };
            else next.push({ hash, ...t });
          });
          if (data.torrents_removed) next = next.filter(t => !data.torrents_removed.includes(t.hash));
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setSyncRid(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/qbittorrent/categories', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(Object.keys(data));
      }
    } catch (err) {}
  };

  const { filteredTorrents, searchQuery, setSearchQuery, currentStatus, setCurrentStatus, currentCategory, setCurrentCategory } = useTorrentFilters({ torrents });
  const { api: torrentApi, selectedTorrents, isDeleteModalOpen, deleteWithFiles, setDeleteWithFiles, toggleTorrentSelection, deselectAllTorrents, handleSingleDelete, handleMultipleDelete, confirmDelete, cancelDelete, torrentToDelete } = useTorrentActions({ fetchTorrents });
  const { isModalOpen: isAddModalOpen, openModal: openAddModal, closeModal: closeAddModal } = useTorrentUpload(() => { fetchTorrents(); fetchCategories(); });

  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useGlobalDragAndDrop((files) => {
    setDroppedTorrentFiles(files);
    openAddModal();
    setInvalidDrop(false);
  });

  const sortedTorrents = useMemo(() => {
    return [...filteredTorrents].sort((a, b) => {
      let vA = (a as any)[sorting.field] ?? '';
      let vB = (b as any)[sorting.field] ?? '';
      
      if (sorting.field === 'name') {
        vA = String(vA).toLowerCase();
        vB = String(vB).toLowerCase();
      } else if (sorting.field === 'tracker') {
        vA = getTrackerName(vA).toLowerCase();
        vB = getTrackerName(vB).toLowerCase();
      }
      
      if (vA < vB) return sorting.direction === 'asc' ? -1 : 1;
      if (vA > vB) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTorrents, sorting]);

  const totalPages = Math.ceil(sortedTorrents.length / itemsPerPage);
  const paginatedTorrents = sortedTorrents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const changeSorting = (field: SortField) => {
    setSorting(prev => ({ field, direction: prev.field === field ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc' }));
  };

  useEffect(() => {
    fetchTorrents();
    fetchCategories();
    const interval = setInterval(fetchTorrents, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div 
        className="animate-premium-fade space-y-8"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
          <div>
            <h1 className="text-base lg:text-xl font-black text-white tracking-tighter uppercase mb-1">
              Contrôle <span className="text-blue-500">Torrents</span>
            </h1>
            <p className="text-gray-500 font-medium italic text-[10px] lg:text-sm">Gestion des flux et téléchargements en temps réel</p>
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              onClick={openAddModal}
              className="w-full lg:w-auto px-4 lg:px-6 py-2.5 lg:py-3 premium-gradient text-white font-black text-[10px] lg:text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <ArrowDown size={16} className="lg:w-[18px] lg:h-[18px]" />
              Ajouter un flux
            </button>
          </div>
        </div>
        
        {stats && (
          <div className="glass-card p-6 border-white/5">
            <StatsDisplay stats={stats} />
          </div>
        )}
        
        <div className="glass-card p-4 border-white/5">
          <TorrentFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentSortField={sorting.field}
            sortDirection={sorting.direction}
            onSortChange={changeSorting}
            onDirectionChange={() => setSorting(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
            currentStatus={currentStatus}
            onStatusChange={setCurrentStatus}
            categories={categories}
            currentCategory={currentCategory}
            onCategoryChange={setCurrentCategory}
          />
        </div>
        
        <div className="glass-card min-h-[400px] overflow-hidden border-white/5">
          {isLoading && torrents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 font-bold uppercase text-xs animate-pulse">Initialisation...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <X className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-white font-bold uppercase tracking-tighter">Erreur qBittorrent</p>
              <p className="text-gray-500 text-sm mb-6">Vérifiez la configuration système.</p>
              <button onClick={fetchTorrents} className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-bold hover:bg-white/10 transition-all">Réessayer</button>
            </div>
          ) : filteredTorrents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
               <Upload size={48} className="text-gray-500 mb-4" />
               <p className="text-gray-500 text-lg font-black uppercase tracking-tighter">Aucun flux actif</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
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
              {filteredTorrents.length > itemsPerPage && (
                <div className="p-6 bg-black/20">
                  <TorrentListPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredTorrents.length}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    itemsPerPageOptions={itemsPerPageOptions}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Éléments FIXES (hors zone d'animation pour éviter les bugs de scroll) */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-600/20 backdrop-blur-xl z-[100] flex items-center justify-center animate-premium-fade" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
          <div className="glass-card p-16 flex flex-col items-center border-blue-500/40 shadow-2xl scale-110">
            <Upload className="h-16 w-16 text-blue-400 mb-6 animate-bounce" />
            <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Importer</h3>
            <p className="text-gray-500 font-medium italic">Fichiers .torrent acceptés</p>
          </div>
        </div>
      )}

      {selectedTorrents.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 glass-card p-4 flex items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-blue-500/30 animate-premium-slide-up">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Sélection active</span>
            <span className="text-white font-bold text-sm">{selectedTorrents.size} Flux</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <button onClick={() => torrentApi.pauseTorrent(Array.from(selectedTorrents).join('|')).then(fetchTorrents)} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 transition-all"><Pause size={18} /></button>
            <button onClick={() => torrentApi.resumeTorrent(Array.from(selectedTorrents).join('|')).then(fetchTorrents)} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 transition-all"><Play size={18} /></button>
            <button onClick={handleMultipleDelete} className="p-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 transition-all" title="Supprimer la sélection"><Trash2 size={18} /></button>
            <button onClick={deselectAllTorrents} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 transition-all"><X size={18} /></button>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <TorrentAddModal isOpen={isAddModalOpen} onClose={() => { closeAddModal(); setDroppedTorrentFiles([]); }} categories={categories} onSuccess={fetchTorrents} initialFiles={droppedTorrentFiles} onCategoryCreated={(cat) => setCategories(prev => [...prev, cat])} />
      )}
      
      <TorrentDeleteModal isOpen={isDeleteModalOpen} onClose={cancelDelete} onConfirm={confirmDelete} deleteWithFiles={deleteWithFiles} setDeleteWithFiles={setDeleteWithFiles} isSingleDelete={!!torrentToDelete} selectedCount={selectedTorrents.size} />
    </>
  );
};
