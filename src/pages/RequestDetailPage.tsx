import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Search, Trash2, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { tmdbAPI } from '../services/tmdb/tmdb';
import { useAuthStore } from '../stores/authStore';
import ManualSearchModal from '../components/ManualSearchModal';
import { formatSize } from '../utils/formatters';
import { ExpandableText } from '../components/ui/ExpandableText';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { globalSettings } from '../services/settings';
import { showErrorToast, showToast } from '../stores/toastStore';
import { getRequestStatusBadge } from '../lib/request-status-labels';

type MediaType = 'movie' | 'tv' | 'anime' | 'animation';
type RequestStatus = 'pending' | 'found' | 'sent_to_qbit' | 'error' | 'completed' | 'monitoring';

interface LibraryItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  release_date: string | null;
  monitored: boolean;
  created_at: string;
  requested_by?: string | null;
  status?: RequestStatus;
  last_checked_at?: string | null;
  last_error?: string | null;
  matched_torrent_name?: string | null;
  matched_torrent_magnet?: string | null;
  matched_torrent_size?: number | null;
  matched_torrent_seeds?: number | null;
}

interface SearchResultItem {
  name: string;
  link: string;
  size: number;
  seeds: number;
  leech: number;
  engine_url: string;
  desc_link: string;
  publishDate?: string | null;
  is_compatible?: boolean;
  incompatible_reason?: string | null;
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canForce = useAuthStore((s) => !!s.user?.allow_force_interactive_download);

  const [item, setItem] = useState<LibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backdropPath, setBackdropPath] = useState<string | null>(null);
  const [overview, setOverview] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [forceAvailable, setForceAvailable] = useState(false);
  const [autoSearchLoading, setAutoSearchLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      try {
        await globalSettings.load();
      } catch (e) { }
      const list = await api.getLibrary();
      const found = (list || []).find((x: LibraryItem) => x.id === id) || null;
      setItem(found);
      if (!found) {
        setError('Demande introuvable');
      } else {
        try {
          const tmdbType = found.media_type === 'movie' || found.media_type === 'animation' ? 'movie' : 'tv';
          const data = tmdbType === 'movie'
            ? await tmdbAPI.getMovieDetails(String(found.tmdb_id))
            : await tmdbAPI.getTvDetails(String(found.tmdb_id));
          if (data.backdrop_path) {
            setBackdropPath(`https://image.tmdb.org/t/p/original${data.backdrop_path}`);
          }
          setOverview(data?.overview || '');
        } catch (e) { }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  const autoSearch = async () => {
    if (!id) return;
    try {
      setAutoSearchLoading(true);
      const data = await api.autoSearchLibraryRequest(id);
      if (data?.request) setItem(data.request);
      await load();
    } catch (e) {
      setError('Erreur scan auto');
    } finally {
      setAutoSearchLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    try {
      await api.deleteLibraryItem(id);
      showToast('Demande retirée du suivi');
      navigate('/library');
    } catch (e) {
      showErrorToast('Erreur lors de la suppression');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const openSearchModal = async () => {
    if (!id) return;
    try {
      setIsModalOpen(true);
      setModalLoading(true);
      setModalError(null);
      setForceAvailable(false);
      setResults([]);
      const data = await api.searchLibraryRequest(id);
      setResults(data?.results || []);
    } catch (e) {
      setModalError('Erreur recherche');
    } finally {
      setModalLoading(false);
    }
  };

  const downloadResult = async (r: SearchResultItem) => {
    if (!id) return;
    try {
      setModalError(null);
      await api.selectLibraryRequest(id, { name: r.name, link: r.link, size: r.size, seeds: r.seeds });
      const updated = await api.sendLibraryRequestToQbit(id);
      setItem(updated);
      setIsModalOpen(false);
      setForceAvailable(false);
    } catch (e: any) {
      if (e?.status === 409) {
        setModalError('Déjà présent dans la médiathèque');
        let canForceLive = canForce;
        if (user?.id) {
          try {
            const freshUser = await api.getUser(user.id);
            canForceLive = !!freshUser?.allow_force_interactive_download;
            if (canForceLive !== canForce) {
              useAuthStore.getState().patchUser({
                allow_force_interactive_download: canForceLive,
              });
            }
          } catch {
            /* garder la valeur locale */
          }
        }
        setForceAvailable(canForceLive);
      } else {
        setModalError('Erreur envoi');
      }
    }
  };

  const forceDownload = async () => {
    if (!id) return;
    try {
      setModalLoading(true);
      const updated = await api.sendLibraryRequestToQbit(id, { force: true });
      setItem(updated);
      setIsModalOpen(false);
      setForceAvailable(false);
      setModalError(null);
    } catch (e: any) {
      setModalError(e?.status === 403 ? 'Forçage non autorisé' : 'Erreur forçage');
    } finally {
      setModalLoading(false);
    }
  };

  const closeSearchModal = () => {
    setIsModalOpen(false);
    setModalError(null);
    setForceAvailable(false);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-black uppercase text-xs animate-pulse">Chargement...</p>
    </div>
  );

  if (!item) return (
    <div className="p-8">
      <button onClick={() => navigate('/library')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 group transition-all">
        <ArrowLeft size={18} /><span className="font-bold">Retour</span>
      </button>
      <EmptyState
        icon={<XCircle size={40} />}
        title={error || 'Demande introuvable'}
        description="Cette demande n'existe plus ou a été retirée du suivi."
        action={
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="px-6 py-2.5 premium-gradient rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20"
          >
            Retour à la bibliothèque
          </button>
        }
      />
    </div>
  );

  const canManage = Boolean(user?.is_admin || item.user_id === user?.id);

  return (
    <div className="animate-premium-fade relative min-h-screen">
      {backdropPath && (
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-3xl" />
          <img src={backdropPath} alt="Backdrop" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
        </div>
      )}

      <div className="relative z-10 space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/library')} className="flex items-center gap-2 text-gray-500 hover:text-white group transition-all">
            <div className="p-2 bg-white/5 rounded-full group-hover:bg-white/10 transition-colors"><ArrowLeft size={18} /></div>
            <span className="font-bold tracking-tight">Demandes</span>
          </button>
          <button onClick={load} className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest">Rafraîchir</button>
        </div>

        <div className="glass-card p-8 border-white/5">
          <div className="flex flex-col md:flex-row gap-10">
            <div className="w-32 md:w-48 lg:w-64 flex-shrink-0 mx-auto md:mx-0">
              <div className="glass-card overflow-hidden shadow-2xl rotate-1">
                {item.poster_url ? <img src={item.poster_url} alt={item.title} className="w-full h-auto object-cover" /> : <div className="aspect-[2/3] flex items-center justify-center bg-gray-900 text-gray-600 font-black uppercase text-xs">No Poster</div>}
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase mb-2">{item.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                    {item.release_date && <span>{item.release_date.split('-')[0]}</span>}
                    {item.requested_by && <span className="flex items-center gap-2 text-blue-400/60"><CheckCircle2 size={14} />Par {item.requested_by}</span>}
                  </div>
                </div>
                {(() => {
                  const badge = getRequestStatusBadge(item.status);
                  return (
                    <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${badge.className}`}>
                      {badge.label}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Synopsis</h3>
                <ExpandableText text={overview || "Aucune description."} maxLines={3} className="max-w-4xl" />
              </div>

              <div className="pt-6 border-t border-white/5 flex flex-wrap items-center gap-4">
                <button onClick={openSearchModal} disabled={!canManage} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all disabled:opacity-30">
                  <Search size={16} className="text-blue-500" />Indexation Manuelle
                </button>
                <div className="flex-1" />
                <button onClick={autoSearch} disabled={autoSearchLoading} className="px-8 py-3 premium-gradient rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:scale-[1.02] transition-all disabled:opacity-50">
                  {autoSearchLoading ? 'Scan...' : 'Scan Automatique'}
                </button>
                <button onClick={() => setIsDeleteModalOpen(true)} disabled={!canManage} className="p-3 bg-red-600/10 border border-red-600/20 rounded-2xl text-red-400 hover:bg-red-600/20 transition-all disabled:opacity-30" title="Supprimer"><Trash2 size={20} /></button>
              </div>
            </div>
          </div>
        </div>

        {item.matched_torrent_name && (
          <div className="glass-card p-6 border-blue-500/10 bg-blue-500/5 animate-premium-fade">
            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Cible Identifiée</h3>
            <div className="text-white font-bold text-lg mb-4">{item.matched_torrent_name}</div>
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Taille</span><span className="text-gray-300 font-bold">{formatSize(item.matched_torrent_size || 0)}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Sources</span><span className="text-green-400 font-bold">{item.matched_torrent_seeds || 0} SEEDS</span></div>
            </div>
          </div>
        )}

        <ManualSearchModal
          isOpen={isModalOpen}
          onClose={closeSearchModal}
          title="Recherche Manuelle"
          subtitle={item.title}
          results={results}
          isLoading={modalLoading}
          onDownload={downloadResult}
          error={modalError}
          onForceDownload={forceAvailable ? forceDownload : undefined}
        />

        <ConfirmModal
          isOpen={isDeleteModalOpen}
          title="Retirer du suivi ?"
          message="Cette demande sera supprimée. La surveillance de ce média s'arrêtera."
          confirmLabel="Supprimer"
          onConfirm={confirmDelete}
          onClose={() => setIsDeleteModalOpen(false)}
        />
      </div>
    </div>
  );
}
