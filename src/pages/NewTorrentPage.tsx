import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSearchStore } from '../stores/searchStore';
import { SearchBar } from '../components/ui/SearchBar';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import { RssFeedList } from '../components/rss/RssFeedList';
import { MediaGrid } from '../components/ui/MediaGrid';
import { Toast } from '../components/core/Toast';
import type { SearchResult, SortOption, CategoryType } from '../types';
import { tmdbAPI } from '../lib/tmdb';
import { globalSettings } from '../lib/settings';
import { api } from '../lib/api';

export function NewTorrentPage() {
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
    };
    loadSettings();
  }, []);

  const handleSearch = async (query: string, category: CategoryType) => {
    setIsLoading(true);
    setError(null);
    setLastSearchCategory(category);
    setTmdbResults([]); // Reset TMDB results
    setLastSearchQuery(query);

    try {
      // Films: suggestions TMDB (la recherche de torrents se fait après clic sur une pochette)
      if (category === 'movies') {
        const suggestions = await tmdbAPI.searchSuggestions(query, 'movie');
        setTmdbResults(suggestions);
        setResults([]);
        return;
      }

      // Séries/anime: suggestions TMDB (pas de suivi pour le moment)
      if (category === 'tv' || category === 'anime') {
        const suggestions = await tmdbAPI.searchSuggestions(query, 'tv');
        setTmdbResults(suggestions);
        setResults([]);
        return;
      }

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
  };

  const sortResults = (results: SearchResult[]): SearchResult[] => {
    return [...results].sort((a, b) => {
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
            {paginatedResults(results).map((result) => (
              <ResultCard
                key={result.link}
                result={result}
                onDownload={handleDownload}
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
    </div>
  );
}