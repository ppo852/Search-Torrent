import { useState, useEffect } from 'react';
import { Download, RefreshCw, Film, Tv, MonitorPlay, Clapperboard, Folder, Music, Book, ChevronRight, CalendarDays, HardDrive, Users, Rss } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
<<<<<<< HEAD
import { formatSize, formatDate } from '../../lib/formatters';
import { useInteractiveTorrentDownload } from '../../hooks/useInteractiveTorrentDownload';
=======
import { api } from '../../lib/api';
import { formatSize, formatDate } from '../../lib/formatters';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

interface RssFeed {
  id: string;
  feed_name: string;
  feed_url: string;
}

// Interface pour les éléments RSS avec données TMDB optionnelles
interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  category?: string;
  categoryName?: string; // Nouvelle propriété ajoutée par le serveur
  torrent?: string;
  size?: number;
  feedName?: string; // Nom du flux RSS d'origine
  tmdbId?: number; // ID TMDB extrait de tmdb.tmdb_id
  tmdbType?: 'movie' | 'tv'; // Type de média TMDB (film ou série)
  tmdbPoster?: string | null; // URL de l'affiche TMDB formatée
  torznab_attr?: {
    seeders?: number;
    peers?: number;
    grabs?: number;
    downloadvolumefactor?: number;
    uploadvolumefactor?: number;
  };
  tmdb?: {
    tmdb_id: number;
    media_type: string;
    title: string;
    overview: string;
    poster_path: string;
    poster_url: string;
    backdrop_path: string;
    backdrop_url: string;
    release_date: string;
    vote_average: number;
  } | null;
}

function normalizeTmdbType(value: unknown): 'movie' | 'tv' | undefined {
  const raw = String(value || '').toLowerCase();
  const t = raw === 'anime' ? 'tv' : raw;
  if (t === 'movie' || t === 'tv') return t;
  return undefined;
}

function applyTmdbFields(item: RssItem): Pick<RssItem, 'tmdbId' | 'tmdbType' | 'tmdbPoster'> {
  const out: Pick<RssItem, 'tmdbId' | 'tmdbType' | 'tmdbPoster'> = {};

  const existingTmdbId = Number(item.tmdbId);
  const existingTmdbType = normalizeTmdbType(item.tmdbType);
  const existingPoster = item.tmdbPoster;

  if (Number.isFinite(existingTmdbId)) out.tmdbId = existingTmdbId;
  if (existingTmdbType) out.tmdbType = existingTmdbType;
  if (existingPoster) out.tmdbPoster = existingPoster;

  if (item.tmdb) {
    const tmdbIdNum = Number(item.tmdb.tmdb_id);
    if (Number.isFinite(tmdbIdNum)) out.tmdbId = tmdbIdNum;

    const normalizedType = normalizeTmdbType(item.tmdb.media_type);
    if (normalizedType) out.tmdbType = normalizedType;

    if (typeof item.tmdb.poster_url === 'string' && item.tmdb.poster_url.trim().length > 0) {
      out.tmdbPoster = item.tmdb.poster_url;
    } else if (item.tmdb.poster_path) {
      out.tmdbPoster = `https://image.tmdb.org/t/p/w200${item.tmdb.poster_path}`;
    }
  }

  return out;
}

function normalizeTmdbType(value: unknown): 'movie' | 'tv' | undefined {
  const raw = String(value || '').toLowerCase();
  const t = raw === 'anime' ? 'tv' : raw;
  if (t === 'movie' || t === 'tv') return t;
  return undefined;
}

function applyTmdbFields(item: RssItem): Pick<RssItem, 'tmdbId' | 'tmdbType' | 'tmdbPoster'> {
  const out: Pick<RssItem, 'tmdbId' | 'tmdbType' | 'tmdbPoster'> = {};

  const existingTmdbId = Number(item.tmdbId);
  const existingTmdbType = normalizeTmdbType(item.tmdbType);
  const existingPoster = item.tmdbPoster;

  if (Number.isFinite(existingTmdbId)) out.tmdbId = existingTmdbId;
  if (existingTmdbType) out.tmdbType = existingTmdbType;
  if (existingPoster) out.tmdbPoster = existingPoster;

  if (item.tmdb) {
    const tmdbIdNum = Number(item.tmdb.tmdb_id);
    if (Number.isFinite(tmdbIdNum)) out.tmdbId = tmdbIdNum;

    const normalizedType = normalizeTmdbType(item.tmdb.media_type);
    if (normalizedType) out.tmdbType = normalizedType;

    if (typeof item.tmdb.poster_url === 'string' && item.tmdb.poster_url.trim().length > 0) {
      out.tmdbPoster = item.tmdb.poster_url;
    } else if (item.tmdb.poster_path) {
      out.tmdbPoster = `https://image.tmdb.org/t/p/w200${item.tmdb.poster_path}`;
    }
  }

  return out;
}

async function fetchFeeds(token: string): Promise<RssFeed[]> {
  const response = await fetch('/api/rss', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load RSS feeds');
  }

  const feeds = await response.json();
  return feeds;
}

<<<<<<< HEAD
interface AllRssItemsResponse {
  itemsByFeed: Record<string, RssItem[]>;
  tmdbAvailable: boolean;
  fromExpiredCache?: boolean;
}

function processRssItem(item: RssItem): RssItem {
  return {
    ...item,
    ...applyTmdbFields(item),
  };
}

async function fetchAllRssItems(token: string, forceRefresh = false): Promise<Record<string, RssItem[]>> {
  const query = forceRefresh ? '?force_refresh=true' : '';
  const response = await fetch(`/api/rss/all-items${query}`, {
=======
async function fetchFeedItems(feed: RssFeed, token: string): Promise<RssItem[]> {
  const response = await fetch(`/api/rss/parse?url=${encodeURIComponent(feed.feed_url)}`, {
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch RSS items');
  }

<<<<<<< HEAD
  const data: AllRssItemsResponse = await response.json();
  const itemsByFeed: Record<string, RssItem[]> = {};

  for (const [feedId, items] of Object.entries(data.itemsByFeed || {})) {
    itemsByFeed[feedId] = items.map(processRssItem);
  }

  return itemsByFeed;
=======
  // La nouvelle structure inclut items, tmdbAvailable et fromExpiredCache
  const data: RssApiResponse = await response.json();
  
  // Transformer les éléments pour assurer la compatibilité avec le code existant
  const processedItems = data.items.map(item => {
    return {
      ...item,
      ...applyTmdbFields(item),
      feedName: feed.feed_name
    };
  });
  return processedItems;
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
}

interface GroupedItems {
  [category: string]: RssItem[];
}

// Interface pour les props du composant TitleWithPoster
interface TitleWithPosterProps {
  poster: string | null;
  originalTitle: string;
<<<<<<< HEAD
  category?: string;
}

// Composant pour afficher le titre avec une éventuelle affiche TMDB
const TitleWithPoster = ({ poster, originalTitle, category }: TitleWithPosterProps) => {
  const getCategoryIcon = () => {
    switch (category) {
      case 'Films': return <Film className="w-6 h-6 text-blue-400" />;
      case 'Séries TV': return <Tv className="w-6 h-6 text-purple-400" />;
      case 'Anime': return <MonitorPlay className="w-6 h-6 text-pink-400" />;
      case 'Documentaires': return <Clapperboard className="w-6 h-6 text-green-400" />;
      case 'Musique': return <Music className="w-6 h-6 text-yellow-400" />;
      case 'Livres': return <Book className="w-6 h-6 text-orange-400" />;
      default: return <Folder className="w-6 h-6 text-gray-400" />;
    }
  };

=======
}

// Composant pour afficher le titre avec une éventuelle affiche TMDB
const TitleWithPoster = ({ poster, originalTitle }: TitleWithPosterProps) => {
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  return (
    <div className="flex items-center gap-4">
      {poster ? (
        <img 
          src={poster} 
          alt="Affiche" 
          className="w-12 h-16 object-cover rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/10 shrink-0" 
          loading="lazy"
        />
      ) : (
        <div className="w-12 h-16 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
          {getCategoryIcon()}
        </div>
      )}
<<<<<<< HEAD
      <h3 className="font-bold text-white text-sm md:text-base leading-tight line-clamp-2">
=======
      <h3 className="font-medium break-words text-white">
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
        {originalTitle}
      </h3>
    </div>
  );
};

export function RssFeedList() {
  const { token, user } = useAuthStore((state) => ({ token: state.token, user: state.user }));
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<string>('all');
  const queryClient = useQueryClient();

  const { download, confirmModal } = useInteractiveTorrentDownload({
    onSuccess: () => {
      setError(null);
      setShowToast(true);
    },
    onError: (msg) => setError(msg),
  });

  const { data: feeds = [], isLoading: isLoadingFeeds, refetch: refetchFeeds } = useQuery({
    queryKey: ['rss-feeds', token],
    queryFn: () => {
      return token ? fetchFeeds(token) : Promise.resolve([]);
    },
    enabled: !!token && !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false
  });

  const { data: feedItems = {}, isLoading: isLoadingItems } = useQuery({
    queryKey: ['rss-items', token],
    queryFn: async () => {
<<<<<<< HEAD
      if (!token) return {};
      return fetchAllRssItems(token);
=======
      if (!token || feeds.length === 0) return {};
      
      const itemsByFeed: { [feedId: string]: RssItem[] } = {};

      for (const feed of feeds) {
        try {
          // Passer le feed complet pour avoir feed_name
          const feedItems = await fetchFeedItems(feed, token);
          itemsByFeed[feed.id] = feedItems;
        } catch (err) {
          setError(`Erreur lors du chargement des éléments RSS pour ${feed.feed_name}`);
          // Continue avec le prochain flux malgré l'erreur
        }
      }

      return itemsByFeed;
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    },
    enabled: !!token && !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false
  });

  const isLoading = isLoadingFeeds || isLoadingItems;

  const handleRefresh = async () => {
    try {
<<<<<<< HEAD
      if (!token) return;
      const refreshed = await fetchAllRssItems(token, true);
      queryClient.setQueryData(['rss-items', token], refreshed);
      await refetchFeeds();
      setError(null);
=======
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rss-feeds', token] }),
        queryClient.invalidateQueries({ queryKey: ['rss-items', token] })
      ]);
      const refreshedFeeds = await refetchFeeds();
      if (refreshedFeeds.data && refreshedFeeds.data.length > 0) {
        await refetchItems();
      }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du rafraîchissement');
    }
  };

  // Fonction pour obtenir la catégorie à partir de l'élément RSS
  // Utilise la catégorie détectée par le serveur si disponible, sinon utilise le code de catégorie
  const getCategory = (item: RssItem): string => {
    // Traitement spécial pour les documentaires (catégorie 5080)
    if (item.category === '5080') {
      return 'Documentaires';
    }
    
    // Si le serveur a déjà détecté la catégorie, on l'utilise directement
    if (item.categoryName) {
      return item.categoryName;
    }
    
    // Sinon, on utilise la catégorie par défaut
    return 'Autres';
  };

  const handleDownload = async (item: RssItem, currentCategory?: string) => {
<<<<<<< HEAD
    if (!item.link) return;
    const categoryToUse = currentCategory || getCategory(item);
    await download({
      url: item.link,
      name: item.title,
      itemCategory: categoryToUse,
      mediaType: item.tmdbType,
    });
=======
    if (!item.link) {
      // Afficher une notification d'erreur à l'utilisateur ici
    } else {
      try {
        // Utiliser la catégorie courante au lieu de item.category si elle est fournie
        const categoryToUse = currentCategory || getCategory(item);
        
        await api.addTorrentWithCategory(item.link, categoryToUse, item.tmdbType);
        setShowToast(true);
      } catch (error) {
        setError('Erreur lors de l\'ajout du torrent à qBittorrent');
      }
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  };

  useEffect(() => {
    if (showToast) {
      // Masquer le toast après 3 secondes
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Fonction pour obtenir les éléments filtrés et groupés par catégorie
  const getGroupedItems = (): GroupedItems => {
    let allItems: RssItem[] = [];

    // 1. Filtrer par flux sélectionné
    if (selectedFeed !== 'all') {
      allItems = feedItems[selectedFeed] || [];
    } else {
      allItems = (Object.values(feedItems) as RssItem[][]).flat();
    }

    // 2. Grouper par catégorie détectée
    const grouped: GroupedItems = {};
    allItems.forEach(item => {
      // Utiliser la fonction getCategory pour obtenir la catégorie normalisée
      const bestCategory = getCategory(item);
      
      // Ajouter l'élément au groupe correspondant à sa meilleure catégorie
      if (!grouped[bestCategory]) {
        grouped[bestCategory] = [];
      }
      grouped[bestCategory].push(item);
    });

    // 3. Trier les éléments dans chaque catégorie par date (plus récent d'abord)
    for (const category in grouped) {
      grouped[category].sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return grouped;
  };

  // Fonction pour trier les catégories selon un ordre spécifique
  const sortCategories = (categories: string[]): string[] => {
    const categoryOrder: { [key: string]: number } = {
      'Films': 1,
      'Séries TV': 2,
      'Documentaires': 3, // Nouvelle position pour les documentaires
      'Anime': 4,
      'Musique': 5,
      'Sport': 6,
      'Logiciels': 7,
      'Jeux': 8,
      'Livres': 9,
      'Autres': 99
    };
    
    return [...categories].sort((a, b) => {
      const orderA = categoryOrder[a] || 99; // Défaut à 99 (Autres) si non trouvé
      const orderB = categoryOrder[b] || 99;
      return orderA - orderB;
    });
  };

  const groupedItems = getGroupedItems();  // Récupérer les catégories disponibles et les éléments groupés
  const categories = sortCategories(Object.keys(groupedItems));
  const hasItemsToShow = categories.length > 0;
  
  // Fonction pour obtenir la classe CSS du conteneur principal des catégories
  const getContainerClassName = (): string => {
    return "space-y-6 mt-8";
  };
  
  // Fonction pour obtenir la classe CSS des éléments individuels
  const getItemClassName = (): string => {
    return "flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 p-4 hover:bg-white/[0.02] transition-all border-b border-white/5 last:border-0 group";
  };

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-500/20 text-green-400 border border-green-500/20 px-6 py-3 rounded-2xl shadow-2xl shadow-green-500/10 font-black tracking-widest uppercase text-xs animate-fade-in z-50 backdrop-blur-md">
          Transfert initié
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 left-4 bg-red-500/20 text-red-400 border border-red-500/20 px-6 py-3 rounded-2xl shadow-2xl shadow-red-500/10 font-black tracking-widest uppercase text-xs animate-fade-in z-50 backdrop-blur-md">
          {error}
        </div>
      )}
      {confirmModal}

      {/* Barre de contrôles */}
<<<<<<< HEAD
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 glass-card border-white/5 shadow-2xl">
        <div className="w-full sm:w-auto flex items-center gap-3">
          <Rss className="text-orange-500 h-5 w-5" />
=======
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 p-4 bg-gray-800 rounded-lg shadow">
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <label htmlFor="feed-select" className="text-sm font-medium text-gray-300">Flux RSS : Dernier Sortie sur les Trackers</label>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
          <select
            id="feed-select"
            value={selectedFeed}
            onChange={(e) => setSelectedFeed(e.target.value)}
            className="w-full sm:w-auto bg-black/40 text-white px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-blue-500/50 text-xs font-black uppercase tracking-widest appearance-none cursor-pointer"
          >
<<<<<<< HEAD
            <option value="all">Tous les réseaux</option>
=======
            <option value="all">Tous les flux</option>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
            {feeds.map((feed: RssFeed) => (
              <option key={feed.id} value={feed.id}>
                {feed.feed_name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg ${
            isLoading
              ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
              : 'bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 hover:scale-[1.02] shadow-blue-500/10'
          }`}
          title="Rafraîchir les flux"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>{isLoading ? 'Synchro...' : 'Rafraîchir'}</span>
        </button>
      </div>

      {/* Affichage des catégories */}
      {!isLoading && !hasItemsToShow && (
           <div className="glass-card py-20 text-center border-white/5">
               <p className="text-gray-500 font-black uppercase text-xs tracking-widest opacity-50">Aucun signal détecté sur ces fréquences</p>
           </div>
      )}

      {hasItemsToShow && (
        <div className={getContainerClassName()}>
          {categories.map((category) => (
            groupedItems[category].length > 0 && (
              <details key={category} className="glass-card overflow-hidden group/accordion border-white/5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="px-6 py-5 font-black text-sm uppercase tracking-widest text-white cursor-pointer hover:bg-white/5 transition-all flex justify-between items-center list-none border-b border-transparent group-open/accordion:border-white/5 group-open/accordion:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{category}</span>
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md text-[10px]">{groupedItems[category].length}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-500 group-open/accordion:rotate-90 transform transition-transform duration-300" />
                </summary>
<<<<<<< HEAD
                <div className="flex flex-col bg-black/20">
                  {groupedItems[category].map((item, index) => (
                    <div key={`${item.link}-${index}`} className={getItemClassName()}>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <TitleWithPoster
                          poster={item.tmdbPoster ?? null}
                          originalTitle={item.title}
                          category={category}
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 ml-0 md:ml-[64px]">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 text-gray-400 rounded-md text-[10px] font-black border border-white/10 uppercase tracking-widest">
                            <CalendarDays size={10} />
                            {formatDate(item.pubDate)}
                          </div>
                          {item.size ? (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-md text-[10px] font-black border border-amber-500/20 uppercase tracking-widest">
                              <HardDrive size={10} />
                              {formatSize(item.size)}
                            </div>
                          ) : null}
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded-md text-[10px] font-black border border-orange-500/20 uppercase tracking-widest">
                            <Rss size={10} />
                            {item.feedName}
                          </div>
=======
                <div className="p-4 space-y-3 border-t border-gray-700/50">
                  {groupedItems[category].map((item, index) => (
                    <div key={`${item.link}-${index}`} className={getItemClassName()}>
                      <div className="flex-1 min-w-0">
                        <TitleWithPoster
                          poster={item.tmdbPoster ?? null}
                          originalTitle={item.title}
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mt-2">
                          <span>{formatDate(item.pubDate)}</span>
                          <span className="text-orange-400">💾 {formatSize(item.size ?? 0)}</span>
                          <span className="text-purple-400">📰 {item.feedName}</span>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                          {item.torznab_attr?.seeders !== undefined && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded-md text-[10px] font-black border border-green-500/20 uppercase tracking-widest">
                              <Users size={10} />
                              {item.torznab_attr.seeders} <span className="opacity-50">S</span>
                            </div>
                          )}
<<<<<<< HEAD
                          {item.torznab_attr?.peers !== undefined && (item.torznab_attr.peers - (item.torznab_attr.seeders || 0)) > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded-md text-[10px] font-black border border-red-500/20 uppercase tracking-widest">
                              <Download size={10} />
                              {item.torznab_attr.peers - (item.torznab_attr.seeders || 0)} <span className="opacity-50">L</span>
                            </div>
=======
                          {item.torznab_attr?.peers !== undefined &&
                            (item.torznab_attr.peers - (item.torznab_attr.seeders || 0)) > 0 && (
                              <span className="text-red-500">
                                ▼ {item.torznab_attr.peers - (item.torznab_attr.seeders || 0)}
                              </span>
                            )}
                          {item.torznab_attr?.grabs !== undefined && (
                            <span className="text-blue-400">⭐ {item.torznab_attr.grabs}</span>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                          )}
                        </div>
                      </div>

<<<<<<< HEAD
                      <div className="flex items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0 pl-0 md:pl-[64px] xl:pl-0">
=======
                      <div className="flex flex-row md:flex-col justify-end items-stretch md:items-start gap-2 mt-3 md:mt-0">
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                        {Number.isFinite(item.tmdbId) && item.tmdbType ? (
                          <a
                            href={`https://www.themoviedb.org/${item.tmdbType}/${item.tmdbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
<<<<<<< HEAD
                            className="flex items-center justify-center px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all"
                            title="Voir sur TMDB"
                          >
                            TMDB
                          </a>
                        ) : (
                          <span
                            className="flex items-center justify-center px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/5 text-gray-600 rounded-xl cursor-not-allowed"
                            title="TMDB non disponible"
                          >
                            TMDB
                          </span>
=======
                            className="flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-2 md:py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors shrink-0"
                            title="Voir sur TMDB"
                          >
                            <span>TMDB</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-2 md:py-1 text-sm bg-gray-600 text-gray-400 rounded-md cursor-not-allowed shrink-0"
                            title="TMDB non disponible"
                          >
                            <span>TMDB</span>
                          </button>
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                        )}

                        <button
                          onClick={() => handleDownload(item, category)}
<<<<<<< HEAD
                          className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest premium-gradient text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all"
                          title="Télécharger le torrent"
                        >
                          <Download size={14} />
=======
                          className="flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-2 md:py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shrink-0"
                          title="Télécharger le torrent"
                        >
                          <Download size={16} />
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
                          <span>Télécharger</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )
          ))}
        </div>
      )}
    </div>
  );
}
