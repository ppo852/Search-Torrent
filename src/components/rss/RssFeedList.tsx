// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useState, useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { tmdbAPI } from '../../lib/tmdb';
import { api } from '../../lib/api';
import { formatSize, formatDate, formatTitle } from '../../lib/formatters';

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

// Interface pour la réponse API avec statut TMDB
interface RssApiResponse {
  items: RssItem[];
  tmdbAvailable: boolean;
  fromExpiredCache?: boolean;
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
  "// [DEBUG ONLY] console.log(`DEBUG - Nombre total de flux RSS récupérés: ${feeds.length}`);"
  return feeds;
}

async function fetchFeedItems(feed: RssFeed, token: string): Promise<RssItem[]> {
  "// [DEBUG ONLY] console.log(`Fetching items for feed: ${feed.feed_name}`);"
  const response = await fetch(`/api/rss/parse?url=${encodeURIComponent(feed.feed_url)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Failed to fetch RSS feed items');
  }

  // La nouvelle structure inclut items, tmdbAvailable et fromExpiredCache
  const data: RssApiResponse = await response.json();
  // [DEBUG ONLY] console.log(`TMDB data available for ${feed.feed_name}: ${data.tmdbAvailable ? 'Yes' : 'No'}`);
  
  // Si fromExpiredCache est true, on le mentionne dans les logs
  if (data.fromExpiredCache) {
    "// [DEBUG ONLY] console.log(`Warning: Using expired cache for ${feed.feed_name}`);"
  }
  
  // Transformer les éléments pour assurer la compatibilité avec le code existant
  const processedItems = data.items.map(item => {
    const processedItem: RssItem = {
      ...item,
      feedName: feed.feed_name // Ajouter le nom du flux
    };
    
    // Si les données TMDB sont disponibles, extraire les infos pertinentes
    if (data.tmdbAvailable && item.tmdb) {
      processedItem.tmdbId = item.tmdb.tmdb_id;
      processedItem.tmdbType = item.tmdb.media_type as 'movie' | 'tv';
      processedItem.tmdbPoster = item.tmdb.poster_path ? 
        `https://image.tmdb.org/t/p/w200${item.tmdb.poster_path}` : null;
    } else {
      // Sinon, définir les valeurs par défaut pour éviter les erreurs
      processedItem.tmdbId = undefined;
      processedItem.tmdbType = undefined;
      processedItem.tmdbPoster = null;
    }
    
    return processedItem;
  });

  "// [DEBUG ONLY] console.log(`Items processed for ${feed.feed_name}:`, processedItems.length);"
  return processedItems;
}

interface GroupedItems {
  [category: string]: RssItem[];
}

// Interface pour les props du composant TitleWithPoster
interface TitleWithPosterProps {
  poster: string | null;
  originalTitle: string;
  tmdbAvailable: boolean;
}

// Composant pour afficher le titre avec une éventuelle affiche TMDB
const TitleWithPoster = ({ poster, originalTitle, tmdbAvailable }: TitleWithPosterProps) => {
  const formattedTitle = formatTitle(originalTitle);
  
  return (
    <div className="flex items-center gap-3">
      {poster ? (
        <img 
          src={poster} 
          alt="Affiche" 
          className="w-12 h-16 object-cover rounded-md shadow-md" 
          loading="lazy"
        />
      ) : (
        <div className="w-12 h-16 bg-gray-700 rounded-md flex items-center justify-center text-gray-500">
          <span>?</span>
        </div>
      )}
      <h3 className={`font-medium break-words ${tmdbAvailable ? 'text-blue-300' : 'text-white'}`}>
        {formattedTitle}
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

  const { data: feeds = [], isLoading: isLoadingFeeds, refetch: refetchFeeds } = useQuery({
    queryKey: ['rss-feeds', token],
    queryFn: () => {
      "// [DEBUG ONLY] console.log('Chargement des flux RSS...');"
      return token ? fetchFeeds(token) : Promise.resolve([]);
    },
    enabled: !!token && !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false
  });

  const { data: feedItems = {}, isLoading: isLoadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['rss-items', token],
    queryFn: async () => {
      "// [DEBUG ONLY] console.log('Chargement des éléments RSS...');"
      if (!token || feeds.length === 0) return {};
      
      const itemsByFeed: { [feedId: string]: RssItem[] } = {};
      // Statut global de la disponibilité TMDB, accessible dans le composant
      let tmdbGloballyAvailable = true;

      for (const feed of feeds) {
        try {
          // Passer le feed complet pour avoir feed_name
          const feedItems = await fetchFeedItems(feed, token);
          itemsByFeed[feed.id] = feedItems;
          
          // Vérifier si au moins quelques items ont des données TMDB
          const hasTmdbData = feedItems.some(item => item.tmdbId !== undefined && item.tmdbPoster !== null);
          if (!hasTmdbData) {
            tmdbGloballyAvailable = false;
            "// [DEBUG ONLY] console.log(`Aucune donnée TMDB disponible pour ${feed.feed_name}`);"
          }
          
          "// [DEBUG ONLY] console.log(`${feedItems.length} items chargés pour ${feed.feed_name}`);"
        } catch (err) {
          "// [DEBUG ONLY] console.error(`Error fetching items for ${feed.feed_name}:`, err);"
          setError(`Erreur lors du chargement des éléments RSS pour ${feed.feed_name}`);
          tmdbGloballyAvailable = false; // En cas d'erreur, TMDB est considéré comme indisponible
          // Continue avec le prochain flux malgré l'erreur
        }
      }

      return itemsByFeed;
    },
    enabled: !!token && feeds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false
  });

  const isLoading = isLoadingFeeds || isLoadingItems;

  const handleRefresh = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rss-feeds', token] }),
        queryClient.invalidateQueries({ queryKey: ['rss-items', token] })
      ]);
      const refreshedFeeds = await refetchFeeds();
      if (refreshedFeeds.data && refreshedFeeds.data.length > 0) {
        await refetchItems();
      }
    } catch (error) {
      "// [DEBUG ONLY] console.error('Erreur lors du rafraîchissement:', error);"
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
      // [DEBUG ONLY] console.log(`Item "${item.title.substring(0, 30)}..." a la catégorie: ${item.categoryName}`);
      return item.categoryName;
    }
    
    // Sinon, on utilise la catégorie par défaut
    // [DEBUG ONLY] console.log(`Item "${item.title.substring(0, 30)}..." n'a pas de catégorie, classé dans: Autres`);
    return 'Autres';
  };

  const handleDownload = async (item: RssItem, currentCategory?: string) => {
    if (!item.link) {
      "// [DEBUG ONLY] console.error('Download link is missing for item:', item.title);"
      // Afficher une notification d'erreur à l'utilisateur ici
    } else {
      try {
        // Utiliser la catégorie courante au lieu de item.category si elle est fournie
        const categoryToUse = currentCategory || getCategory(item);
        "// [DEBUG ONLY] console.log(`Téléchargement avec catégorie: ${categoryToUse}`);"
        
        await api.addTorrentWithCategory(item.link, categoryToUse, item.tmdbType);
        setShowToast(true);
      } catch (error) {
        "// [DEBUG ONLY] console.error('Error adding torrent:', error);"
        setError('Erreur lors de l\'ajout du torrent à qBittorrent');
      }
    }
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
      "// [DEBUG ONLY] console.log(`DEBUG - Filtre actif, flux sélectionné: ${selectedFeed}`);"
      allItems = feedItems[selectedFeed] || [];
    } else {
      "// [DEBUG ONLY] console.log(`DEBUG - Pas de filtre, affichage de tous les flux`);"
      allItems = Object.values(feedItems).flat();
    }
    
    "// [DEBUG ONLY] console.log(`DEBUG - Nombre total d'éléments RSS: ${allItems.length}`);"

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
      // [DEBUG ONLY] console.log(`DEBUG - Catégorie '${category}': ${grouped[category].length} éléments`);
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
    return "space-y-4 mt-4";
  };
  
  // Fonction pour obtenir la classe CSS des éléments individuels
  const getItemClassName = (): string => {
    return "flex flex-col md:flex-row justify-between items-start gap-4 p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors";
  };

  return (
    <div className="space-y-6 p-4"> {/* Ajout padding global */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          Torrent ajouté à qBittorrent!
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {error}
        </div>
      )}

      {/* Barre de contrôles */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 p-4 bg-gray-800 rounded-lg shadow">
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <label htmlFor="feed-select" className="text-sm font-medium text-gray-300">Flux RSS:</label>
          <select
            id="feed-select"
            value={selectedFeed}
            onChange={(e) => setSelectedFeed(e.target.value)}
            className="w-full sm:w-auto bg-gray-700 text-white px-3 py-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">Tous les flux</option>
            {feeds.map(feed => (
              <option key={feed.id} value={feed.id}>
                {feed.feed_name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={`w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isLoading
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title="Rafraîchir les flux"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>{isLoading ? 'Rafraîchissement...' : 'Rafraîchir'}</span>
        </button>
      </div>

      {/* Affichage des catégories */}
      {!isLoading && !hasItemsToShow && (
           <div className="text-center text-gray-400 py-8">
               Aucun élément trouvé pour les filtres actuels ou dans les flux.
           </div>
      )}

      {hasItemsToShow && (
        <div className={getContainerClassName()}>
          {categories.map((category) => (
            groupedItems[category].length > 0 && ( // N'affiche la catégorie que si elle contient des éléments
              <details key={category} className="bg-gray-800/40 rounded-lg overflow-hidden group"> {/* Supprimé 'open' pour replier par défaut */}
                <summary className="px-4 py-3 font-semibold text-lg text-white cursor-pointer hover:bg-gray-700/50 transition-colors flex justify-between items-center list-none">
                  <span>{category} ({groupedItems[category].length})</span>
                   <span className="text-gray-400 group-open:rotate-90 transform transition-transform duration-200">{">"}</span>
                </summary>
                <div className="p-4 space-y-3 border-t border-gray-700/50"> {/* Ajout padding et space-y interne */}
                  {groupedItems[category].map((item, index) => (
                    <div key={`${item.link}-${index}`} className={getItemClassName()}>
                       {/* Colonne Gauche: Infos et Titre */}
                      <div className="flex-1 min-w-0">
                        <TitleWithPoster
                          poster={item.tmdbPoster} // Utilise la propriété mise à jour
                          originalTitle={item.title}
                          tmdbAvailable={!!item.tmdbId} // Indique si les données TMDB sont disponibles pour cet item
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mt-2">
                          <span>
                        {formatDate(item.pubDate)}
                      </span>
                          <span className="text-orange-400">💾 {formatSize(item.size)}</span>
                          <span className="text-purple-400">📰 {item.feedName}</span>
                          {item.torznab_attr?.seeders !== undefined && (
                            <span className="text-green-500">▲ {item.torznab_attr.seeders}</span>
                          )}
                          {item.torznab_attr?.peers !== undefined && (item.torznab_attr.peers - (item.torznab_attr.seeders || 0)) > 0 && (
                             <span className="text-red-500">▼ {item.torznab_attr.peers - (item.torznab_attr.seeders || 0)}</span>
                          )}
                           {item.torznab_attr?.grabs !== undefined && (
                              <span className="text-blue-400">⭐ {item.torznab_attr.grabs}</span>
                           )}
                        </div>
                      </div>
                       {/* Colonne Droite: Boutons */}
                       <div className="flex flex-row md:flex-col justify-end items-stretch md:items-start gap-2 mt-3 md:mt-0">
                         {/* Bouton TMDB (Conditionnel) */}
                         {item.tmdbId && item.tmdbType ? (
                           <a
                             href={`https://www.themoviedb.org/${item.tmdbType}/${item.tmdbId}`}
                             target="_blank"
                             rel="noopener noreferrer"
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
                         )}
                         {/* Bouton Télécharger */}
                          <button
                           onClick={() => handleDownload(item, category)}
                           className="flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-2 md:py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shrink-0"
                           title="Télécharger le torrent"
                         >
                           <Download size={16} />
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

       {/* Supprimé: Contrôles de pagination */}
    </div>
  );
}
