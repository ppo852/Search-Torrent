import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import type { PosterBadge } from '../lib/poster-badge';

export interface MovieRequestStatus {
  tmdb_id: number;
  media_type: string;
  requested_by?: string | null;
  status: string;
}

export interface SeasonRequestStatus {
  tmdb_id: number;
  media_type: string;
  season_number: number;
  requested_by?: string | null;
  status: string;
}

export interface InventoryStatus {
  tmdb_id: number | null;
  media_kind: string;
  title_normalized?: string | null;
}

export interface TvPresenceStatus {
  tmdb_id: number;
  title_normalized?: string | null;
  present_episodes: number;
  expected_episodes: number | null;
  series_ended: boolean;
  complete: boolean;
}

export interface RequestStatusMap {
  movies: MovieRequestStatus[];
  seasons: SeasonRequestStatus[];
  inventory: InventoryStatus[];
  tv_presence: TvPresenceStatus[];
}

export async function fetchRequestStatus(): Promise<RequestStatusMap> {
  const token = useAuthStore.getState().token;
  const response = await fetch('/api/library/request-status', {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (!response.ok) {
    throw new Error('Impossible de charger le statut des demandes');
  }

  const data = await response.json();
  return {
    movies: data.movies || [],
    seasons: data.seasons || [],
    inventory: data.inventory || [],
    tv_presence: data.tv_presence || [],
  };
}

function toTmdbId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const REQUESTED_BADGE: PosterBadge = { type: 'requested', label: 'Demandé' };

export function useRequestStatus() {
  const token = useAuthStore((s) => s.token);

  const query = useQuery({
    queryKey: ['library', 'request-status'],
    queryFn: fetchRequestStatus,
    enabled: !!token,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const inventoryIndex = useMemo(() => {
    const moviesById = new Set<number>();
    const tvById = new Set<number>();

    for (const row of query.data?.inventory || []) {
      const id = toTmdbId(row.tmdb_id);
      if (!id) continue;
      if (row.media_kind === 'movie') moviesById.add(id);
      if (row.media_kind === 'tv') tvById.add(id);
    }

    return { moviesById, tvById };
  }, [query.data?.inventory]);

  const tvPresenceById = useMemo(() => {
    const map = new Map<number, TvPresenceStatus>();
    for (const row of query.data?.tv_presence || []) {
      const id = toTmdbId(row.tmdb_id);
      if (id) map.set(id, row);
    }
    return map;
  }, [query.data?.tv_presence]);

  const getPosterBadges = (
    tmdbId: number | string,
    type: 'movie' | 'tv'
  ): PosterBadge[] => {
    const data = query.data;
    if (!data) return [];

    const badges: PosterBadge[] = [];
    const id = toTmdbId(tmdbId);
    if (!id) return badges;

    if (type === 'movie') {
      if (inventoryIndex.moviesById.has(id)) {
        badges.push({ type: 'in_library', label: 'En bibliothèque' });
      }

      const hasRequest = data.movies.some(
        (m) =>
          toTmdbId(m.tmdb_id) === id &&
          (m.media_type === 'movie' || m.media_type === 'animation')
      );
      if (hasRequest) {
        badges.push(REQUESTED_BADGE);
      }

      return badges;
    }

    const tvPresence = tvPresenceById.get(id);

    if (tvPresence && tvPresence.present_episodes > 0) {
      if (tvPresence.series_ended && tvPresence.complete) {
        badges.push({ type: 'series_complete', label: 'Complète' });
      } else {
        badges.push({ type: 'series_partial', label: 'Partiel' });
      }
    } else if (inventoryIndex.tvById.has(id)) {
      badges.push({ type: 'series_partial', label: 'Partiel' });
    }

    const hasSeasonRequest = data.seasons.some(
      (s) =>
        toTmdbId(s.tmdb_id) === id &&
        (s.media_type === 'tv' || s.media_type === 'anime')
    );
    if (hasSeasonRequest) {
      badges.push(REQUESTED_BADGE);
    }

    return badges;
  };

  const getPosterBadgesForMedia = (media: {
    id: number | string;
    type: 'movie' | 'tv';
  }): PosterBadge[] => getPosterBadges(media.id, media.type);

  return {
    ...query,
    getPosterBadges,
    getPosterBadgesForMedia,
  };
}
