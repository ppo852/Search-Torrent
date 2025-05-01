import { useState, useEffect } from 'react';
import { Plus, Trash2, Database, RefreshCw, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface CacheInfo {
  lastUpdated: string;
  expiresAt: string;
  isFresh: boolean;
}

interface RssFeed {
  id: string;
  feed_name: string;
  feed_url: string;
  created_at: string;
  cache?: CacheInfo | null;
}

interface User {
  id: string;
  username: string;
  is_admin: boolean;
}

interface AdminRssFeedManagerProps {
  user: User;
}

export function AdminRssFeedManager({ user }: AdminRssFeedManagerProps) {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [newFeed, setNewFeed] = useState({ feed_name: '', feed_url: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    loadFeeds();
  }, []);

  // Charger les informations de cache pour tous les flux RSS
  const loadCacheStatus = async () => {
    if (!user.is_admin) return;
    
    try {
      const response = await fetch('/api/rss/cache/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des informations de cache');
      }

      const feedsWithCache = await response.json();
      setFeeds(feedsWithCache); 
    } catch (err) {
      "// [DEBUG ONLY] console.error('Error loading cache status:', err);"
      // Ne pas afficher d'erreur pour ne pas perturber l'utilisation normale
    }
  };

  const loadFeeds = async () => {
    try {
      const response = await fetch('/api/rss', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des flux RSS');
      }

      const data = await response.json();
      setFeeds(data);
      
      // Charger les informations de cache après avoir chargé les flux
      if (user.is_admin) {
        loadCacheStatus();
      }
    } catch (err) {
      "// [DEBUG ONLY] console.error('Error loading RSS feeds:', err);"
      setError('Erreur lors du chargement des flux RSS');
    }
  };

  const handleAddFeed = async () => {
    if (!newFeed.feed_name || !newFeed.feed_url) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newFeed),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'ajout du flux RSS');
      }

      setNewFeed({ feed_name: '', feed_url: '' });
      setSuccess('Flux RSS ajouté avec succès');
      loadFeeds();
    } catch (err) {
      "// [DEBUG ONLY] console.error('Error adding RSS feed:', err);"
      setError('Erreur lors de l\'ajout du flux RSS');
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    try {
      const response = await fetch(`/api/rss/${feedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression du flux RSS');
      }

      setSuccess('Flux RSS supprimé avec succès');
      loadFeeds();
    } catch (err) {
      "// [DEBUG ONLY] console.error('Error deleting RSS feed:', err);"
      setError('Erreur lors de la suppression du flux RSS');
    }
  };

  // Rafraîchir le cache d'un flux spécifique
  const handleRefreshFeed = async (feedId: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/rss/cache/manage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'refresh',
          type: 'rss',
          feedId: feedId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du rafraîchissement du cache');
      }

      const data = await response.json();
      setSuccess(data.message || 'Cache rafraîchi avec succès');
      
      // Recharger les informations de cache
      loadCacheStatus();
    } catch (err) {
      "// [DEBUG ONLY] console.error('Error refreshing cache:', err);"
      setError(err instanceof Error ? err.message : 'Erreur lors du rafraîchissement du cache');
    } finally {
      setLoading(false);
    }
  };

  // Fonctions de gestion des caches
  const handleClearCache = async (type: 'rss' | 'tmdb' | 'all') => {
    try {
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/rss/cache/manage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'clear',
          type: type
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du vidage du cache');
      }

      const data = await response.json();
      setSuccess(data.message || 'Cache vidé avec succès');
      
      // Recharger les informations de cache après avoir vidé les caches
      loadCacheStatus();
    } catch (err) {
      "// [DEBUG ONLY] console.error('Error clearing cache:', err);"
      setError(err instanceof Error ? err.message : 'Erreur lors du vidage du cache');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500 text-white p-2 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500 text-white p-2 rounded">
          {success}
        </div>
      )}

      {user.is_admin && (
        <>
          <div className="bg-gray-800 p-4 rounded-lg space-y-4 mb-4">
            <h3 className="text-lg font-semibold text-white">Gestion des caches</h3>
            <div className="flex flex-wrap gap-3 justify-start">
              <button
                onClick={() => handleClearCache('rss')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm flex items-center gap-2"
              >
                <Database size={16} />
                Vider tous les caches RSS
              </button>
              <button
                onClick={() => handleClearCache('tmdb')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm flex items-center gap-2"
              >
                <Database size={16} />
                Vider le cache TMDB
              </button>
              <button
                onClick={() => handleClearCache('all')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm flex items-center gap-2"
              >
                <Database size={16} />
                Vider tous les caches
              </button>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold text-white">Ajouter un flux RSS</h3>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Nom du flux"
              value={newFeed.feed_name}
              onChange={(e) => setNewFeed({ ...newFeed, feed_name: e.target.value })}
              className="flex-1 bg-gray-700 text-white p-2 rounded"
            />
            <input
              type="text"
              placeholder="URL du flux"
              value={newFeed.feed_url}
              onChange={(e) => setNewFeed({ ...newFeed, feed_url: e.target.value })}
              className="flex-1 bg-gray-700 text-white p-2 rounded"
            />
            <button
              onClick={handleAddFeed}
              className="bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-600"
            >
              <Plus size={20} />
              Ajouter
            </button>
          </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        {feeds.map((feed) => (
          <div
            key={feed.id}
            className="bg-gray-800 p-4 rounded-lg"
          >
            <div className="flex justify-between">
              <div>
                <h4 className="text-lg font-medium text-white">{feed.feed_name}</h4>
                <p className="text-gray-400">{feed.feed_url}</p>
                {feed.cache && (
                  <div className="mt-1 flex items-center gap-1">
                    <Clock size={14} className={feed.cache.isFresh ? 'text-green-400' : 'text-yellow-400'} />
                    <p className={`text-sm ${feed.cache.isFresh ? 'text-green-400' : 'text-yellow-400'}`}>
                      {feed.cache.isFresh ? 'À jour' : 'Expiré'} - 
                      Dernière mise à jour: {new Date(feed.cache.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                )}
                {!feed.cache && user.is_admin && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Clock size={14} className="text-gray-500" />
                    Aucune donnée en cache
                  </p>
                )}
              </div>
              {user.is_admin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRefreshFeed(feed.id)}
                    className="text-blue-500 hover:text-blue-600"
                    disabled={loading}
                    title="Rafraîchir le cache de ce flux"
                  >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleDeleteFeed(feed.id)}
                    className="text-red-500 hover:text-red-600"
                    title="Supprimer ce flux"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
