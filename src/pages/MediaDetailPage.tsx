import { useEffect, useState, useMemo } from 'react';
import { Toast } from '../components/core/Toast';
import { api } from '../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Star, Tv, Film, Filter, BookmarkPlus } from 'lucide-react';
import { useSearchStore } from '../stores/searchStore';
import { tmdbAPI } from '../lib/tmdb';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import type { SearchResult, SortOption, TmdbResult } from '../types';
import { globalSettings } from '../services/settings';
import { QualityProfile, QualityProfileAssignments } from '../pages/AdminPage';
import { useAuthStore } from '../stores/authStore';

export function MediaDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [media, setMedia] = useState<TmdbResult | null>(null);
  const [isAnime, setIsAnime] = useState(false);
  const [tvSeasons, setTvSeasons] = useState<Array<{ season_number: number; name?: string }>>([]);
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [languageFilterEnabled, setLanguageFilterEnabled] = useState<boolean>(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [selectedSeasonNumbers, setSelectedSeasonNumbers] = useState<number[]>([]);
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
  const [qualityAssignments, setQualityAssignments] = useState<QualityProfileAssignments>({
    movie_profile_id: '',
    tv_profile_id: ''
  });
  const itemsPerPage = 25;
  const { results, isLoading, error, setResults, setIsLoading, setError } = useSearchStore();

  useEffect(() => {
    const loadMediaDetails = async () => {
      if (!type || !id) return;
      
      try {
        if (!globalSettings.getTmdbAccessToken()) {
          await globalSettings.load();
        }

        if (!globalSettings.getTmdbAccessToken()) {
          throw new Error("TMDB n'est pas configuré (token manquant). ");
        }

        // Charger les détails depuis TMDB
        const url = new URL(`${tmdbAPI.BASE_URL}/${type}/${id}`);
        url.searchParams.append('language', 'fr-FR');
        
        const response = await fetch(url.toString(), {
          headers: tmdbAPI.getHeaders()
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('TMDB API error: 401 (token invalide)');
          }
          throw new Error(`TMDB API error: ${response.status}`);
        }
        
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

        if (type === 'tv' && Array.isArray(data.seasons)) {
          const seasons = data.seasons
            .map((s: any) => ({
              season_number: typeof s?.season_number === 'number' ? s.season_number : Number(s?.season_number),
              name: s?.name
            }))
            .filter((s: any) => Number.isInteger(s?.season_number) && s.season_number > 0);
          setTvSeasons(seasons);
        } else {
          setTvSeasons([]);
        }

        // Détection anime : type 'tv' ET genre Animation (id 16) présent
        const detectedAnime = type === 'tv' && Array.isArray(data.genres) && data.genres.some((g: any) => g.id === 16);
        setIsAnime(detectedAnime);
        setIsLoading(true);
        setError(null);
        
        let searchResults: SearchResult[] = [];
        
        if (type === 'movie') {
          const year = data.release_date?.split('-')[0] || '';
          const title = data.title || data.original_title || '';
          
          // Use centralized backend search
          const response = await api.searchMovie(title, year, data.id);
          searchResults = response?.results || [];
        } else if (detectedAnime) {
          // Use centralized backend search with tmdbId for title variants
          const searchQuery = data.name || data.original_name || '';
          const response = await api.searchTvSeries(searchQuery, 'anime', data.id);
          searchResults = response?.results || [];
        } else {
          // Use centralized backend search with tmdbId for title variants
          const searchQuery = data.name || data.original_name || '';
          const response = await api.searchTvSeries(searchQuery, 'tv', data.id);
          searchResults = response?.results || [];
        }
        
        setResults(searchResults);
      } catch (err) {
        console.error('Error loading media details:', err);
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };

    const loadQualityProfiles = async () => {
      try {
        const settings = user?.is_admin ? await api.getSettings() : await api.getClientSettings();
        const profilesRaw = Array.isArray((settings as any).quality_profiles) ? (settings as any).quality_profiles : [];
        const assignments = (settings as any).quality_profile_assignments || null;

        if (Array.isArray(profilesRaw)) {
          const profiles = profilesRaw.map((p: any) => ({
            id: String(p?.id || ''),
            name: String(p?.name || ''),
            min_size_mb: Number(p?.min_size_mb) || 0,
            max_size_mb: Number(p?.max_size_mb) || 0,
            required_keywords: Array.isArray(p?.required_keywords) ? p.required_keywords : [],
            blocked_keywords: Array.isArray(p?.blocked_keywords) ? p.blocked_keywords : [],
            sort_by: (p?.sort_by as 'seeds_desc' | 'size_asc' | 'size_desc' | 'date_asc' | 'date_desc') || 'seeds_desc'
          })).filter(p => p.id);
          setQualityProfiles(profiles);
        }

        if (assignments) {
          setQualityAssignments({
            movie_profile_id: String(assignments.movie_profile_id || ''),
            tv_profile_id: String(assignments.tv_profile_id || '')
          });
        }
      } catch (error) {
        console.error('Erreur lors du chargement des profils de qualité:', error);
      }
    };

    loadMediaDetails();
    loadQualityProfiles();
  }, [type, id, user?.is_admin]);

  const handleSort = (option: SortOption) => {
    if (option === sortOption) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('desc');
    }
  };

  const closeSeasonModal = () => {
    setSeasonModalOpen(false);
  };

  const toggleSeasonNumber = (seasonNumber: number) => {
    setSelectedSeasonNumbers((prev) => {
      if (prev.includes(seasonNumber)) {
        return prev.filter((s) => s !== seasonNumber);
      }
      return [...prev, seasonNumber].sort((a, b) => a - b);
    });
  };

  const confirmSeasonRequests = async () => {
    try {
      if (!media) return;

      const mediaType = media.type === 'tv' && isAnime ? 'anime' : media.type;
      if (mediaType !== 'tv' && mediaType !== 'anime') return;

      const seasonsToCreate = selectedSeasonNumbers
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0);

      if (seasonsToCreate.length === 0) {
        setToastMessage('Choisis au moins une saison');
        return;
      }

      const result = await api.createTvSeasonRequests({
        tmdb_id: media.id,
        media_type: mediaType,
        title: media.title,
        poster_url: media.posterPath || null,
        season_numbers: seasonsToCreate
      });

      const createdCount = Array.isArray(result?.created) ? result.created.length : 0;
      const conflicts = Array.isArray(result?.conflicts) ? result.conflicts : [];

      if (createdCount > 0 && conflicts.length === 0) {
        setToastMessage('Ajouté au suivi');
      } else if (createdCount > 0 && conflicts.length > 0) {
        const first = conflicts[0];
        const who = first?.requested_by;
        setToastMessage(who ? `Certaines saisons déjà demandées par ${who}` : 'Certaines saisons déjà demandées');
      } else {
        setToastMessage('Déjà demandé');
      }

      closeSeasonModal();
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
      setToastMessage(err instanceof Error ? err.message : 'Erreur lors de l\'ajout de la demande');
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
      console.error('Error adding torrent:', error);
      setError('Erreur lors de l\'ajout du torrent à qBittorrent');
    }
  };

  const handleTrack = async () => {
    try {
      if (!media) return;

      const mediaType = media.type === 'tv' && isAnime ? 'anime' : media.type;

      if (mediaType === 'tv' || mediaType === 'anime') {
        setSelectedSeasonNumbers([]);
        setSeasonModalOpen(true);
        return;
      }

      await api.addLibraryItem({
        tmdb_id: media.id,
        media_type: mediaType,
        title: media.title,
        poster_url: media.posterPath || null,
        release_date: media.releaseDate || null
      });

      setToastMessage('Ajouté aux demandes');
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
      setToastMessage(err instanceof Error ? err.message : 'Erreur lors de l\'ajout de la demande');
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
  
  // Fonction pour filtrer les résultats par saison et langue
  const filteredResults = useMemo(() => {
    let filtered = results;

    // Filtre par saison
    if (selectedSeason !== 'all' && type === 'tv') {
      filtered = filtered.filter(result => {
        const season = extractSeason(result.name);
        return season !== null && season === selectedSeason;
      });
    }

    // Filtre par langue (si activé) - utilise seulement les mots-clés, pas la taille/qualité
    if (languageFilterEnabled) {
      const mediaType = media?.type === 'tv' && isAnime ? 'anime' : media?.type;
      const profileId = mediaType === 'movie' ? qualityAssignments.movie_profile_id : qualityAssignments.tv_profile_id;
      const profile = qualityProfiles.find(p => p.id === profileId);

      if (profile) {
        filtered = filtered.filter(result => {
          const title = String(result.name || '').toLowerCase();
          
          // Vérifier les mots obligatoires (langue)
          const hasRequired = profile.required_keywords.length === 0 || 
            profile.required_keywords.some(keyword => title.includes(keyword.toLowerCase()));
          
          // Vérifier les mots interdits (langue)
          const hasBlocked = profile.blocked_keywords.length > 0 && 
            profile.blocked_keywords.some(keyword => title.includes(keyword.toLowerCase()));
          
          return hasRequired && !hasBlocked;
        });
      }
    }

    return filtered;
  }, [results, selectedSeason, type, languageFilterEnabled, media, isAnime, qualityAssignments, qualityProfiles]);
  
  const paginatedResults = (results: SearchResult[]): SearchResult[] => {
    const sortedResults = sortResults(results);
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedResults.slice(startIndex, startIndex + itemsPerPage);
  };

  if (!media) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      {seasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeSeasonModal}
          />
          <div className="relative w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
            <div className="text-white font-semibold text-lg">Choisir les saisons à suivre</div>
            <div className="text-gray-300 text-sm mt-2">Sélectionne les saisons à ajouter au suivi.</div>

            <div className="mt-4 space-y-2 max-h-72 overflow-auto">
              {tvSeasons.length === 0 ? (
                <div className="text-gray-400 text-sm">Aucune saison trouvée.</div>
              ) : (
                tvSeasons.map((s) => (
                  <button
                    key={s.season_number}
                    type="button"
                    onClick={() => toggleSeasonNumber(s.season_number)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded border text-sm transition-colors ${
                      selectedSeasonNumbers.includes(s.season_number)
                        ? 'bg-green-600/20 border-green-500 text-green-200'
                        : 'bg-gray-900/40 border-gray-700 text-gray-200 hover:bg-gray-700/40'
                    }`}
                  >
                    <span className="text-left">Saison {s.season_number}{s.name ? ` — ${s.name}` : ''}</span>
                    <span className="text-xs font-semibold">
                      {selectedSeasonNumbers.includes(s.season_number) ? 'ON' : 'OFF'}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeSeasonModal}
                className="px-4 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmSeasonRequests}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-3 mb-2 md:mb-0">
              <h2 className="text-xl font-semibold text-white">
                Torrents disponibles
              </h2>
              <button
                onClick={handleTrack}
                className="flex items-center gap-2 px-3 py-2 md:px-2 md:py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Ajouter aux demandes"
              >
                <BookmarkPlus className="h-4 w-4" />
                <span className="text-sm">Demander</span>
              </button>
            </div>
            
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

              {/* Filtre langue */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    setLanguageFilterEnabled(!languageFilterEnabled);
                    setCurrentPage(1); // Reset pagination when language filter changes
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm transition-all transform ${
                    languageFilterEnabled 
                      ? 'bg-blue-600 text-white translate-x-1 shadow-md' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Filtrer par langue
                </button>
              </div>
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

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
