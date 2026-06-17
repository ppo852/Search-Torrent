import { useEffect, useState } from 'react';
<<<<<<< HEAD
import { LayoutGrid, List, Trash2, Search, Clock, User } from 'lucide-react';
=======
import { LayoutGrid, List, Trash2 } from 'lucide-react';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface LibraryItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv' | 'anime';
  title: string;
  poster_url: string | null;
  release_date: string | null;
  monitored: boolean;
  created_at: string;
  requested_by?: string | null;
}

interface TvSeasonRequest {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'tv' | 'anime';
  title: string;
  poster_url: string | null;
  season_number: number;
  status: string;
  next_episode_number: number;
  created_at: string;
  requested_by?: string | null;
}

interface TvShowGroup {
  kind: 'tv_show_group';
  group_key: string;
  tmdb_id: number;
  media_type: 'tv' | 'anime';
  title: string;
  poster_url: string | null;
  created_at: string;
  seasons: TvSeasonRequest[];
}

type CombinedRequest =
  | (LibraryItem & { kind: 'media_request' })
  | TvShowGroup;

export function LibraryPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<CombinedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('grid');
  const [searchText, setSearchText] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all');

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [mediaRequests, tvRequests] = await Promise.all([
        api.getLibrary(),
        api.getTvSeasonRequests()
      ]);

      const tvByShow = new Map<string, TvSeasonRequest[]>();
      for (const t of (tvRequests || []) as TvSeasonRequest[]) {
        const key = `${t.media_type}:${t.tmdb_id}`;
        const prev = tvByShow.get(key) || [];
        prev.push(t);
        tvByShow.set(key, prev);
      }

      const groupedTv: TvShowGroup[] = Array.from(tvByShow.entries()).map(([key, seasons]) => {
        const sorted = [...seasons].sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
        const latest = [...seasons].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

        return {
          kind: 'tv_show_group' as const,
          group_key: key,
          tmdb_id: latest.tmdb_id,
          media_type: latest.media_type,
          title: latest.title,
          poster_url: latest.poster_url,
          created_at: latest.created_at,
          seasons: sorted
        };
      });

      const merged: CombinedRequest[] = [
        ...((mediaRequests || []) as LibraryItem[]).map((i) => ({ ...i, kind: 'media_request' as const })),
        ...groupedTv
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

      setItems(merged);
    } catch (err) {
<<<<<<< HEAD
      setError('Échec de la synchronisation');
=======
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du suivi');
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    } finally {
      setIsLoading(false);
    }
  };

<<<<<<< HEAD
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('library_display_mode');
    if (saved === 'list' || saved === 'grid') setDisplayMode(saved);
=======
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('library_display_mode');
      if (saved === 'list' || saved === 'grid') {
        setDisplayMode(saved);
      }
    } catch {
      // ignore
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  }, []);

  const setMode = (mode: 'list' | 'grid') => {
    setDisplayMode(mode);
<<<<<<< HEAD
    window.localStorage.setItem('library_display_mode', mode);
=======
    try {
      window.localStorage.setItem('library_display_mode', mode);
    } catch {
      // ignore
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  };

  const filteredItems = items.filter((item: CombinedRequest) => {
    const query = searchText.trim().toLowerCase();
<<<<<<< HEAD
    if (query && !String(item.title || '').toLowerCase().includes(query)) return false;
=======
    if (query) {
      const title = String(item.title || '').toLowerCase();
      if (!title.includes(query)) return false;
    }

>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    if (categoryFilter === 'all') return true;
    return item.media_type === categoryFilter;
  });

<<<<<<< HEAD
  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await api.deleteLibraryItem(pendingDeleteId);
      setItems((prev) => prev.filter((i) => !(i.kind === 'media_request' && i.id === pendingDeleteId)));
    } catch (e) {}
=======
  const handleDelete = async (id: string) => {
    try {
      const item = items.find((i: CombinedRequest) => i.kind === 'media_request' && i.id === id);
      if (!item) return;
      await api.deleteLibraryItem(id);
      setItems((prev: CombinedRequest[]) =>
        prev.filter((i: CombinedRequest) => !(i.kind === 'media_request' && i.id === id))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const openDeleteModal = (id: string) => {
    setPendingDeleteId(id);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    setDeleteModalOpen(false);
    setPendingDeleteId(null);
  };

<<<<<<< HEAD
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-black uppercase text-[10px] tracking-widest animate-pulse">Indexation du contenu...</p>
    </div>
  );

  return (
    <div className="animate-premium-fade space-y-12 pb-10">
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setDeleteModalOpen(false)} />
          <div className="glass-card relative w-full max-w-md p-8 shadow-2xl border-white/10">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Retirer du suivi</h2>
            <p className="text-gray-500 text-sm font-medium mb-8">Cette action stoppera la surveillance de ce média.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setDeleteModalOpen(false)} className="px-6 py-2 rounded-xl bg-white/5 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">Annuler</button>
              <button onClick={confirmDelete} className="px-6 py-2 rounded-xl bg-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/30 hover:bg-red-500 transition-all">Confirmer</button>
=======
  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    await handleDelete(pendingDeleteId);
    closeDeleteModal();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-8 text-gray-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeDeleteModal}
          />
          <div className="relative w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
            <div className="text-white font-semibold text-lg">Confirmer la suppression</div>
            <div className="text-gray-300 text-sm mt-2">Supprimer cette demande du suivi ?</div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500"
              >
                Supprimer
              </button>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
            </div>
          </div>
        </div>
      )}

<<<<<<< HEAD
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-8">
        <div className="relative group flex-1 min-w-[280px] max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="FILTRER LA COLLECTION..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-[11px] font-black tracking-widest uppercase placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/10 transition-all shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center p-1.5 bg-white/5 border border-white/10 rounded-2xl">
             {[
               { id: 'all', label: 'TOUT' },
               { id: 'movie', label: 'FILMS' },
               { id: 'tv', label: 'SÉRIES' },
               { id: 'anime', label: 'ANIME' }
             ].map(cat => (
               <button
                 key={cat.id}
                 onClick={() => setCategoryFilter(cat.id as any)}
                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
               >
                 {cat.label}
               </button>
             ))}
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/10 rounded-2xl">
            <button onClick={() => setMode('list')} className={`p-2 rounded-xl transition-all ${displayMode === 'list' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-600 hover:text-gray-300'}`}><List size={18} /></button>
            <button onClick={() => setMode('grid')} className={`p-2 rounded-xl transition-all ${displayMode === 'grid' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-600 hover:text-gray-300'}`}><LayoutGrid size={18} /></button>
          </div>
        </div>
      </div>

      {error && <div className="p-6 bg-red-600/10 border border-red-600/20 rounded-2xl text-red-400 font-bold text-center uppercase tracking-widest text-xs">{error}</div>}

      {filteredItems.length === 0 ? (
        <div className="py-32 glass-card text-center opacity-40">
          <p className="text-gray-500 font-black uppercase text-xs tracking-widest">Aucune correspondance détectée</p>
        </div>
      ) : displayMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-8">
          {filteredItems.map((item) => {
            const key = item.kind === 'tv_show_group' ? item.group_key : item.id;
            const canDelete = Boolean(user?.is_admin || (item.kind === 'media_request' && item.user_id === user?.id));
=======
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Demandes</h1>
        <div className="flex items-center gap-2">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Rechercher une demande..."
            className="w-56 sm:w-72 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'movie' | 'tv' | 'anime')}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="all">Toutes</option>
            <option value="movie">Films</option>
            <option value="tv">Séries</option>
            <option value="anime">Anime</option>
          </select>

          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setMode('list')}
              className={`px-3 py-2 text-gray-200 hover:bg-gray-700 ${displayMode === 'list' ? 'bg-gray-700' : ''}`}
              title="Affichage liste"
              type="button"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setMode('grid')}
              className={`px-3 py-2 text-gray-200 hover:bg-gray-700 ${displayMode === 'grid' ? 'bg-gray-700' : ''}`}
              title="Affichage pochettes"
              type="button"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
            type="button"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {error && (
        <div className="text-center py-4 text-red-500">{error}</div>
      )}

      {filteredItems.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          Aucune demande.
        </div>
      ) : displayMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2">
          {filteredItems.map((item) => {
            const key = item.kind === 'tv_show_group' ? item.group_key : item.id;
            const canDelete = Boolean(user?.is_admin || (item.kind === 'media_request' && item.user_id === user?.id));
            const requesters =
              item.kind === 'tv_show_group'
                ? (Array.from(new Set((item.seasons || []).map((s) => s.requested_by).filter(Boolean))) as string[])
                : item.requested_by
                  ? [item.requested_by]
                  : [];
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

            return (
              <div
                key={key}
<<<<<<< HEAD
                className="group relative animate-premium-fade"
                onClick={() => {
                  if (item.kind === 'media_request') navigate(`/library/${item.id}`);
                  if (item.kind === 'tv_show_group') navigate(`/library/show/${item.media_type}/${item.tmdb_id}`);
                }}
              >
                <div className="glass-card overflow-hidden group-hover:scale-[1.04] group-hover:-translate-y-3 transition-all duration-500 ease-out shadow-2xl border-white/5 group-hover:border-blue-500/20 group-hover:shadow-blue-500/10">
                  <div className="aspect-[2/3] relative">
                    {item.poster_url ? (
                      <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-800 font-black text-2xl uppercase tracking-tighter bg-gray-950">{item.title.substring(0, 2)}</div>
                    )}
                    
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black text-white uppercase tracking-[0.2em] border border-white/10 shadow-lg">
                      {item.media_type === 'movie' ? 'Film' : item.media_type === 'anime' ? 'Anime' : 'Série'}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5">
                      <h3 className="text-white font-black text-sm leading-tight mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 uppercase tracking-tighter">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                         <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{item.kind === 'tv_show_group' ? `${item.seasons.length} SAISONS` : 'SURVEILLÉ'}</span>
                      </div>
                    </div>
                  </div>
=======
                className="relative group cursor-pointer transition-transform duration-200 hover:scale-105"
                onClick={() => {
                  if (item.kind === 'media_request') {
                    navigate(`/library/${item.id}`);
                  }
                  if (item.kind === 'tv_show_group') {
                    navigate(`/library/show/${item.media_type}/${item.tmdb_id}`);
                  }
                }}
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                  {item.poster_url ? (
                    <img
                      src={item.poster_url}
                      alt={item.title}
                      className="w-full h-full object-cover max-h-[250px] max-w-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                      No Poster
                    </div>
                  )}
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                </div>

                {item.kind !== 'tv_show_group' && canDelete && (
                  <button
<<<<<<< HEAD
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteId(item.id); setDeleteModalOpen(true); }}
                    className="absolute -top-3 -right-3 p-2.5 bg-red-600 text-white rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 hover:bg-red-500 z-10 border border-red-500/50"
=======
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(item.id);
                    }}
                    className="absolute top-1 right-1 p-2 text-gray-200 bg-black/40 hover:bg-black/60 rounded"
                    title="Supprimer du suivi"
                    type="button"
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                  >
                    <Trash2 size={16} />
                  </button>
                )}
<<<<<<< HEAD
=======

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex flex-col justify-end p-2">
                  <div className="text-white font-semibold text-xs sm:text-sm line-clamp-2">{item.title}</div>
                  {item.kind === 'media_request' && item.release_date && (
                    <div className="text-xs text-gray-300 mt-1 line-clamp-1">{item.release_date}</div>
                  )}
                  {item.kind === 'tv_show_group' && (
                    <div className="text-xs text-gray-300 mt-1 line-clamp-2">
                      Saisons: {item.seasons.map((s) => s.season_number).join(', ')}
                    </div>
                  )}
                  {requesters.length > 0 && (
                    <div className="text-[10px] sm:text-xs text-gray-200 mt-1 line-clamp-2">
                      Demandé par: {requesters.join(', ')}
                    </div>
                  )}
                </div>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
              </div>
            );
          })}
        </div>
      ) : (
<<<<<<< HEAD
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.kind === 'tv_show_group' ? item.group_key : item.id}
              className="glass-card p-4 flex items-center gap-8 group hover:bg-white/5 cursor-pointer border-white/5 hover:border-blue-500/20 transition-all"
              onClick={() => {
                if (item.kind === 'media_request') navigate(`/library/${item.id}`);
                if (item.kind === 'tv_show_group') navigate(`/library/show/${item.media_type}/${item.tmdb_id}`);
              }}
            >
              <div className="w-16 h-24 rounded-2xl overflow-hidden bg-gray-950 shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                {item.poster_url ? <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-gray-800 font-black">NA</div>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4 mb-2">
                  <h3 className="text-white font-black text-lg uppercase tracking-tighter truncate">{item.title}</h3>
                  <span className="px-2 py-0.5 bg-blue-600/10 border border-blue-600/20 rounded-lg text-[9px] text-blue-400 uppercase font-black tracking-widest">
                    {item.media_type}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                  {item.kind === 'media_request' ? (
                    <span className="flex items-center gap-2"><Clock size={12} /> Ajouté le {new Date(item.created_at).toLocaleDateString()}</span>
                  ) : (
                    <span className="flex items-center gap-2"><LayoutGrid size={12} /> {item.seasons.length} Saison{item.seasons.length > 1 ? 's' : ''}</span>
                  )}
                  {item.requested_by && (
                    <span className="flex items-center gap-2 text-blue-400/60">
                       <User size={12} /> {item.requested_by}
                    </span>
                  )}
                </div>
              </div>

              {item.kind !== 'tv_show_group' && (user?.is_admin || (item.kind === 'media_request' && item.user_id === user?.id)) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDeleteId(item.id); setDeleteModalOpen(true); }}
                  className="p-4 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              )}
=======
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.kind === 'tv_show_group' ? item.group_key : item.id}
              className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 p-3 cursor-pointer hover:bg-gray-700/60"
              onClick={() => {
                if (item.kind === 'media_request') {
                  navigate(`/library/${item.id}`);
                }
                if (item.kind === 'tv_show_group') {
                  navigate(`/library/show/${item.media_type}/${item.tmdb_id}`);
                }
              }}
            >
              <div className="flex gap-3 items-start">
                <div className="w-16 h-24 bg-gray-900 rounded overflow-hidden flex-shrink-0">
                  {item.poster_url ? (
                    <img
                      src={item.poster_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                      No Poster
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm line-clamp-2">
                    {item.title}
                  </div>
                  {item.kind === 'media_request' && item.release_date && (
                    <div className="text-xs text-gray-400 mt-1">{item.release_date}</div>
                  )}
                  {item.kind === 'tv_show_group' && (
                    <div className="text-xs text-gray-400 mt-1">
                      Saisons: {item.seasons.map((s) => s.season_number).join(', ')}
                    </div>
                  )}
                  {item.kind === 'tv_show_group' && (
                    <div className="text-xs text-gray-400 mt-1">Clique pour voir le détail</div>
                  )}
                  {item.kind === 'tv_show_group' ? (
                    (() => {
                      const uniqueRequesters = Array.from(
                        new Set((item.seasons || []).map((s) => s.requested_by).filter(Boolean))
                      ) as string[];
                      if (uniqueRequesters.length === 0) return null;
                      return (
                        <div className="text-xs text-gray-500 mt-1">
                          Demandé par: {uniqueRequesters.join(', ')}
                        </div>
                      );
                    })()
                  ) : item.requested_by ? (
                    <div className="text-xs text-gray-500 mt-1">Demandé par: {item.requested_by}</div>
                  ) : null}
                </div>

                {item.kind !== 'tv_show_group' && (user?.is_admin || (item.kind === 'media_request' && item.user_id === user?.id)) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(item.id);
                    }}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md"
                    title="Supprimer du suivi"
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
