import { useEffect, useState, useMemo } from 'react';
import { Toast } from '../components/core/Toast';
import { api } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Star, Tv, Film, BookmarkPlus, HardDrive, Download, Users, X, Sparkles } from 'lucide-react';
import { useSearchStore } from '../stores/searchStore';
import { tmdbAPI } from '../services/tmdb/tmdb';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import type { SearchResult, SortOption, TmdbResult } from '../types';
import { globalSettings } from '../services/settings';
import { QualityProfile, QualityProfileAssignments } from '../pages/AdminPage';
import { useAuthStore } from '../stores/authStore';
import { formatSize, formatDate } from '../lib/formatters';
import { ExpandableText } from '../components/ui/ExpandableText';
import { useInteractiveTorrentDownload } from '../hooks/useInteractiveTorrentDownload';

export function MediaDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [media, setMedia] = useState<(TmdbResult & { backdropPath?: string | null }) | null>(null);
  const [isAnime, setIsAnime] = useState(false);
  const [tvSeasons, setTvSeasons] = useState<Array<{ season_number: number; name?: string }>>([]);
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [languageFilterEnabled, setLanguageFilterEnabled] = useState<boolean>(true);
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [existingSeasonNumbers, setExistingSeasonNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMediaDetails = async () => {
      if (!type || !id) return;

      try {
        if (!globalSettings.getTmdbAccessToken()) {
          await globalSettings.load();
        }

        let data;
        try {
          // On essaie de charger les détails selon le type de l'URL
          if (type === 'movie') {
            data = await tmdbAPI.getMovieDetails(id);
            data.media_type = 'movie';
          } else {
            // Si c'est 'tv' ou 'multi', on essaie 'tv' d'abord
            try {
              data = await tmdbAPI.getTvDetails(id);
              data.media_type = 'tv';
            } catch (e) {
              // Si ça échoue (cas du 'multi' qui était en fait un film), on tente 'movie'
              data = await tmdbAPI.getMovieDetails(id);
              data.media_type = 'movie';
            }
          }
        } catch (err) {
          throw new Error("Impossible de charger les détails de TMDB");
        }

        const actualType = data.media_type;

        setMedia({
          id: data.id,
          title: type === 'movie' ? data.title : data.name,
          originalTitle: type === 'movie' ? data.original_title : data.original_name,
          releaseDate: type === 'movie' ? data.release_date : data.first_air_date,
          posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : null,
          backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
          type: actualType as 'movie' | 'tv',
          overview: data.overview,
          voteAverage: data.vote_average
        });

        if (actualType === 'tv' && Array.isArray(data.seasons)) {
          const seasons = data.seasons
            .map((s: any) => ({
              season_number: typeof s?.season_number === 'number' ? s.season_number : Number(s?.season_number),
              name: s?.name
            }))
            .filter((s: any) => Number.isInteger(s?.season_number) && s.season_number > 0);
          setTvSeasons(seasons);
        }

        const detectedAnime = actualType === 'tv' && Array.isArray(data.genres) && data.genres.some((g: any) => g.id === 16);
        setIsAnime(detectedAnime);
        setIsLoading(true);
        setError(null);

        let searchResults: SearchResult[] = [];
        const year = (actualType === 'movie' ? data.release_date : data.first_air_date)?.split('-')[0] || '';
        const title = (actualType === 'movie' ? data.title : data.name) || (actualType === 'movie' ? data.original_title : data.original_name) || '';

        if (actualType === 'movie') {
          const response = await api.searchMovie(title, year, data.id);
          searchResults = response?.results || [];
        } else {
          const response = await api.searchTvSeries(title, detectedAnime ? 'anime' : 'tv', data.id, year);
          searchResults = response?.results || [];
        }

        setResults(searchResults);
      } catch (err) {
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
            sort_by: (p?.sort_by as any) || 'seeds_desc'
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
        // Fail silently
      }
    };

    loadMediaDetails();
    loadQualityProfiles();
  }, [type, id, user?.is_admin, setResults, setIsLoading, setError]);

  const handleSort = (option: SortOption) => {
    if (option === sortOption) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('desc');
    }
  };

  const closeSeasonModal = () => setSeasonModalOpen(false);

  const toggleSeasonNumber = (num: number) => {
    setSelectedSeasonNumbers(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort((a, b) => a - b));
  };

  const confirmSeasonRequests = async () => {
    if (!media) return;
    try {
      await api.createTvSeasonRequests({
        tmdb_id: media.id,
        media_type: isAnime ? 'anime' : 'tv',
        title: media.title,
        poster_url: media.posterPath || null,
        season_numbers: selectedSeasonNumbers
      });
      setToastMessage('Ajouté au suivi');
      closeSeasonModal();
    } catch (err: any) {
      setToastMessage(err.message || 'Erreur lors de la demande');
    }
  };

  const { download, confirmModal } = useInteractiveTorrentDownload({
    onSuccess: (msg) => {
      setToastMessage(msg);
      setShowToast(true);
    },
    onError: (msg) => {
      setToastMessage(msg);
      setShowToast(true);
    },
  });

  const handleDownload = async (result: SearchResult) => {
    let indexerTag: string | undefined;
    try {
      if (result.engine_url) {
        indexerTag = new URL(result.engine_url).hostname.replace('www.', '');
      }
    } catch (e) {}

    await download({
      url: result.link,
      name: result.name,
      itemCategory: result.category,
      categoryId: result.categoryId,
      mediaType: (isAnime ? 'anime' : (media?.type || type)) as 'movie' | 'tv' | 'anime' | undefined,
      tags: indexerTag ? [indexerTag] : undefined,
    });
  };

  const handleTrack = async () => {
    if (!media) return;

    // Si TMDB nous confirme que c'est une série, on ouvre le modal des saisons
    // Peu importe si l'URL dit 'tv', 'multi' ou autre chose.
    if (media.type === 'tv') {
      try {
        const existing = await api.getExistingSeasons(media.id, isAnime ? 'anime' : 'tv');
        setExistingSeasonNumbers(existing || []);
        // Pre-select existing ones + reset newly selected
        setSelectedSeasonNumbers([]);
      } catch (err) {
        setExistingSeasonNumbers([]);
      }
      setSeasonModalOpen(true);
      return;
    }
    try {
      await api.addLibraryItem({
        tmdb_id: media.id,
        media_type: 'movie',
        title: media.title,
        poster_url: media.posterPath || null,
        release_date: media.releaseDate || null
      });
      setToastMessage('Ajouté aux demandes');
    } catch (err: any) {
      setToastMessage(err.message || 'Erreur lors de la demande');
    }
  };

  const extractSeason = (name: string): string | null => {
    const match = name.match(/[Ss](?:aison|eason)?\.?\s*(\d{1,2})/i) || name.match(/[Ss](\d{1,2})[Ee]\d{1,2}/i);
    if (match) {
      const n = parseInt(match[1]);
      return n < 10 ? `0${n}` : `${n}`;
    }
    return null;
  };

  const availableSeasons = useMemo(() => {
    const seasons = new Set<string>();
    results.forEach(r => {
      const s = extractSeason(r.name);
      if (s) seasons.add(s);
    });
    return Array.from(seasons).sort();
  }, [results]);

  const filteredResults = useMemo(() => {
    let filtered = results;
    if (selectedSeason !== 'all') {
      filtered = filtered.filter(r => extractSeason(r.name) === selectedSeason);
    }
    if (languageFilterEnabled && media) {
      const profile = qualityProfiles.find(p => p.id === (media.type === 'movie' ? qualityAssignments.movie_profile_id : qualityAssignments.tv_profile_id));
      if (profile) {
        filtered = filtered.filter(r => {
          const t = r.name.toLowerCase();

          // Keyword filtering only
          const req = profile.required_keywords.length === 0 || profile.required_keywords.some(k => t.includes(k.toLowerCase()));
          const blo = profile.blocked_keywords.some(k => t.includes(k.toLowerCase()));
          return req && !blo;
        });
      }
    }
    return filtered;
  }, [results, selectedSeason, languageFilterEnabled, media, qualityProfiles, qualityAssignments]);

  const sortedAndPaginatedResults = useMemo(() => {
    const sorted = [...filteredResults].sort((a, b) => {
      let comp = 0;
      if (sortOption === 'name') comp = a.name.localeCompare(b.name);
      else if (sortOption === 'size') comp = a.size - b.size;
      else if (sortOption === 'seeds') comp = a.seeds - b.seeds;
      else if (sortOption === 'leech') comp = a.leech - b.leech;
      else if (sortOption === 'date') comp = (a.publishDate ? new Date(a.publishDate).getTime() : 0) - (b.publishDate ? new Date(b.publishDate).getTime() : 0);
      return sortDirection === 'asc' ? comp : -comp;
    });
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredResults, sortOption, sortDirection, currentPage]);

  if (!media) return null;

  return (
    <div className="animate-premium-fade relative min-h-screen">
      {/* Background Cinématique */}
      {media.backdropPath && (
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-3xl" />
          <img
            src={media.backdropPath}
            alt="Backdrop"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
        </div>
      )}

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
          <div className="lg:col-span-3">
            <div className="glass-card overflow-hidden shadow-2xl group border-white/10">
              {media.posterPath ? (
                <img
                  src={media.posterPath.replace('w342', 'w500')}
                  alt={media.title}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="aspect-[2/3] flex items-center justify-center bg-gray-900 text-gray-600 font-black uppercase">Pas d'affiche</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-9 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-4">
              <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${media.type === 'movie' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-purple-600/20 border-purple-500/50 text-purple-400'}`}>
                {media.type === 'movie' ? 'Film' : isAnime ? 'Anime' : 'Série TV'}
              </div>
              {media.voteAverage > 0 && (
                <div className="flex items-center gap-1.5 text-yellow-500 font-black">
                  <Star size={16} fill="currentColor" />
                  <span>{media.voteAverage.toFixed(1)}</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter mb-4 leading-none uppercase">
              {media.title}
            </h1>

            {media.originalTitle !== media.title && (
              <h2 className="text-xl text-gray-500 font-bold mb-6 tracking-tight italic opacity-80">
                {media.originalTitle}
              </h2>
            )}

            <div className="flex flex-wrap items-center gap-6 mb-8 text-gray-400 font-bold uppercase text-xs tracking-widest">
              {media.releaseDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-blue-500" />
                  <span>{new Date(media.releaseDate).getFullYear()}</span>
                </div>
              )}
              {media?.type === 'tv' && tvSeasons.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tv size={14} className="text-purple-500" />
                  <span>{tvSeasons.length} Saisons</span>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-10">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Synopsis</h3>
              <ExpandableText text={media.overview || "Aucun résumé disponible pour ce média."} maxLines={3} className="max-w-4xl" />
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleTrack}
                className="px-6 py-2.5 premium-gradient text-white font-black text-sm flex items-center gap-2 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all tracking-widest"
              >
                <BookmarkPlus size={18} />
                AUTOMATISER
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-10 border-t border-white/5 pt-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase mb-1">Sources Disponibles</h2>
              <p className="text-gray-500 font-medium italic text-sm">Les meilleures versions détectées sur les indexeurs</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 glass p-1.5 rounded-2xl border-white/5">
              <SortControls
                sortOption={sortOption}
                sortDirection={sortDirection}
                onSort={(option) => handleSort(option)}
              />

              {media?.type === 'tv' && availableSeasons.length > 0 && (
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="bg-white/5 border border-white/10 text-gray-400 font-bold text-[10px] px-3 py-1.5 rounded-xl focus:outline-none focus:text-white transition-colors uppercase tracking-widest"
                >
                  <option value="all">Toutes Saisons</option>
                  {availableSeasons.map(s => <option key={s} value={s}>Saison {parseInt(s, 10)}</option>)}
                </select>
              )}

              <button
                onClick={() => setLanguageFilterEnabled(!languageFilterEnabled)}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${languageFilterEnabled
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white/5 text-gray-500 hover:text-gray-300'
                  }`}
              >
                <Sparkles size={14} />
                Filtre Langues
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 font-black uppercase tracking-widest animate-pulse text-xs">Scan en cours...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="glass-card py-20 flex flex-col items-center justify-center text-center opacity-50">
              <Film size={48} className="text-gray-800 mb-4" />
              <p className="text-gray-500 text-lg font-bold uppercase tracking-tighter">Aucune source trouvée</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAndPaginatedResults.map((result) => (
                <ResultCard
                  key={result.link}
                  result={result}
                  onDownload={handleDownload}
                  forcedCategory={isAnime ? 'anime' : type as string}
                />
              ))}
            </div>
          )}

          {filteredResults.length > itemsPerPage && (
            <div className="mt-12 flex justify-center items-center gap-3">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-black uppercase tracking-widest text-[10px] disabled:opacity-20 transition-all hover:text-white hover:bg-white/10"
              >
                Précédent
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, Math.ceil(filteredResults.length / itemsPerPage)) }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-11 h-11 rounded-xl font-black transition-all ${pageNum === currentPage
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-110'
                      : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredResults.length / itemsPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(filteredResults.length / itemsPerPage)}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-black uppercase tracking-widest text-[10px] disabled:opacity-20 transition-all hover:text-white hover:bg-white/10"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>

      {(showToast || toastMessage) && (
        <Toast
          message={toastMessage || "Torrent ajouté avec succès !"}
          onClose={() => { setShowToast(false); setToastMessage(null); }}
        />
      )}
      {confirmModal}

      {seasonModalOpen && (
        <div className="fixed inset-0 z-[999] flex justify-end bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
          {/* Overlay qui couvre tout l'écran */}
          <div className="absolute inset-0" onClick={closeSeasonModal} />

          {/* Le panneau lui-même, forcé à la hauteur de l'écran */}
          <div className="relative w-full max-w-md bg-[#0a0a0b] border-l border-white/10 h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            {/* En-tête : Fixe en haut */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Automatisation</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Saisons à surveiller</p>
              </div>
              <button
                onClick={closeSeasonModal}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps : Défilable uniquement ici */}
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-3">
              {tvSeasons.length > 0 ? tvSeasons.map((season) => (
                <label
                  key={season.season_number}
                  className={`group flex items-center justify-between p-5 rounded-2xl cursor-pointer transition-all border ${existingSeasonNumbers.includes(season.season_number)
                    ? 'bg-green-600/10 border-green-600/30 text-white cursor-default'
                    : selectedSeasonNumbers.includes(season.season_number)
                      ? 'bg-blue-600/10 border-blue-600/30 text-white shadow-lg shadow-blue-600/5'
                      : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${existingSeasonNumbers.includes(season.season_number)
                      ? 'bg-green-600 border-green-600'
                      : selectedSeasonNumbers.includes(season.season_number)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-white/20'
                      }`}>
                      {(existingSeasonNumbers.includes(season.season_number) || selectedSeasonNumbers.includes(season.season_number)) && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-sm uppercase tracking-widest group-hover:text-white transition-colors">
                        {season.name || `Saison ${season.season_number}`}
                      </span>
                      {existingSeasonNumbers.includes(season.season_number) && (
                        <span className="text-[9px] text-green-500 font-black uppercase tracking-tighter">Déjà en suivi</span>
                      )}
                    </div>
                  </div>
                  {!existingSeasonNumbers.includes(season.season_number) && (
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedSeasonNumbers.includes(season.season_number)}
                      onChange={() => toggleSeasonNumber(season.season_number)}
                    />
                  )}
                </label>
              )) : (
                <div className="py-20 text-center opacity-30">
                  <Tv size={48} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-[10px]">Aucune saison détectée</p>
                </div>
              )}
            </div>

            {/* Pied de page : Toujours visible en bas du panneau */}
            <div className="p-8 bg-black border-t border-white/10 shrink-0 space-y-4 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
              <button
                onClick={confirmSeasonRequests}
                disabled={selectedSeasonNumbers.length === 0}
                className="w-full py-4 rounded-2xl premium-gradient text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 disabled:opacity-20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Lancer l'automatisation
              </button>
              <button
                onClick={closeSeasonModal}
                className="w-full py-4 rounded-2xl bg-white/5 text-gray-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
