import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
<<<<<<< HEAD
import { ArrowLeft, Clock, Search, Tag, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { TvSeasonRequest, TvEpisode, TvSeasonPresence } from '../types';
import ManualSearchModal from '../components/ManualSearchModal';
import { Toast } from '../components/core/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { globalSettings } from '../services/settings';
import { useAuthStore } from '../stores/authStore';
import { tmdbAPI } from '../services/tmdb/tmdb';
import { ExpandableText } from '../components/ui/ExpandableText';

=======
import { ArrowLeft, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { tmdbAPI } from '../lib/tmdb';
import { globalSettings } from '../services/settings';
import { useAuthStore } from '../stores/authStore';

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
  // Optional fields from creation response (backend Option A)
  present_episodes?: number[];
  missing_episodes?: number[];
}
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

type TvDetailEpisode = {
  episode_number: number;
  name?: string;
  air_date?: string | null;
};

<<<<<<< HEAD
=======
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
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

type TvSeasonHistoryRow = {
  id: string;
  tv_season_request_id: string;
  action: string;
  episode_number: number | null;
  torrent_name: string | null;
  torrent_magnet: string | null;
  torrent_size: number | null;
  torrent_seeds: number | null;
  created_at: string;
};

function formatDate(value?: string | null) {
  if (!value) return 'Date inconnue';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function tvSeasonStatusLabel(status?: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'pending') return 'En attente';
  if (s === 'found') return 'Torrent trouvé';
  if (s === 'monitoring' || s === 'monitored') return 'Surveillance';
<<<<<<< HEAD
  if (s === 'sent_to_qbit') return 'Actif';
  if (s === 'already_available') return 'Présent';
  if (s === 'not_aired') return 'Non diffusé';
  if (s === 'completed' || s === 'completed_season') return 'Complété';
=======
  if (s === 'sent_to_qbit') return 'Envoyé à qBittorrent';
  if (s === 'already_available') return 'Déjà présent (avance auto)';
  if (s === 'not_aired') return 'Pas encore diffusé';
  if (s === 'completed' || s === 'completed_season') return 'Saison complétée';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  if (s === 'error') return 'Erreur';
  return status ? String(status) : '—';
}

export function TvShowRequestPage() {
  const { tmdbId, mediaType } = useParams<{ tmdbId: string; mediaType: 'tv' | 'anime' }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [seasons, setSeasons] = useState<TvSeasonRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const [backdropPath, setBackdropPath] = useState<string | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
=======

  const [overview, setOverview] = useState<string | null>(null);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);
  const [episodesBySeasonId, setEpisodesBySeasonId] = useState<Record<string, TvDetailEpisode[]>>({});
  const [episodesLoadingSeasonId, setEpisodesLoadingSeasonId] = useState<string | null>(null);
<<<<<<< HEAD
  const [presenceBySeasonId, setPresenceBySeasonId] = useState<Record<string, { present_episodes: number[]; downloading_episodes: number[]; missing_episodes: number[] }>>({});
  const [presenceLoadingSeasonId, setPresenceLoadingSeasonId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalResults, setModalResults] = useState<SearchResultItem[]>([]);
  const [modalSeason, setModalSeason] = useState<TvSeasonRequest | null>(null);
  const [modalEpisodeNumber, setModalEpisodeNumber] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [forceAvailable, setForceAvailable] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<TvSeasonHistoryRow[]>([]);
  const [historySeason, setHistorySeason] = useState<TvSeasonRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [seasonToDelete, setSeasonToDelete] = useState<TvSeasonRequest | null>(null);

  const parsedTmdbId = Number(tmdbId);

  const load = async () => {
    try {
      setIsLoading(true);
      try {
        await globalSettings.load();
      } catch (e) { }
      const list = await api.getTvSeasonRequests();
      const filtered = (list || []).filter((x: any) => x.tmdb_id === parsedTmdbId && x.media_type === mediaType);
      setSeasons(filtered);
      if (filtered.length > 0) {
        try {
          const data = await tmdbAPI.getTvDetails(String(parsedTmdbId));
          if (data.backdrop_path) setBackdropPath(`https://image.tmdb.org/t/p/original${data.backdrop_path}`);
          setOverview(data.overview);
        } catch (e) { }
      } else setError('Aucune saison');
    } catch (e) { setError('Erreur'); }
    finally { setIsLoading(false); }
  };

  const loadSeasonEpisodes = async (season: TvSeasonRequest) => {
    if (episodesBySeasonId[season.id]) return;
    setEpisodesLoadingSeasonId(season.id);
    try {
      // On s'assure que l'ID est bien une chaîne et le numéro un entier
      const showId = String(season.tmdb_id);
      const sNum = Number(season.season_number);

      const data = await tmdbAPI.getTvSeasonDetails(showId, sNum);

      if (data && Array.isArray(data.episodes)) {
        const eps = data.episodes.map((e: any) => ({
          episode_number: e.episode_number,
          name: e.name || `Épisode ${e.episode_number}`,
          air_date: e.air_date
        }));
        setEpisodesBySeasonId(prev => ({ ...prev, [season.id]: eps }));
      } else {
        setEpisodesBySeasonId(prev => ({ ...prev, [season.id]: [] }));
      }
    } catch (e) {
      console.error("Erreur TMDB Episodes:", e);
      setEpisodesBySeasonId(prev => ({ ...prev, [season.id]: [] }));
    }
    finally { setEpisodesLoadingSeasonId(null); }
  };

  const loadSeasonPresence = async (season: TvSeasonRequest, force = false) => {
    if (!force && presenceBySeasonId[season.id]) return;
    setPresenceLoadingSeasonId(season.id);
    try {
      const data = await api.getTvSeasonPresence(season.id);
      setPresenceBySeasonId(prev => ({ ...prev, [season.id]: data }));
    } catch (e) { }
    finally { setPresenceLoadingSeasonId(null); }
=======
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  // Presence per season (backend Option B)
  const [presenceBySeasonId, setPresenceBySeasonId] = useState<Record<string, { present_episodes: number[]; downloading_episodes: number[]; missing_episodes: number[]; error_episodes?: number[] }>>({});
  const [presenceLoadingSeasonId, setPresenceLoadingSeasonId] = useState<string | null>(null);
  const [presenceError, setPresenceError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalResults, setModalResults] = useState<SearchResultItem[]>([]);
  const [modalSeason, setModalSeason] = useState<TvSeasonRequest | null>(null);
  const [modalEpisodeNumber, setModalEpisodeNumber] = useState<number | null>(null);
  const [forceAvailable, setForceAvailable] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<TvSeasonHistoryRow[]>([]);
  const [historySeason, setHistorySeason] = useState<TvSeasonRequest | null>(null);

  const parsedTmdbId = Number(tmdbId);

  const ensureTmdbToken = async () => {
    if (!globalSettings.getTmdbAccessToken()) {
      await globalSettings.load();
    }
    return Boolean(globalSettings.getTmdbAccessToken());
  };

  const loadSeasonPresence = async (season: TvSeasonRequest, force = false) => {
    const cacheKey = season.id;
    if (!force && presenceBySeasonId[cacheKey]) return;
    setPresenceLoadingSeasonId(season.id);
    setPresenceError(null);
    try {
      // Prefer server-calculated presence via endpoint
      const data = await api.getTvSeasonPresence(season.id);
      const present = Array.isArray(data?.present_episodes) ? data.present_episodes : (season.present_episodes || []);
      const downloading = Array.isArray(data?.downloading_episodes) ? data.downloading_episodes : [];
      const errorEpisodes = Array.isArray(data?.error_episodes) ? data.error_episodes : [];
      const missing = Array.isArray(data?.missing_episodes) ? data.missing_episodes : (season.missing_episodes || []);
      setPresenceBySeasonId((prev) => ({
        ...prev,
        [cacheKey]: { present_episodes: present, downloading_episodes: downloading, missing_episodes: missing, error_episodes: errorEpisodes }
      }));

      if (typeof data?.next_episode_number === 'number' || typeof data?.status === 'string') {
        setSeasons((prev) => prev.map((s) => {
          if (s.id !== season.id) return s;
          return {
            ...s,
            next_episode_number: typeof data?.next_episode_number === 'number' ? data.next_episode_number : s.next_episode_number,
            status: typeof data?.status === 'string' ? data.status : s.status
          };
        }));
      }
    } catch (e) {
      setPresenceError(e instanceof Error ? e.message : 'Erreur présence');
    } finally {
      setPresenceLoadingSeasonId(null);
    }
  };

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const list = await api.getTvSeasonRequests();
      const filtered = (list || []).filter((x: TvSeasonRequest) => {
        return x.tmdb_id === parsedTmdbId && x.media_type === mediaType;
      });

      setSeasons(filtered);
      if (filtered.length === 0) {
        setError('Aucune saison demandée pour cette série');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeasonEpisodes = async (season: TvSeasonRequest) => {
    const cacheKey = season.id;
    if (episodesBySeasonId[cacheKey]) return;

    setEpisodesLoadingSeasonId(season.id);
    setEpisodesError(null);

    try {
      const hasToken = await ensureTmdbToken();
      if (!hasToken) {
        throw new Error("TMDB n'est pas configuré (token manquant). ");
      }

      const seasonUrl = new URL(`${tmdbAPI.BASE_URL}/tv/${season.tmdb_id}/season/${season.season_number}`);
      seasonUrl.searchParams.append('language', 'fr-FR');

      const seasonRes = await fetch(seasonUrl.toString(), {
        headers: tmdbAPI.getHeaders()
      });
      if (!seasonRes.ok) {
        if (seasonRes.status === 401) {
          throw new Error('TMDB API error: 401 (token invalide)');
        }
        throw new Error(`TMDB API error: ${seasonRes.status}`);
      }
      const seasonData = await seasonRes.json();

      const eps = Array.isArray(seasonData?.episodes)
        ? seasonData.episodes
          .map((e: any) => ({
            episode_number: Number(e?.episode_number),
            name: e?.name,
            air_date: e?.air_date
          }))
          .filter((e: any) => Number.isInteger(e?.episode_number) && e.episode_number > 0)
        : [];

      setEpisodesBySeasonId((prev: Record<string, TvDetailEpisode[]>) => ({ ...prev, [cacheKey]: eps }));
    } catch (e) {
      setEpisodesError(e instanceof Error ? e.message : 'Erreur lors du chargement des épisodes');
    } finally {
      setEpisodesLoadingSeasonId(null);
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  };

  const toggleSeason = async (season: TvSeasonRequest) => {
    const next = expandedSeasonId === season.id ? null : season.id;
    setExpandedSeasonId(next);
    if (next) {
      await loadSeasonEpisodes(season);
      await loadSeasonPresence(season);
    }
  };

  const openEpisodeSearchModal = async (season: TvSeasonRequest, episodeNumber: number) => {
<<<<<<< HEAD
    setIsModalOpen(true);
    setModalLoading(true);
    setModalSeason(season);
    setModalEpisodeNumber(episodeNumber);
    try {
      const data = await api.searchTvSeasonRequestEpisode(season.id, { episode_number: episodeNumber });
      setModalResults(data?.results || []);
    } catch (e) { }
    finally { setModalLoading(false); }
  };

  const openSeasonSearchModal = async (season: TvSeasonRequest) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalSeason(season);
    setModalEpisodeNumber(null); // null signifie qu'on cherche un Pack
    try {
      const data = await api.searchTvSeasonRequest(season.id);
      setModalResults(data?.results || []);
    } catch (e) { }
    finally { setModalLoading(false); }
  };

  const openHistory = async (season: TvSeasonRequest) => {
    setIsHistoryOpen(true);
    setHistorySeason(season);
    setHistoryLoading(true);
    try {
      const data = await api.getTvSeasonHistory(season.id);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (e) { }
    finally { setHistoryLoading(false); }
  };

  const downloadResult = async (r: SearchResultItem) => {
    if (!modalSeason) return;
    try {
      await api.selectTvSeasonRequest(modalSeason.id, { name: r.name, link: r.link, size: r.size, seeds: r.seeds });
      const updated = await api.sendTvSeasonRequestToQbit(modalSeason.id, { episode_number: modalEpisodeNumber });
      setSeasons(prev => prev.map(s => s.id === updated.id ? updated : s));
      setIsModalOpen(false);
      setToastMessage(modalEpisodeNumber ? `Épisode E${modalEpisodeNumber} envoyé !` : `Pack Saison ${modalSeason.season_number} envoyé !`);
    } catch (e: any) {
      if (e?.status === 409) { setForceAvailable(true); setModalError('Déjà présent'); }
=======
    try {
      setIsModalOpen(true);
      setModalLoading(true);
      setModalError(null);
      setForceAvailable(false);
      setModalResults([]);
      setModalSeason(season);
      setModalEpisodeNumber(episodeNumber);

      const data = await api.searchTvSeasonRequestEpisode(season.id, { episode_number: episodeNumber });
      setModalResults(data?.results || []);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Erreur lors de la recherche');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalLoading(false);
    setModalError(null);
    setForceAvailable(false);
    setModalResults([]);
    setModalSeason(null);
    setModalEpisodeNumber(null);
  };

  const openHistory = async (season: TvSeasonRequest) => {
    try {
      setIsHistoryOpen(true);
      setHistorySeason(season);
      setHistoryLoading(true);
      setHistoryError(null);
      setHistoryItems([]);
      const data = await api.getTvSeasonHistory(season.id);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Erreur lors du chargement de l\'historique');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setIsHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryError(null);
    setHistoryItems([]);
    setHistorySeason(null);
  };

  const applyUpdatedSeason = (updated: TvSeasonRequest) => {
    setSeasons((prev: TvSeasonRequest[]) => prev.map((s: TvSeasonRequest) => (s.id === updated.id ? { ...s, ...updated } : s)));
  };

  const canManageSeason = (season: TvSeasonRequest) => {
    return Boolean(user?.is_admin || season.user_id === user?.id);
  };

  const downloadResult = async (r: SearchResultItem) => {
    if (!modalSeason || modalEpisodeNumber == null) return;
    try {
      setModalError(null);
      setForceAvailable(false);

      if (!canManageSeason(modalSeason)) {
        setModalError('Actions limitées — Seul le bouton “Auto” est disponible pour les demandes créées par un autre utilisateur.');
        return;
      }

      await api.selectTvSeasonRequest(modalSeason.id, {
        name: r.name,
        link: r.link,
        size: r.size,
        seeds: r.seeds
      });

      const updated = await api.sendTvSeasonRequestToQbit(modalSeason.id, { episode_number: modalEpisodeNumber });
      applyUpdatedSeason(updated);
      closeModal();
    } catch (e) {
      const anyErr = e as any;
      if (anyErr?.status === 409) {
        setForceAvailable(true);
        setModalError(anyErr?.data?.error || 'Déjà présent dans la médiathèque');
        return;
      }
      setModalError(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
    }
  };

  const forceDownload = async () => {
    if (!modalSeason || modalEpisodeNumber == null) return;
    try {
      setModalError(null);
      setModalLoading(true);

      if (!canManageSeason(modalSeason)) {
        setModalError('Actions limitées — Seul le bouton “Auto” est disponible pour les demandes créées par un autre utilisateur.');
        return;
      }

      const updated = await api.sendTvSeasonRequestToQbit(modalSeason.id, { episode_number: modalEpisodeNumber, force: true });
      applyUpdatedSeason(updated);
      closeModal();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
    } finally {
      setModalLoading(false);
      setForceAvailable(false);
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    }
  };

  const autoDownloadEpisode = async (season: TvSeasonRequest, episodeNumber: number) => {
<<<<<<< HEAD
    setToastMessage(`Recherche automatique lancée pour E${episodeNumber}...`);
    try {
      const data = await api.autoSearchTvSeasonEpisodeRequest(season.id, { episode_number: episodeNumber });
      if (data?.request) {
        setSeasons(prev => prev.map(s => s.id === data.request.id ? data.request : s));
        const status = data.result?.status;
        if (status === 'sent_episode') {
          setToastMessage(`Torrent trouvé et envoyé pour E${episodeNumber} !`);
        } else if (status === 'no_results') {
          setToastMessage(`Aucun résultat conforme pour E${episodeNumber}.`);
        } else if (status === 'already_present') {
          setToastMessage(`Épisode ${episodeNumber} déjà présent.`);
        } else if (status === 'not_aired') {
          setToastMessage(`Épisode ${episodeNumber} pas encore diffusé.`);
        } else if (status === 'error') {
          setToastMessage(`Erreur : ${data.result?.error || 'Échec de la recherche'}`);
        }
      }
    } catch (e: any) {
      setToastMessage(`Erreur lors de la recherche : ${e.message || 'Erreur inconnue'}`);
=======
    try {
      setError(null);
      const data = await api.autoSearchTvSeasonEpisodeRequest(season.id, { episode_number: episodeNumber });
      if (data?.request) {
        applyUpdatedSeason(data.request);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    }
  };

  const autoDownloadSeason = async (season: TvSeasonRequest) => {
<<<<<<< HEAD
    setToastMessage(`Recherche automatique lancée pour la saison ${season.season_number}...`);
    try {
      const data = await api.autoSearchTvSeasonRequest(season.id);
      if (data?.request) {
        setSeasons(prev => prev.map(s => s.id === data.request.id ? data.request : s));
        setToastMessage(`Scan de la saison ${season.season_number} terminé.`);
      }
    } catch (e: any) {
      setToastMessage(`Erreur lors du scan : ${e.message || 'Erreur inconnue'}`);
    }
  };

  const deleteSeason = (season: TvSeasonRequest) => {
    setSeasonToDelete(season);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!seasonToDelete) return;
    try {
      await api.deleteTvSeasonRequest(seasonToDelete.id);
      setSeasons(prev => prev.filter(s => s.id !== seasonToDelete.id));
      setToastMessage(`Saison ${seasonToDelete.season_number} supprimée.`);
    } catch (e: any) {
      setToastMessage(`Erreur lors de la suppression : ${e.message || 'Erreur inconnue'}`);
    } finally {
      setIsConfirmModalOpen(false);
      setSeasonToDelete(null);
    }
  };

  useEffect(() => { load(); }, [tmdbId, mediaType]);

  const canManageSeason = (season: TvSeasonRequest) => Boolean(user?.is_admin || season.user_id === user?.id);
  const sortedSeasons = useMemo(() => [...seasons].sort((a, b) => a.season_number - b.season_number), [seasons]);
  const title = seasons[0]?.title || 'Série';
  const posterUrl = seasons[0]?.poster_url || null;
  const hasLimitedActions = seasons.some(s => !canManageSeason(s));
  const isAnimeShow = mediaType === 'anime' || seasons.some((s) => s.media_type === 'anime');
  const mediaTypeLabel = isAnimeShow ? 'Anime' : 'Série TV';

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-black uppercase text-xs animate-pulse">Chargement...</p>
    </div>
  );

  return (
    <div className="animate-premium-fade relative min-h-screen pb-20">
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
                {posterUrl ? <img src={posterUrl} alt={title} className="w-full h-auto object-cover" /> : <div className="aspect-[2/3] flex items-center justify-center bg-gray-900 text-gray-600 font-black uppercase text-xs">No Poster</div>}
              </div>
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase mb-4">{title}</h1>
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${isAnimeShow ? 'bg-pink-500/10 border-pink-500/20 text-pink-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                    {mediaTypeLabel}
                  </div>
                  <div className="text-gray-500 text-xs font-bold uppercase tracking-widest">{seasons.length} Saison{seasons.length > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Synopsis</h3>
                <ExpandableText text={overview || "Aucune description."} maxLines={3} className="max-w-3xl" />
              </div>
              {hasLimitedActions && (
                <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400"><Tag size={16} /></div>
                  <p className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest">Mode consultation actif</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Flux de surveillance</h2>
          {sortedSeasons.map((s) => (
            <div key={s.id} className={`glass-card transition-all border-white/5 overflow-hidden ${expandedSeasonId === s.id ? 'ring-2 ring-blue-500/20' : ''}`}>
              <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                <div className="flex-1 cursor-pointer" onClick={() => toggleSeason(s)}>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase">Saison {s.season_number}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${s.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>{tvSeasonStatusLabel(s.status)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] md:text-[10px] font-black text-gray-600 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Clock size={12} /> Prochain: E{s.next_episode_number}</span>
                    {s.requested_by && <span className="flex items-center gap-2"><Tag size={12} /> Demandé par {s.requested_by}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
                  <button onClick={() => openHistory(s)} className="px-3 md:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all">Historique</button>
                  <button onClick={() => openSeasonSearchModal(s)} className="px-3 md:px-4 py-2 bg-white/5 hover:bg-blue-600 rounded-xl text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"><Search size={12} /> Manuel</button>
                  <button onClick={() => autoDownloadSeason(s)} className="px-4 md:px-6 py-2 premium-gradient rounded-xl text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:scale-[1.02] transition-all">Auto Scan</button>
                  <button onClick={() => deleteSeason(s)} disabled={!canManageSeason(s)} className="p-1.5 md:p-2 bg-red-600/5 hover:bg-red-600/10 rounded-xl text-red-400 transition-all disabled:opacity-20"><Trash2 size={18} /></button>
                </div>
              </div>

              {expandedSeasonId === s.id && (
                <div className="bg-black/20 border-t border-white/5 p-6 animate-premium-fade">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Indexés</span><span className="text-green-400 font-black">{(presenceBySeasonId[s.id]?.present_episodes || []).length}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Actifs</span><span className="text-blue-400 font-black">{(presenceBySeasonId[s.id]?.downloading_episodes || []).length}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Manquants</span><span className="text-gray-400 font-black">{(presenceBySeasonId[s.id]?.missing_episodes || []).length}</span></div>
                    </div>
                    <button onClick={() => loadSeasonPresence(s, true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 transition-all text-xs font-bold uppercase tracking-widest">Actualiser</button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {episodesLoadingSeasonId === s.id ? (
                      <div className="col-span-full py-10 text-center animate-pulse text-gray-500 font-black uppercase text-[10px] tracking-widest">
                        Chargement des épisodes...
                      </div>
                    ) : (episodesBySeasonId[s.id] || []).length > 0 ? (episodesBySeasonId[s.id] || []).map((ep) => {
                      const isPresent = (presenceBySeasonId[s.id]?.present_episodes || []).includes(ep.episode_number);
                      const isDownloading = (presenceBySeasonId[s.id]?.downloading_episodes || []).includes(ep.episode_number);
                      return (
                        <div key={ep.episode_number} className="glass-card p-4 border-white/5 hover:bg-white/5 transition-all flex items-center justify-between group">
                          <div className="min-w-0">
                            <div className="text-white font-bold text-sm mb-1 truncate">E{String(ep.episode_number).padStart(2, '0')} — {ep.name}</div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{formatDate(ep.air_date)}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {isPresent ? <div className="px-3 py-1 bg-green-500/10 rounded-lg text-green-400 text-[9px] font-black uppercase tracking-widest">Présent</div>
                              : isDownloading ? <div className="px-3 py-1 bg-blue-500/10 rounded-lg text-blue-400 text-[9px] font-black uppercase tracking-widest animate-pulse">Réception...</div>
                                : <>
                                  <button onClick={() => autoDownloadEpisode(s, ep.episode_number)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white text-[9px] font-black uppercase tracking-widest transition-all">Auto</button>
                                  <button onClick={() => openEpisodeSearchModal(s, ep.episode_number)} disabled={!canManageSeason(s)} className="px-3 py-1.5 bg-white/5 hover:bg-blue-600 rounded-lg text-white text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20 flex items-center gap-2"><Search size={12} /> Manuel</button>
                                </>}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="col-span-full py-10 text-center text-gray-600 font-black uppercase text-[10px] tracking-widest opacity-50">
                        Aucun épisode trouvé pour cette saison
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ManualSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalEpisodeNumber ? "Recherche Épisode" : "Recherche Pack Saison"}
        subtitle={modalEpisodeNumber ? `Saison ${modalSeason?.season_number} — Épisode ${modalEpisodeNumber}` : `Saison ${modalSeason?.season_number} — Pack Complet`}
        results={modalResults}
        isLoading={modalLoading}
        onDownload={downloadResult}
      />

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsHistoryOpen(false)} />
          <div className="glass-card relative w-full max-w-4xl max-h-[85vh] flex flex-col border-white/10 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-xl font-black text-white tracking-tighter uppercase">Historique Saison {historySeason?.season_number}</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {historyLoading ? <div className="text-center py-10 opacity-30 animate-pulse font-black uppercase text-[10px] tracking-widest">Lecture...</div>
                : historyItems.length === 0 ? <div className="text-center py-20 opacity-30 font-black uppercase text-sm">Vide</div>
                  : historyItems.map((h) => (
                    <div key={h.id} className="p-4 bg-white/5 rounded-2xl border-l-4 border-blue-500/40">
                      <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{h.episode_number ? `E${h.episode_number}` : 'Global'}</span><span className="text-[9px] font-bold text-gray-600 uppercase">{formatDateTime(h.created_at)}</span></div>
                      <div className="text-white font-medium text-sm mb-2">{h.torrent_name || h.action}</div>
                      <div className="flex items-center gap-4 text-[9px] font-black text-gray-600 uppercase tracking-widest">{h.torrent_size && <span>{Math.round(h.torrent_size / (1024 * 1024))} MB</span>}{h.torrent_seeds && <span>{h.torrent_seeds} SEEDS</span>}</div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title="Supprimer la demande"
        message={`Voulez-vous vraiment supprimer la surveillance de la saison ${seasonToDelete?.season_number} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleConfirmDelete}
        onClose={() => { setIsConfirmModalOpen(false); setSeasonToDelete(null); }}
        isDanger={true}
      />
=======
    try {
      setError(null);
      const data = await api.autoSearchTvSeasonRequest(season.id);
      if (data?.request) {
        applyUpdatedSeason(data.request);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
    }
  };

  useEffect(() => {
    load();
  }, [tmdbId, mediaType]);

  useEffect(() => {
    const loadOverview = async () => {
      if (!Number.isFinite(parsedTmdbId)) return;
      if (!mediaType) return;

      setTmdbLoading(true);
      setTmdbError(null);
      setOverview(null);

      try {
        const hasToken = await ensureTmdbToken();
        if (!hasToken) {
          setTmdbError("TMDB n'est pas configuré (token manquant). ");
          return;
        }

        const showUrl = new URL(`${tmdbAPI.BASE_URL}/tv/${parsedTmdbId}`);
        showUrl.searchParams.append('language', 'fr-FR');

        const showRes = await fetch(showUrl.toString(), {
          headers: tmdbAPI.getHeaders()
        });
        if (!showRes.ok) {
          if (showRes.status === 401) {
            throw new Error('TMDB API error: 401 (token invalide)');
          }
          throw new Error(`TMDB API error: ${showRes.status}`);
        }
        const showData = await showRes.json();
        setOverview(typeof showData?.overview === 'string' ? showData.overview : null);
      } catch (e) {
        setTmdbError(e instanceof Error ? e.message : 'Erreur lors du chargement TMDB');
      } finally {
        setTmdbLoading(false);
      }
    };

    loadOverview();
  }, [parsedTmdbId, mediaType]);

  const sortedSeasons = useMemo(() => {
    return [...seasons].sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
  }, [seasons]);

  const title = seasons[0]?.title || 'Série';
  const posterUrl = seasons[0]?.poster_url || null;

  const deleteSeason = async (id: string) => {
    try {
      await api.deleteTvSeasonRequest(id);
      setSeasons((prev: TvSeasonRequest[]) => prev.filter((s: TvSeasonRequest) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  const hasLimitedActions = seasons.some((s) => !canManageSeason(s));

  return (
    <div className="container mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/library')}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft size={20} />
        <span>Retour</span>
      </button>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Chargement...</div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex gap-4">
            <div className="w-24 h-36 bg-gray-900 rounded overflow-hidden flex-shrink-0">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No Poster</div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-xl line-clamp-2">{title}</div>
              {tmdbLoading ? (
                <div className="text-gray-400 text-sm mt-2">Chargement description...</div>
              ) : tmdbError ? (
                <div className="text-red-500 text-sm mt-2">{tmdbError}</div>
              ) : overview ? (
                <div className="text-gray-300 text-sm mt-4 whitespace-pre-line">{overview}</div>
              ) : null}
            </div>
          </div>

          {error && (
            <div className="text-center py-4 text-red-500">{error}</div>
          )}

          {hasLimitedActions && (
            <div className="mt-3 rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
              <div className="font-semibold">Actions limitées</div>
              <div>Seul le bouton “Auto” est disponible pour les demandes créées par un autre utilisateur.</div>
            </div>
          )}

          {sortedSeasons.length > 0 && (
            <div className="mt-6">
              <div className="text-white font-semibold">Saisons demandées</div>
              <div className="mt-2 space-y-2">
                {sortedSeasons.map((s) => (
                  <div
                    key={s.id}
                    className="bg-gray-900/50 border border-gray-700 rounded"
                  >
                    <div className="flex items-center justify-between gap-3 p-3">
                      <button
                        onClick={() => toggleSeason(s)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-sm text-gray-200 truncate">Saison {s.season_number}</div>
                        <div className="text-xs text-gray-400 mt-1">Statut: {tvSeasonStatusLabel(s.status)} — Prochain épisode: E{s.next_episode_number}</div>
                        {s.requested_by && (
                          <div className="text-xs text-gray-500 mt-1">Demandé par: {s.requested_by}</div>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openHistory(s)}
                          className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
                        >
                          Historique
                        </button>
                        <button
                          onClick={() => deleteSeason(s.id)}
                          disabled={!canManageSeason(s)}
                          className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md"
                          title="Supprimer la saison"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          onClick={() => autoDownloadSeason(s)}
                          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
                          title="Recherche automatique (saison)"
                        >
                          Auto Saison
                        </button>
                      </div>
                    </div>

                    {expandedSeasonId === s.id && (
                      <div className="border-t border-gray-700 p-3">
                        {/* Presence section */}
                        {presenceError && (
                          <div className="text-sm text-red-400 mb-2">{presenceError}</div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-gray-300">
                            {presenceLoadingSeasonId === s.id ? (
                              <span>Vérification présence…</span>
                            ) : (
                              <>
                                <span className="mr-4">Présents: {(presenceBySeasonId[s.id]?.present_episodes || s.present_episodes || []).length}</span>
                                {(presenceBySeasonId[s.id]?.downloading_episodes || []).length > 0 && (
                                  <span className="mr-4 text-blue-300">En DL: {(presenceBySeasonId[s.id]?.downloading_episodes || []).length}</span>
                                )}
                                <span>Manquants: {(presenceBySeasonId[s.id]?.missing_episodes || s.missing_episodes || []).length}</span>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => loadSeasonPresence(s, true)}
                            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
                          >
                            Rafraîchir
                          </button>
                        </div>

                        {episodesError && (
                          <div className="text-sm text-red-400">{episodesError}</div>
                        )}

                        {episodesLoadingSeasonId === s.id ? (
                          <div className="text-sm text-gray-400">Chargement épisodes...</div>
                        ) : (
                          <div className="space-y-2">
                            {(episodesBySeasonId[s.id] || []).map((ep) => {
                              const isValidated = ep.episode_number < s.next_episode_number;
                              const presentList = presenceBySeasonId[s.id]?.present_episodes || s.present_episodes || [];
                              const downloadingList = presenceBySeasonId[s.id]?.downloading_episodes || [];
                              const errorList = presenceBySeasonId[s.id]?.error_episodes || [];
                              const isPresent = presentList.includes(ep.episode_number);
                              const isDownloading = downloadingList.includes(ep.episode_number);
                              const isError = errorList.includes(ep.episode_number);
                              
                              // Determine status and color
                              let statusText = 'À venir';
                              let statusColor = 'text-gray-300';
                              if (isPresent) {
                                statusText = 'Présent';
                                statusColor = 'text-green-300';
                              } else if (isError) {
                                statusText = 'Erreur téléchargement';
                                statusColor = 'text-red-300';
                              } else if (isDownloading) {
                                statusText = 'En DL';
                                statusColor = 'text-blue-300';
                              } else if (isValidated) {
                                statusText = 'Validé';
                                statusColor = 'text-yellow-300';
                              }
                              
                              return (
                                <div
                                  key={ep.episode_number}
                                  className="flex items-center justify-between gap-3 bg-gray-800/60 border border-gray-700 rounded px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm text-gray-200 truncate">
                                      E{String(ep.episode_number).padStart(2, '0')} {ep.name || ''}
                                    </div>
                                    <div className="text-xs text-gray-400">{formatDate(ep.air_date)}</div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className={`text-xs font-semibold ${statusColor}`}>
                                      {statusText}
                                    </div>
                                    <button
                                      onClick={() => autoDownloadEpisode(s, ep.episode_number)}
                                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
                                      title="Recherche automatique (épisode)"
                                    >
                                      Auto
                                    </button>
                                    <button
                                      onClick={() => openEpisodeSearchModal(s, ep.episode_number)}
                                      disabled={!canManageSeason(s)}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white text-xs"
                                      title="Recherche manuelle"
                                    >
                                      <Search size={14} />
                                      Recherche
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-4xl bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">
                Recherche — Saison {modalSeason?.season_number} Episode {modalEpisodeNumber}
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {modalLoading ? (
              <div className="text-gray-400 text-sm mt-4">Recherche en cours...</div>
            ) : modalError ? (
              <div className="text-red-400 text-sm mt-4 flex items-center justify-between gap-3">
                <span>{modalError}</span>
                {forceAvailable && (
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      forceDownload();
                    }}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
                  >
                    Forcer
                  </button>
                )}
              </div>
            ) : modalResults.length === 0 ? (
              <div className="text-gray-400 text-sm mt-4">Aucun résultat.</div>
            ) : (
              <div className="mt-4 max-h-[30rem] overflow-auto border border-gray-700 rounded">
                {modalResults.map((r: SearchResultItem) => (
                  <div
                    key={r.link}
                    className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-700 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 break-words">{r.name}</div>
                      <div className="text-xs text-gray-400 mt-1">Seeds: {r.seeds} — Taille: {Math.round((r.size || 0) / (1024 * 1024))} MB</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-xs font-semibold ${r.is_compatible === false ? 'text-red-300' : 'text-green-300'}`}
                        title={r.is_compatible === false ? (r.incompatible_reason || 'Non compatible') : 'Compatible'}
                      >
                        {r.is_compatible === false ? 'Non compatible' : 'Compatible'}
                      </div>
                      <button
                        onClick={() => downloadResult(r)}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
                      >
                        Télécharger
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeHistory} />
          <div className="relative w-full max-w-4xl bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">
                Historique — Saison {historySeason?.season_number}
              </div>
              <button
                onClick={closeHistory}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {historyLoading ? (
              <div className="text-gray-400 text-sm mt-4">Chargement...</div>
            ) : historyError ? (
              <div className="text-red-400 text-sm mt-4">{historyError}</div>
            ) : historyItems.length === 0 ? (
              <div className="text-gray-400 text-sm mt-4">Aucun historique.</div>
            ) : (
              <div className="mt-4 max-h-[30rem] overflow-auto border border-gray-700 rounded">
                {historyItems.map((h) => (
                  <div
                    key={h.id}
                    className="px-3 py-2 border-b border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-200 break-words">
                          {h.episode_number ? `E${String(h.episode_number).padStart(2, '0')} — ` : ''}
                          {(h.torrent_name || '').trim() || '—'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDateTime(h.created_at)}
                          {h.action ? ` — ${h.action}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {typeof h.torrent_seeds === 'number' ? `Seeds: ${h.torrent_seeds}` : ''}
                        {typeof h.torrent_size === 'number' ? ` — ${Math.round(h.torrent_size / (1024 * 1024))} MB` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    </div>
  );
}
