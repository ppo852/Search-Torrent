import React, { useState, useEffect } from 'react';
<<<<<<< HEAD
import { api } from '../services/api';
=======
import { useAuthStore } from '../stores/authStore';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
import { useSearchStore } from '../stores/searchStore';
import { SearchBar } from '../components/ui/SearchBar';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import { RssFeedList } from '../components/rss/RssFeedList';
import { MediaGrid } from '../components/ui/MediaGrid';
import { Toast } from '../components/core/Toast';
import type { SearchResult, SortOption, CategoryType } from '../types';
<<<<<<< HEAD
import { tmdbAPI } from '../services/tmdb/tmdb';
import { globalSettings } from '../services/settings';
import { Search, Rss, ChevronRight, ChevronLeft } from 'lucide-react';
import { useInteractiveTorrentDownload } from '../hooks/useInteractiveTorrentDownload';
=======
import { tmdbAPI } from '../lib/tmdb';
import { globalSettings } from '../lib/settings';
import { api } from '../lib/api';
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed

export function NewTorrentPage() {
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
<<<<<<< HEAD
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const { results, isLoading, error, lastSearchCategory, tmdbResults, setResults, setIsLoading, setError, setLastSearchCategory, setTmdbResults, setLastSearchQuery } = useSearchStore();

  const { download, confirmModal } = useInteractiveTorrentDownload({
    onSuccess: (msg) => setToastMessage(msg),
    onError: (msg) => setToastMessage(msg),
  });

  useEffect(() => {
    const loadSettings = async () => {
      try { await globalSettings.load(); } catch (err) { setError('Échec de synchronisation'); }
=======
  const [settings, setSettings] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Utiliser les résultats TMDB depuis le store global
  const itemsPerPage = 25;
  const user = useAuthStore((state) => state.user);
  const { results, isLoading, error, lastSearchCategory, tmdbResults, setResults, setIsLoading, setError, setLastSearchCategory, setTmdbResults, setLastSearchQuery } = useSearchStore();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await globalSettings.load();
        setSettings(globalSettings);
      } catch (err) {
        // [DEBUG ONLY] console.error('Failed to load global settings:', err);
        setError('Erreur lors du chargement des paramètres. Contactez votre administrateur.');
      }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    };
    loadSettings();
  }, []);

<<<<<<< HEAD
  const handleSearch = async (query: string, category: CategoryType | null) => {
    if (!category) return;

    setIsLoading(true);
    setError(null);
    setLastSearchCategory(category);
    setTmdbResults([]);
    setLastSearchQuery(query);
    setCurrentPage(1);
    try {
=======
  const handleSearch = async (query: string, category: CategoryType) => {
    setIsLoading(true);
    setError(null);
    setLastSearchCategory(category);
    setTmdbResults([]); // Reset TMDB results
    setLastSearchQuery(query);

    try {
      // Films: suggestions TMDB (la recherche de torrents se fait après clic sur une pochette)
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
      if (category === 'movies') {
        const suggestions = await tmdbAPI.searchSuggestions(query, 'movie');
        setTmdbResults(suggestions);
        setResults([]);
        return;
      }
<<<<<<< HEAD
=======

      // Séries/anime: suggestions TMDB (pas de suivi pour le moment)
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
      if (category === 'tv' || category === 'anime') {
        const suggestions = await tmdbAPI.searchSuggestions(query, 'tv');
        setTmdbResults(suggestions);
        setResults([]);
        return;
      }
<<<<<<< HEAD
      const response = await api.searchGeneral(query, category);
      setResults(response?.results || []);
    } catch (err) {
      console.error('Recherche échouée:', err);
      setError(err instanceof Error ? err.message : 'Erreur de communication');
    }
    finally { setIsLoading(false); }
  };

  const handleDownload = async (result: SearchResult) => {
    let indexerTag: string | undefined;
    try {
      if (result.engine_url) {
        indexerTag = new URL(result.engine_url).hostname.replace('www.', '');
      }
    } catch (e) {}

    const mediaType =
      lastSearchCategory === 'movies' ? 'movie'
      : lastSearchCategory === 'tv' ? 'tv'
      : lastSearchCategory === 'anime' ? 'anime'
      : lastSearchCategory === 'music' ? 'music'
      : lastSearchCategory === 'books' ? 'books'
      : undefined;
    await download({
      url: result.link,
      name: result.name,
      itemCategory: result.category,
      categoryId: result.categoryId,
      mediaType: mediaType as 'movie' | 'tv' | 'anime' | 'music' | 'books' | undefined,
      searchContext: lastSearchCategory === 'software' ? 'software' : undefined,
      tags: indexerTag ? [indexerTag] : undefined,
    });
=======

      // Autres catégories: recherche Prowlarr via backend
      const response = await api.searchGeneral(query, category);
      setResults(response?.results || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erreur lors de la recherche. Vérifiez les paramètres avec votre administrateur.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (result: SearchResult) => {
    try {
      // Utiliser addTorrentWithCategory qui prend en compte la catégorie du résultat
      await api.addTorrentWithCategory(result.link, result.category);
      setToastMessage('Torrent ajouté avec succès !');
    } catch (error) {
      // [DEBUG ONLY] console.error('Error adding torrent:', error);
      setError('Erreur lors de l\'ajout du torrent à qBittorrent');
    }
  };

  const handleTrackFromResult = async (result: SearchResult) => {
    try {
      const tmdbResults = await tmdbAPI.searchSuggestions(result.name, 'movie');
      if (!tmdbResults || tmdbResults.length === 0) {
        throw new Error('Impossible de trouver le film sur TMDB à partir de ce résultat');
      }

      const best = tmdbResults[0];
      await api.addLibraryItem({
        tmdb_id: best.id,
        media_type: 'movie',
        title: best.title,
        poster_url: best.posterPath || null,
        release_date: best.releaseDate || null
      });

      setToastMessage('Ajouté au suivi');
    } catch (err) {
      const anyErr = err as any;
      if (anyErr?.status === 409) {
        const msgs = Array.isArray(anyErr?.data?.messages) ? anyErr.data.messages : null;
        if (msgs && msgs.length > 0) {
          setToastMessage(msgs.join(' • '));
          return;
        }
        const requestedBy = anyErr?.data?.existing?.requested_by;
        setToastMessage(requestedBy ? `Déjà demandé par ${requestedBy}` : (anyErr?.data?.error || 'Déjà demandé'));
        return;
      }
      setToastMessage(err instanceof Error ? err.message : 'Erreur lors de l\'ajout au suivi');
    }
  };

  const handleSort = (option: SortOption) => {
    if (option === sortOption) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('desc');
    }
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
  };

  const sortResults = (results: SearchResult[]): SearchResult[] => {
    return [...results].sort((a, b) => {
<<<<<<< HEAD
      let cmp = 0;
      if (sortOption === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortOption === 'size') cmp = a.size - b.size;
      else if (sortOption === 'seeds') cmp = a.seeds - b.seeds;
      else if (sortOption === 'leech') cmp = a.leech - b.leech;
      else {
        const dA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const dB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        cmp = dA - dB;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  };

  const paginatedResults = (results: SearchResult[]) => {
    const sorted = sortResults(results);
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  };

  return (
    <div className="animate-premium-fade space-y-12 pb-20">
      <div className="glass-card p-6 border-white/5 shadow-2xl sticky top-4 z-40 backdrop-blur-3xl bg-gray-950/60">
        <SearchBar onSearch={handleSearch} />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-8 shadow-lg shadow-blue-600/10" />
          <p className="text-gray-500 font-black uppercase text-xs tracking-[0.4em] animate-pulse">Synchronisation...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-12 border-red-500/20 text-center space-y-4">
          <p className="text-red-400 font-black uppercase text-sm tracking-widest">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">Réessayer</button>
        </div>
      ) : (lastSearchCategory === 'movies' || lastSearchCategory === 'tv' || lastSearchCategory === 'anime') ? (
        tmdbResults.length > 0 ? (
          <div className="space-y-10">
            <div className="flex items-center gap-6">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <h2 className="text-sm font-black text-gray-500 tracking-[0.4em] uppercase whitespace-nowrap">Suggestions TMDB</h2>
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>
            <MediaGrid items={tmdbResults} category={lastSearchCategory} />
          </div>
        ) : lastSearchCategory && (
          <div className="py-32 glass-card text-center opacity-30"><p className="text-gray-500 font-black uppercase text-xs tracking-widest">Aucun résultat TMDB</p></div>
        )
      ) : results.length > 0 ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500"><Search size={24} /></div>
               <div><h2 className="text-xl font-black text-white tracking-tighter uppercase mb-1">Indexation Directe</h2><p className="text-gray-500 text-[9px] font-black uppercase tracking-widest">{results.length} Identifiés</p></div>
            </div>
            <SortControls sortOption={sortOption} sortDirection={sortDirection} onSort={(o) => { if (o === sortOption) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); else { setSortOption(o); setSortDirection('desc'); } }} />
          </div>
          <div className="grid grid-cols-1 gap-4">
=======
      let comparison = 0;
      switch (sortOption) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'seeds':
          comparison = a.seeds - b.seeds;
          break;
        case 'leech':
          comparison = a.leech - b.leech;
          break;
        case 'date':
          const dateA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
          const dateB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Pagination
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const paginatedResults = (results: SearchResult[]): SearchResult[] => {
    const sortedResults = sortResults(results);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedResults.slice(startIndex, startIndex + itemsPerPage);
  };

  const hasTmdbResults = tmdbResults.length > 0;
  const isMovies = lastSearchCategory === 'movies';

  return (
    <div className="container mx-auto px-4 py-6">
      <SearchBar onSearch={handleSearch} />

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">
          Recherche en cours...
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">
          {error}
        </div>
      ) : isMovies ? (
        hasTmdbResults ? (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Résultats trouvés
            </h2>
            <MediaGrid items={tmdbResults} category={lastSearchCategory} />
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Aucun résultat trouvé.<br />
            Vérifiez l'orthographe, la catégorie, ou réessayez avec un autre titre.
          </div>
        )
      ) : ((lastSearchCategory === 'tv' || lastSearchCategory === 'anime') && tmdbResults.length === 0) ? (
        <div className="text-center py-8 text-gray-400">
          Aucun résultat trouvé.<br />
          Vérifiez l'orthographe, la catégorie, ou réessayez avec un autre titre.
        </div>
      ) : hasTmdbResults ? (
        // Affichage des résultats TMDB
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            Résultats trouvés
          </h2>
          <MediaGrid items={tmdbResults} category={lastSearchCategory} />
        </div>
      ) : results.length > 0 ? (
        // Affichage des résultats Prowlarr
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">
              Torrents disponibles
            </h2>
            <SortControls
              sortOption={sortOption}
              sortDirection={sortDirection}
              onSort={(option) => handleSort(option)}
            />
          </div>
          <div className="space-y-4">
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
            {paginatedResults(results).map((result) => (
              <ResultCard
                key={result.link}
                result={result}
                onDownload={handleDownload}
<<<<<<< HEAD
                searchContext={lastSearchCategory === 'software' ? 'software' : undefined}
                forcedCategory={
                lastSearchCategory === 'movies' ? 'movie'
                : lastSearchCategory === 'tv' ? 'tv'
                : lastSearchCategory === 'anime' ? 'anime'
                : lastSearchCategory === 'music' ? 'music'
                : lastSearchCategory === 'books' ? 'books'
                : undefined
              } />
            ))}
          </div>
          {results.length > itemsPerPage && (
            <div className="mt-16 flex justify-center items-center gap-8">
              <button onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 1} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-20 transition-all"><ChevronLeft size={20} /></button>
              <span className="text-white font-black text-xs uppercase tracking-widest">Page {currentPage} / {Math.ceil(results.length / itemsPerPage)}</span>
              <button onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === Math.ceil(results.length / itemsPerPage)} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-20 transition-all"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      ) : !lastSearchCategory ? (
        <div className="mt-20 space-y-10">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-orange-600/10 rounded-2xl border border-orange-600/20 text-orange-500"><Rss size={24} /></div>
            <div><h2 className="text-xl font-black text-white tracking-tighter uppercase mb-1">Réseaux RSS</h2><p className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Flux temps-réel</p></div>
          </div>
          <RssFeedList />
        </div>
      ) : (
        <div className="py-32 glass-card text-center opacity-30"><p className="text-gray-500 font-black uppercase text-xs tracking-widest">Aucun signal détecté</p></div>
      )}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      {confirmModal}
=======
                onTrack={undefined}
              />
            ))}
          </div>

          {/* Pagination controls */}
          {results.length > 0 && (
            <div className="mt-6 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-full md:w-auto px-4 py-3 md:py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              
              <div className="flex flex-wrap justify-center items-center gap-2 my-3 md:my-0">
                {Array.from({ length: Math.max(1, Math.ceil(results.length / itemsPerPage)) }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-10 h-10 rounded-lg ${
                      pageNum === currentPage
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(results.length / itemsPerPage) || results.length <= itemsPerPage}
                className="w-full md:w-auto px-4 py-3 md:py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      ) : lastSearchCategory === null ? (
        <RssFeedList />
      ) : (
        <div className="text-center py-8 text-gray-400">
          Aucun résultat trouvé.<br />
          Vérifiez l'orthographe, la catégorie, ou réessayez avec un autre titre.
        </div>
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
    </div>
  );
}