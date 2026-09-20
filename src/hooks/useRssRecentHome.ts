import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import {
  RSS_HOME_HOURS,
  type RecentHomeResponse,
} from '../lib/rss-home';

async function fetchRecentHome(hours = RSS_HOME_HOURS): Promise<RecentHomeResponse> {
  const data = await api.getRssRecentHome(hours);
  return {
    films: data.films || [],
    animations: data.animations || [],
    series: data.series || [],
    anime: data.anime || [],
    hours: data.hours ?? hours,
    tmdbConfigured: data.tmdbConfigured !== false,
  };
}

/** Hook partagé accueil + pages « Voir plus » à télécharger. */
export function useRssRecentHome(hours = RSS_HOME_HOURS) {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: ['rss', 'recent-home', hours],
    queryFn: () => fetchRecentHome(hours),
    enabled: !!token,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
