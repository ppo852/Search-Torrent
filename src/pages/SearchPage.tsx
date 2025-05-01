import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSearchStore } from '../stores/searchStore';
import { SearchBar } from '../components/ui/SearchBar';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import { RssFeedList } from '../components/rss/RssFeedList';
import { MediaGrid } from '../components/ui/MediaGrid';
import { Toast } from '../components/core/Toast';
import type { SearchResult, SortOption, CategoryType, TmdbResult } from '../types';
import { prowlarrAPI } from '../lib/prowlarr';
import { tmdbAPI } from '../lib/tmdb';
import { globalSettings } from '../lib/settings';
import { api } from '../lib/api';

export function SearchPage() {
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [settings, setSettings] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
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
      // TMDB uniquement pour films et séries
      if (category === 'movies' || category === 'tv') {
        const tmdbType = category === 'movies' ? 'movie' : 'tv';
        const suggestions = await tmdbAPI.searchSuggestions(query, tmdbType);
        setTmdbResults(suggestions);
        setResults([]); // On vide les résultats Prowlarr
      } else {
        // Pour toutes les autres catégories (anime inclus), recherche Prowlarr directe
        const searchResults = await prowlarrAPI.search(query, category);
        setResults(searchResults);
      }
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
      setShowToast(true);
    } catch (error) {
      // [DEBUG ONLY] console.error('Error adding torrent:', error);
      setError('Erreur lors de l\'ajout du torrent à qBittorrent');
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
      ) : tmdbResults.length > 0 ? (
        // Affichage des résultats TMDB
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            Résultats trouvés
          </h2>
          <MediaGrid items={tmdbResults} />
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
          Aucun résultat trouvé
        </div>
      )}

      {showToast && (
        <Toast
          message="Torrent ajouté avec succès !"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}