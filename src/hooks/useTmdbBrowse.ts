import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import type { TmdbMovieBrowseKind } from '../lib/tmdb-movie-browse';
import type { TmdbTvBrowseKind } from '../lib/tmdb-tv-browse';
import type { TmdbResult } from '../types';

type TmdbBrowseMedia = 'movies' | 'tv';

async function fetchTmdbBrowse(
  media: TmdbBrowseMedia,
  kind: string,
  limit: number
): Promise<TmdbResult[]> {
  const token = useAuthStore.getState().token;
  const response = await fetch(
    `/api/tmdb/${media}/browse?kind=${encodeURIComponent(kind)}&limit=${limit}`,
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const label = media === 'movies' ? 'films' : 'séries';
    throw new Error(text || `Erreur lors du chargement des ${label} TMDB`);
  }

  return response.json();
}

function useTmdbBrowse(
  media: TmdbBrowseMedia,
  kind: string,
  limit = 40,
  enabled = true
) {
  return useQuery({
    queryKey: ['tmdb', media, 'browse', kind, limit],
    queryFn: () => fetchTmdbBrowse(media, kind, limit),
    enabled,
    // Aligné sur le cache browse serveur (BROWSE_CACHE_TTL_MINUTES = 180).
    staleTime: 3 * 60 * 60 * 1000,
    gcTime: 3 * 60 * 60 * 1000,
  });
}

export function useTmdbMovieBrowse(
  kind: TmdbMovieBrowseKind,
  limit = 40,
  enabled = true
) {
  return useTmdbBrowse('movies', kind, limit, enabled);
}

export function useTmdbTvBrowse(
  kind: TmdbTvBrowseKind,
  limit = 40,
  enabled = true
) {
  return useTmdbBrowse('tv', kind, limit, enabled);
}
