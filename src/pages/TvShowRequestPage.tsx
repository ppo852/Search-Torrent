import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

type TvDetailEpisode = {
  episode_number: number;
  name?: string;
  air_date?: string | null;
};

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
  if (s === 'sent_to_qbit') return 'Envoyé à qBittorrent';
  if (s === 'already_available') return 'Déjà présent (avance auto)';
  if (s === 'not_aired') return 'Pas encore diffusé';
  if (s === 'completed' || s === 'completed_season') return 'Saison complétée';
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

  const [overview, setOverview] = useState<string | null>(null);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState<string | null>(null);

  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);
  const [episodesBySeasonId, setEpisodesBySeasonId] = useState<Record<string, TvDetailEpisode[]>>({});
  const [episodesLoadingSeasonId, setEpisodesLoadingSeasonId] = useState<string | null>(null);
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
    }
  };

  const autoDownloadEpisode = async (season: TvSeasonRequest, episodeNumber: number) => {
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
    }
  };

  const autoDownloadSeason = async (season: TvSeasonRequest) => {
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
    </div>
  );
}
