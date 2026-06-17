import { useState, useEffect } from 'react';
import { Plus, Trash2, Database, RefreshCw, Clock, Globe, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ConfirmModal } from '../ui/ConfirmModal';

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

interface CacheSummarySection {
  totalEntries: number;
  expiredEntries: number;
  approximateSizeBytes: number;
}

interface CacheSummary {
  rss: CacheSummarySection;
  tmdb: CacheSummarySection;
  tmdbTvShow: CacheSummarySection;
  appCache: CacheSummarySection;
}

interface CacheStatsResponse {
  summary: CacheSummary;
  feeds: RssFeed[];
}

interface AdminRssFeedManagerProps {
  user?: User | null;
}

const CACHE_SUMMARY_ROWS: Array<{ key: keyof CacheSummary; label: string }> = [
  { key: 'rss', label: 'Flux RSS' },
  { key: 'tmdb', label: 'TMDB titres' },
  { key: 'tmdbTvShow', label: 'TMDB shows' },
  { key: 'appCache', label: 'Accueil + tendances' },
];

function formatCacheSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function AdminRssFeedManager({ user: propUser }: AdminRssFeedManagerProps) {
  const storeUser = useAuthStore((state) => state.user);
  const user = propUser || storeUser;
  
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [newFeed, setNewFeed] = useState({ feed_name: '', feed_url: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (user) loadFeeds();
  }, [user]);

  const loadCacheStatus = async () => {
    if (!user?.is_admin) return;
    try {
      const response = await fetch('/api/rss/cache/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data: CacheStatsResponse = await response.json();
        setCacheSummary(data.summary);
        setFeeds(data.feeds);
      }
    } catch (err) {}
  };

  const loadFeeds = async () => {
    try {
      const response = await fetch('/api/rss', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Échec du chargement');
      const data = await response.json();
      setFeeds(data);
      if (user?.is_admin) loadCacheStatus();
    } catch (err) {
      setError('Erreur de synchronisation des flux');
    }
  };

  const handleAddFeed = async () => {
    if (!newFeed.feed_name || !newFeed.feed_url) {
      setError('Champs requis manquants');
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
      if (!response.ok) throw new Error('Échec de l\'ajout');
      setNewFeed({ feed_name: '', feed_url: '' });
      setSuccess('Nouveau flux enregistré');
      loadFeeds();
    } catch (err) {
      setError('Erreur lors de l\'enregistrement');
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [feedToDelete, setFeedToDelete] = useState<string | null>(null);

  const handleDeleteClick = (feedId: string) => {
    setFeedToDelete(feedId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!feedToDelete) return;
    try {
      const response = await fetch(`/api/rss/${feedToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Échec de suppression');
      setSuccess('Flux supprimé');
      loadFeeds();
    } catch (err) {
      setError('Erreur de suppression');
    } finally {
      setFeedToDelete(null);
    }
  };

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
        body: JSON.stringify({ action: 'refresh', type: 'rss', feedId: feedId })
      });
      if (!response.ok) throw new Error('Rafraîchissement échoué');
      setSuccess('Cache rafraîchi');
      loadCacheStatus();
    } catch (err) {
      setError('Erreur de rafraîchissement');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async (type: 'rss' | 'tmdb' | 'all') => {
    try {
      setError('');
      const response = await fetch('/api/rss/cache/manage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'clear', type: type })
      });
      if (!response.ok) throw new Error('Échec du nettoyage');
      setSuccess('Cache système nettoyé');
      loadCacheStatus();
    } catch (err) {
      setError('Erreur lors du nettoyage');
    }
  };

  if (!user) return null;

  return (
    <div className="animate-premium-fade space-y-10 p-2">
      {(error || success) && (
        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${error ? 'bg-red-600/10 border-red-600/20 text-red-400' : 'bg-green-600/10 border-green-600/20 text-green-400'}`}>
           <ShieldAlert size={18} />
           <span className="text-[10px] font-black uppercase tracking-widest">{error || success}</span>
        </div>
      )}

      {user.is_admin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
               <Database className="text-indigo-500" size={20} /> Entretien Système
            </h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleClearCache('rss')} className="px-4 py-2.5 bg-indigo-600/10 border border-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Nettoyer RSS</button>
              <button onClick={() => handleClearCache('tmdb')} className="px-4 py-2.5 bg-purple-600/10 border border-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Nettoyer TMDB</button>
              <button onClick={() => handleClearCache('all')} className="px-4 py-2.5 bg-red-600/10 border border-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Tout Purger</button>
            </div>

            {cacheSummary && (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-[10px] font-bold uppercase tracking-widest">
                  <thead>
                    <tr className="bg-white/5 text-gray-500">
                      <th className="px-4 py-3">Cache</th>
                      <th className="px-4 py-3">Entrées</th>
                      <th className="px-4 py-3">Expirées</th>
                      <th className="px-4 py-3">Taille</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CACHE_SUMMARY_ROWS.map(({ key, label }) => {
                      const section = cacheSummary[key];
                      return (
                        <tr key={key} className="border-t border-white/5 text-gray-300">
                          <td className="px-4 py-3 text-white">{label}</td>
                          <td className="px-4 py-3">{section.totalEntries}</td>
                          <td className="px-4 py-3">{section.expiredEntries}</td>
                          <td className="px-4 py-3">{formatCacheSize(section.approximateSizeBytes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
               <Plus className="text-blue-500" size={20} /> Nouveau Canal
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="NOM DU FLUX" value={newFeed.feed_name} onChange={(e) => setNewFeed({ ...newFeed, feed_name: e.target.value })} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/40" />
              <input type="text" placeholder="URL DU CANAL" value={newFeed.feed_url} onChange={(e) => setNewFeed({ ...newFeed, feed_url: e.target.value })} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500/40" />
              <button onClick={handleAddFeed} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all">AJOUTER</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {feeds.map((feed) => (
          <div key={feed.id} className="glass-card p-6 group hover:border-white/20 transition-all duration-500">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div className="space-y-3 min-w-0">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500"><Globe size={20} /></div>
                   <div className="min-w-0">
                      <h4 className="text-lg font-black text-white uppercase tracking-tighter truncate">{feed.feed_name}</h4>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest truncate">{feed.feed_url}</p>
                   </div>
                </div>
                
                {feed.cache && (
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${feed.cache.isFresh ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <Clock size={12} />
                    <span>{feed.cache.isFresh ? 'Signal Frais' : 'Signal Expiré'}</span>
                    <span className="opacity-40">•</span>
                    <span>MAJ: {new Date(feed.cache.lastUpdated).toLocaleString()}</span>
                  </div>
                )}
                {!feed.cache && user.is_admin && (
                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-widest">
                      <Clock size={12} />
                      <span>Aucune empreinte de cache</span>
                   </div>
                )}
              </div>
              
              {user.is_admin && (
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button onClick={() => handleRefreshFeed(feed.id)} disabled={loading} className="p-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-lg" title="Rafraîchir">
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => handleDeleteClick(feed.id)} className="p-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg" title="Révoquer">
                    <Trash2 size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {feeds.length === 0 && (
          <div className="py-20 text-center glass-card border-dashed border-white/10">
             <Globe size={40} className="mx-auto text-gray-700 mb-4 opacity-20" />
             <p className="text-gray-600 font-black uppercase text-xs tracking-[0.3em]">Aucun flux détecté</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Supprimer le flux ?"
        message="Cette action est irréversible. Les données déjà indexées resteront en cache jusqu'à leur expiration naturelle."
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
