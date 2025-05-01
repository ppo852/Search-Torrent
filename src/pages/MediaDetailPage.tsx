import { useEffect, useState, useMemo } from 'react';
import { Toast } from '../components/core/Toast';
import { api } from '../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Star, Tv, Film, Filter } from 'lucide-react';
import { useSearchStore } from '../stores/searchStore';
import { tmdbAPI } from '../lib/tmdb';
import { prowlarrAPI } from '../lib/prowlarr';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import type { SearchResult, SortOption, TmdbResult } from '../types';

export function MediaDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [media, setMedia] = useState<TmdbResult | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [showToast, setShowToast] = useState(false);
  const itemsPerPage = 25;
  const { results, isLoading, error, setResults, setIsLoading, setError } = useSearchStore();

  useEffect(() => {
    const loadMediaDetails = async () => {
      if (!type || !id) return;
      
      try {
        // Charger les détails depuis TMDB
        const url = new URL(`${tmdbAPI.BASE_URL}/${type}/${id}`);
        url.searchParams.append('language', 'fr-FR');
        
        const response = await fetch(url.toString(), {
          headers: tmdbAPI.getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to load media details');
        
        const data = await response.json();
        setMedia({
          id: data.id,
          title: type === 'movie' ? data.title : data.name,
          originalTitle: type === 'movie' ? data.original_title : data.original_name,
          releaseDate: type === 'movie' ? data.release_date : data.first_air_date,
          posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w185${data.poster_path}` : null,
          type: type as 'movie' | 'tv',
          overview: data.overview,
          voteAverage: data.vote_average
        });

        // Lancer la recherche Prowlarr
        const searchQuery = `${type === 'movie' ? data.title : data.name} ${data.release_date?.split('-')[0] || ''}`;
        setIsLoading(true);
        setError(null);
        
        const searchResults = await prowlarrAPI.search(searchQuery, type === 'movie' ? 'movies' : 'tv');
        setResults(searchResults);
      } catch (err) {
        "console.error('Error loading media details:', err);"
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };

    loadMediaDetails();
  }, [type, id]);

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

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownload = async (result: SearchResult) => {
    try {
      // Utiliser la nouvelle fonction qui gère la catégorisation
      await api.addTorrentWithCategory(result.link, result.category, type as 'movie' | 'tv');
      setShowToast(true);
    } catch (error) {
      "console.error('Error adding torrent:', error);"
      setError('Erreur lors de l\'ajout du torrent à qBittorrent');
    }
  };

  // Fonction pour extraire les numéros de saison des noms de torrents
  const extractSeason = (name: string): string | null => {
    // Formats courants: S01, Season 1, Saison 1, etc.
    const patterns = [
      /[Ss](?:aison|eason)?\.?\s*(\d{1,2})/i,  // Saison 1, Season 1, S1
      /[Ss](\d{1,2})[Ee]\d{1,2}/i,              // S01E01
      /\b(\d{1,2})x\d{1,2}/i                    // 1x01
    ];
    
    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match && match[1]) {
        // Formatage du numéro de saison avec un zéro si nécessaire
        const seasonNum = parseInt(match[1], 10);
        return seasonNum < 10 ? `0${seasonNum}` : `${seasonNum}`;
      }
    }
    
    return null;
  };
  
  // Liste des saisons disponibles, calculée à partir des résultats
  const availableSeasons = useMemo(() => {
    if (!results || !results.length || type !== 'tv') return [];
    
    const seasons = new Set<string>();
    
    results.forEach(result => {
      const season = extractSeason(result.name);
      if (season) {
        seasons.add(season);
      }
    });
    
    return Array.from(seasons).sort((a, b) => parseInt(a) - parseInt(b));
  }, [results, type]);
  
  // Fonction pour filtrer les résultats par saison
  const filteredResults = useMemo(() => {
    if (selectedSeason === 'all' || type !== 'tv') {
      return results;
    }
    
    return results.filter(result => {
      const season = extractSeason(result.name);
      return season !== null && season === selectedSeason;
    });
  }, [results, selectedSeason, type]);
  
  const paginatedResults = (results: SearchResult[]): SearchResult[] => {
    const sortedResults = sortResults(results);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedResults.slice(startIndex, startIndex + itemsPerPage);
  };

  if (!media) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header avec bouton retour */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft size={20} />
        <span>Retour</span>
      </button>

      {/* Détails du média */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Poster */}
        <div className="w-full md:w-1/5 lg:w-1/6">
          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
            {media.posterPath ? (
              <img
                src={media.posterPath}
                alt={media.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No Poster
              </div>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {media.type === 'movie' ? (
              <Film size={24} className="text-blue-500" />
            ) : (
              <Tv size={24} className="text-blue-500" />
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {media.title}
            </h1>
          </div>

          {media.originalTitle !== media.title && (
            <h2 className="text-lg text-gray-400 mb-4">
              {media.originalTitle}
            </h2>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-300 mb-6">
            {media.releaseDate && (
              <div className="flex items-center gap-1">
                <Calendar size={16} />
                <span>{media.releaseDate.split('-')[0]}</span>
              </div>
            )}
            {media.voteAverage > 0 && (
              <div className="flex items-center gap-1">
                <Star size={16} className="text-yellow-500" />
                <span>{media.voteAverage.toFixed(1)}</span>
              </div>
            )}
          </div>

          {media.overview && (
            <p className="text-gray-300 mb-6 leading-relaxed">
              {media.overview}
            </p>
          )}
        </div>
      </div>

      {/* Résultats de recherche */}
      <div>
        <div className="mb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 md:mb-0">
            <h2 className="text-xl font-semibold text-white mb-2 md:mb-0">
              Torrents disponibles
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <SortControls
                sortOption={sortOption}
                sortDirection={sortDirection}
                onSort={(option) => handleSort(option)}
              />
              
              {/* Sélecteur de saison - visible uniquement pour les séries avec des saisons détectées */}
              {type === 'tv' && availableSeasons.length > 0 && (
                <div className="mt-6 flex items-center">
                  <span className="text-sm text-gray-400 mr-2">Saison:</span>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={selectedSeason}
                      onChange={(e) => {
                        setSelectedSeason(e.target.value);
                        setCurrentPage(1); // Reset pagination when season changes
                      }}
                      className="appearance-none pl-10 pr-4 py-1.5 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Toutes les saisons</option>
                      {availableSeasons.map(season => (
                        <option key={season} value={season}>
                          Saison {parseInt(season, 10)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">
            Recherche en cours...
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            {error}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Aucun torrent trouvé
          </div>
        ) : (
          <div>
            <div className="space-y-4">
              {paginatedResults(filteredResults).map((result) => (
                <ResultCard
                  key={result.link}
                  result={result}
                  onDownload={handleDownload}
                />              
              ))}
            </div>

            {/* Pagination controls */}
            {filteredResults.length > itemsPerPage && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.ceil(filteredResults.length / itemsPerPage) }, (_, i) => i + 1).map((pageNum) => (
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
                  disabled={currentPage === Math.ceil(filteredResults.length / itemsPerPage)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {showToast && (
        <Toast
          message="Torrent ajouté avec succès !"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
