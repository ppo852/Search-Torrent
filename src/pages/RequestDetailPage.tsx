import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Search, X, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { tmdbAPI } from '../lib/tmdb';
import { globalSettings } from '../services/settings';
import { useAuthStore } from '../stores/authStore';

type MediaType = 'movie' | 'tv' | 'anime';

type RequestStatus = 'pending' | 'found' | 'sent_to_qbit' | 'error';

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

function formatBytes(bytes: number) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusLabel(status?: RequestStatus) {
  if (status === 'found') return 'Trouvé';
  if (status === 'sent_to_qbit') return 'Envoyé à qBittorrent';
  if (status === 'error') return 'Erreur';
  return 'En attente';
}

function statusClasses(status?: RequestStatus) {
  if (status === 'found') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (status === 'sent_to_qbit') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (status === 'error') return 'bg-red-500/20 text-red-300 border-red-500/30';
  return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
}

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [item, setItem] = useState<LibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<string>('');
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [forceAvailable, setForceAvailable] = useState(false);

  const [autoSearchLoading, setAutoSearchLoading] = useState(false);

  const [sortField, setSortField] = useState<'size' | 'date'>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const load = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const list = await api.getLibrary();
      const found = (list || []).find((x: LibraryItem) => x.id === id) || null;
      setItem(found);
      if (!found) {
        setError('Demande introuvable');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const autoSearch = async () => {
    if (!id) return;
    try {
      setError(null);
      setAutoSearchLoading(true);
      const data = await api.autoSearchLibraryRequest(id);
      if (data?.request) setItem(data.request);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la recherche automatique');
    } finally {
      setAutoSearchLoading(false);
    }
  };

  const deleteRequest = async () => {
    if (!id) return;
    try {
      setError(null);
      await api.deleteLibraryItem(id);
      navigate('/library');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    const loadOverview = async () => {
      if (!item) return;
      if (!tmdbAPI) return;

      try {
        setOverviewError(null);
        setOverview('');

        if (!globalSettings.getTmdbAccessToken()) {
          await globalSettings.load();
        }

        if (!globalSettings.getTmdbAccessToken()) {
          setOverviewError('TMDB n\'est pas configuré (token manquant).');
          return;
        }

        const tmdbType = item.media_type === 'movie' ? 'movie' : 'tv';
        const url = new URL(`${tmdbAPI.BASE_URL}/${tmdbType}/${item.tmdb_id}`);
        url.searchParams.append('language', 'fr-FR');

        const response = await fetch(url.toString(), {
          headers: tmdbAPI.getHeaders()
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('TMDB API error: 401 (token invalide)');
          }
          throw new Error(`TMDB API error: ${response.status}`);
        }

        const data = await response.json();
        setOverview(data?.overview || '');
      } catch (e) {
        setOverviewError(e instanceof Error ? e.message : 'Erreur lors du chargement du descriptif');
      }
    };

    loadOverview();
  }, [item?.tmdb_id, item?.media_type]);

  const sortedResults = useMemo(() => {
    const cloned = [...results];

    const getDateValue = (r: SearchResultItem) => {
      if (!r.publishDate) return 0;
      const d = new Date(r.publishDate);
      const t = d.getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    cloned.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'size') {
        cmp = (a.size || 0) - (b.size || 0);
      } else {
        cmp = getDateValue(a) - getDateValue(b);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return cloned;
  }, [results, sortField, sortDirection]);

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
      if (data?.request) setItem(data.request);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Erreur lors de la recherche');
    } finally {
      setModalLoading(false);
    }
  };

  const downloadResult = async (r: SearchResultItem) => {
    if (!id) return;
    try {
      setModalError(null);
      setForceAvailable(false);

      // 1) Enregistrer le torrent choisi
      await api.selectLibraryRequest(id, {
        name: r.name,
        link: r.link,
        size: r.size,
        seeds: r.seeds
      });

      // 2) Lancer le téléchargement dans qBittorrent
      const updated = await api.sendLibraryRequestToQbit(id);
      setItem(updated);
      setIsModalOpen(false);
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
    if (!id) return;
    try {
      setModalError(null);
      setModalLoading(true);
      const updated = await api.sendLibraryRequestToQbit(id, { force: true });
      setItem(updated);
      setIsModalOpen(false);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Erreur lors du téléchargement');
    } finally {
      setModalLoading(false);
      setForceAvailable(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-8 text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/library')}
          className="inline-flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="text-center py-8 text-gray-400">{error || 'Demande introuvable'}</div>
      </div>
    );
  }

  const canManage = Boolean(user?.is_admin || item.user_id === user?.id);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/library')}
          className="inline-flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          Rafraîchir
        </button>
      </div>

      {error && <div className="text-center py-4 text-red-500">{error}</div>}

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex gap-4 items-start">
          <div className="w-28 h-40 bg-gray-900 rounded overflow-hidden flex-shrink-0">
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold text-lg line-clamp-2">{item.title}</div>
                {item.release_date && <div className="text-sm text-gray-400 mt-1">{item.release_date}</div>}
                {item.requested_by && (
                  <div className="text-xs text-gray-500 mt-1">Demandé par: {item.requested_by}</div>
                )}
              </div>

              <div className={`px-3 py-1 rounded border text-sm ${statusClasses(item.status)}`}>
                {statusLabel(item.status)}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-sm text-gray-300">Description</div>
              {overviewError ? (
                <div className="mt-1 text-sm text-red-300">{overviewError}</div>
              ) : overview ? (
                <div className="mt-1 text-sm text-gray-200 whitespace-pre-line">{overview}</div>
              ) : (
                <div className="mt-1 text-sm text-gray-400">Aucune description.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={openSearchModal}
              disabled={!canManage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white"
            >
              <Search className="h-4 w-4" />
              Recherche manuel
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={autoSearch}
                disabled={autoSearchLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white"
              >
                {autoSearchLoading ? 'Recherche...' : 'Recherche automatique'}
              </button>

              <button
                onClick={deleteRequest}
                disabled={!canManage}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white"
              >
                Supprimer
              </button>
            </div>

            <div className="text-sm text-gray-300">
              Dernière recherche:{' '}
              <span className="text-gray-200">
                {item.last_checked_at ? formatDate(item.last_checked_at) : 'Jamais'}
              </span>
            </div>
          </div>

          {item.last_error && (
            <div className="mt-2 text-sm text-red-300">Erreur: {item.last_error}</div>
          )}
        </div>

        {item.matched_torrent_name && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-300">Torrent sélectionné</div>
            <div className="mt-1 text-white text-sm break-words">{item.matched_torrent_name}</div>
            <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-3">
              {typeof item.matched_torrent_size === 'number' && (
                <div>Taille: {formatBytes(item.matched_torrent_size)}</div>
              )}
              {typeof item.matched_torrent_seeds === 'number' && (
                <div>Seeds: {item.matched_torrent_seeds}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="text-white font-semibold">Résultats de recherche</div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="text-sm text-gray-300">
                {item.title}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => {
                    if (sortField === 'size') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('size');
                      setSortDirection('desc');
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-gray-800 text-gray-200 hover:bg-gray-700 text-sm"
                >
                  Trier par taille
                </button>
                <button
                  onClick={() => {
                    if (sortField === 'date') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('date');
                      setSortDirection('desc');
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-gray-800 text-gray-200 hover:bg-gray-700 text-sm"
                >
                  Trier par date
                </button>
              </div>
            </div>

            {modalError && (
              <div className="px-4 py-2 text-sm text-red-400 flex items-center justify-between gap-3">
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
            )}

            <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">
              {modalLoading ? (
                <div className="text-center py-10 text-gray-400">Recherche en cours...</div>
              ) : sortedResults.length === 0 ? (
                <div className="text-center py-10 text-gray-400">Aucun résultat</div>
              ) : (
                <div className="space-y-2">
                  {sortedResults.map((r) => (
                    <div
                      key={`${r.engine_url}-${r.name}-${r.size}-${r.seeds}`}
                      className="bg-gray-800 border border-gray-700 rounded p-3"
                    >
                      <div className="flex gap-3 items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <div
                              className="pt-0.5"
                              title={r.is_compatible ? 'Compatible' : (r.incompatible_reason || 'Non compatible')}
                            >
                              {r.is_compatible ? (
                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                            </div>
                            <div className="text-white text-sm break-words">{r.name}</div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-3">
                            <div>Taille: {formatBytes(r.size)}</div>
                            <div>Seeds: {r.seeds}</div>
                            {r.publishDate && <div>Date: {formatDate(r.publishDate)}</div>}
                            {r.engine_url && <div>Indexer: {r.engine_url}</div>}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <button
                            onClick={() => downloadResult(r)}
                            className="px-3 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm"
                          >
                            Télécharger
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
