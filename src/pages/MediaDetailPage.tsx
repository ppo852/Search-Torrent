import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { showToast, showApiErrorToast } from '../stores/toastStore';
import { hasTmdbAnimationGenre, TMDB_ANIMATION_GENRE_ID } from '../lib/tmdb-category-filter';
import { ArrowLeft, Calendar, Star, Tv, Film, BookmarkPlus, X, Play, Search, ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { MediaBrowseReturnState } from '../lib/media-browse';
import { tmdbAPI } from '../services/tmdb/tmdb';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import { FilterSelect } from '../components/ui/FilterSelect';
import type { SearchResult, SortOption, TmdbResult } from '../types';
import { globalSettings } from '../services/settings';
import { ExpandableText } from '../components/ui/ExpandableText';
import { TrailerModal } from '../components/ui/TrailerModal';
import { pickBestTrailer, type TmdbVideo } from '../lib/tmdb-videos';
import { useInteractiveTorrentDownload } from '../hooks/useInteractiveTorrentDownload';
import { useRequestStatus } from '../hooks/useRequestStatus';
import { PosterBadgeStack } from '../components/ui/PosterBadgeStack';
import { TvShowSeasonStatusPanel } from '../components/ui/TvShowSeasonStatusPanel';
import type { TvSeasonStatusRow } from '../services/api/api';
import {
  QUALITY_FILTER_OPTIONS,
  LANGUAGE_FILTER_OPTIONS,
  matchesQualityFilter,
  matchesLanguageFilter,
  type QualityFilter,
  type LanguageFilter,
} from '../lib/torrent-filters';

async function fetchProwlarrResults(options: {
  mediaType: 'movie' | 'tv';
  title: string;
  year: string;
  tmdbId: number;
  isAnime?: boolean;
  isAnimationMovie?: boolean;
  expandTextSearch?: boolean;
}): Promise<SearchResult[]> {
  const {
    mediaType,
    title,
    year,
    tmdbId,
    isAnime = false,
    isAnimationMovie = false,
    expandTextSearch = false,
  } = options;
  const expandOpts = expandTextSearch ? { expandTextSearch: true as const } : undefined;

  if (mediaType === 'movie') {
    const response = await api.searchMovie(
      title,
      year,
      tmdbId,
      isAnimationMovie ? 'animation' : 'movie',
      expandOpts
    );
    return response?.results || [];
  }

  const response = await api.searchTvSeries(
    title,
    isAnime ? 'anime' : 'tv',
    tmdbId,
    year,
    expandOpts
  );
  return response?.results || [];
}

function isMediaBrowseReturnState(value: unknown): value is MediaBrowseReturnState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.from === 'string' && typeof v.fromLabel === 'string' && v.from.length > 0;
}

export function MediaDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const browseReturn = isMediaBrowseReturnState(location.state) ? location.state : null;
  const [media, setMedia] = useState<(TmdbResult & { backdropPath?: string | null }) | null>(null);
  const [isAnime, setIsAnime] = useState(false);
  const [isAnimationMovie, setIsAnimationMovie] = useState(false);
  const [tvSeasons, setTvSeasons] = useState<Array<{ season_number: number; name?: string }>>([]);
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('admin');
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [selectedSeasonNumbers, setSelectedSeasonNumbers] = useState<number[]>([]);
  const itemsPerPage = 25;
  const [results, setResults] = useState<SearchResult[]>([]);
  const [existingSeasonNumbers, setExistingSeasonNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpandingSearch, setIsExpandingSearch] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trailer, setTrailer] = useState<TmdbVideo | null>(null);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [seasonStatusRows, setSeasonStatusRows] = useState<TvSeasonStatusRow[]>([]);
  const [mobileSourceFiltersOpen, setMobileSourceFiltersOpen] = useState(false);
  const { getPosterBadgesForMedia } = useRequestStatus();

  useEffect(() => {
    const loadMediaDetails = async () => {
      if (!type || !id) return;

      setTrailer(null);
      setTrailerModalOpen(false);
      setSearchExpanded(false);

      try {
        if (!globalSettings.isTmdbConfigured()) {
          await globalSettings.load();
        }

        if (!globalSettings.isTmdbConfigured()) {
          throw new Error('TMDB non configuré');
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
          title: actualType === 'movie' ? data.title : data.name,
          originalTitle: actualType === 'movie' ? data.original_title : data.original_name,
          releaseDate: actualType === 'movie' ? data.release_date : data.first_air_date,
          posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : null,
          backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
          type: actualType as 'movie' | 'tv',
          overview: data.overview,
          voteAverage: data.vote_average,
          genres: Array.isArray(data.genres)
            ? data.genres
                .filter((g: { id?: number; name?: string }) => g?.name)
                .map((g: { id: number; name: string }) => ({ id: g.id, name: g.name }))
            : [],
        });

        const videoResults = Array.isArray(data?.videos?.results) ? data.videos.results : [];
        setTrailer(pickBestTrailer(videoResults));

        if (actualType === 'tv' && Array.isArray(data.seasons)) {
          const seasons = data.seasons
            .map((s: any) => ({
              season_number: typeof s?.season_number === 'number' ? s.season_number : Number(s?.season_number),
              name: s?.name
            }))
            .filter((s: any) => Number.isInteger(s?.season_number) && s.season_number > 0);
          setTvSeasons(seasons);
        }

        const hasAnimationGenre = hasTmdbAnimationGenre(data);
        const detectedAnime = actualType === 'tv' && hasAnimationGenre;
        const detectedAnimationMovie = actualType === 'movie' && hasAnimationGenre;
        setIsAnime(detectedAnime);
        setIsAnimationMovie(detectedAnimationMovie);
        setIsLoading(true);
        setError(null);

        let searchResults: SearchResult[] = [];
        const year = (actualType === 'movie' ? data.release_date : data.first_air_date)?.split('-')[0] || '';
        const title = (actualType === 'movie' ? data.title : data.name) || (actualType === 'movie' ? data.original_title : data.original_name) || '';

        searchResults = await fetchProwlarrResults({
          mediaType: actualType as 'movie' | 'tv',
          title,
          year,
          tmdbId: data.id,
          isAnime: detectedAnime,
          isAnimationMovie: detectedAnimationMovie,
        });

        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };

    loadMediaDetails();
  }, [type, id, setResults, setIsLoading, setError]);

  const handleExpandSearch = useCallback(async () => {
    if (!media || isExpandingSearch || searchExpanded) return;

    setIsExpandingSearch(true);
    try {
      const year = media.releaseDate?.split('-')[0] || '';
      const title = media.title || media.originalTitle || '';
      const previousCount = results.length;
      const searchResults = await fetchProwlarrResults({
        mediaType: media.type,
        title,
        year,
        tmdbId: media.id,
        isAnime,
        isAnimationMovie,
        expandTextSearch: true,
      });

      const nextCount = searchResults.length;
      setResults(searchResults);
      setSearchExpanded(true);
      setCurrentPage(1);

      if (nextCount > previousCount) {
        showToast(`Plus de sources trouvées (${previousCount} → ${nextCount})`);
      } else {
        showToast('Aucune source supplémentaire');
      }
    } catch (err) {
      showApiErrorToast(err, 'Échec de la recherche élargie');
    } finally {
      setIsExpandingSearch(false);
    }
  }, [media, isExpandingSearch, searchExpanded, isAnimationMovie, isAnime, results.length]);

  useEffect(() => {
    const loadSeasonStatus = async () => {
      if (!media || media.type !== 'tv') {
        setSeasonStatusRows([]);
        return;
      }

      try {
        const { seasons } = await api.getTvShowSeasonStatus(media.id, {
          mediaType: isAnime ? 'anime' : 'tv',
          title: media.title,
          seasons: tvSeasons.map((s) => s.season_number),
        });
        setSeasonStatusRows(seasons || []);
      } catch {
        setSeasonStatusRows([]);
      }
    };

    loadSeasonStatus();
  }, [media, isAnime, tvSeasons]);

  const handleSort = (option: SortOption) => {
    if (option === sortOption) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('desc');
    }
  };

  const closeSeasonModal = () => setSeasonModalOpen(false);

  const completeSeasonNumbers = useMemo(
    () => new Set(seasonStatusRows.filter((r) => r.complete).map((r) => r.season_number)),
    [seasonStatusRows]
  );

  const toggleSeasonNumber = (num: number) => {
    if (existingSeasonNumbers.includes(num) || completeSeasonNumbers.has(num)) return;
    setSelectedSeasonNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  const confirmSeasonRequests = async () => {
    if (!media) return;
    const toRequest = selectedSeasonNumbers.filter(
      (n) => !existingSeasonNumbers.includes(n) && !completeSeasonNumbers.has(n)
    );
    if (toRequest.length === 0) return;
    try {
      await api.createTvSeasonRequests({
        tmdb_id: media.id,
        media_type: isAnime ? 'anime' : 'tv',
        title: media.title,
        poster_url: media.posterPath || null,
        season_numbers: toRequest
      });
      showToast('Ajouté au suivi');
      closeSeasonModal();
      try {
        const { seasons } = await api.getTvShowSeasonStatus(media.id, {
          mediaType: isAnime ? 'anime' : 'tv',
          title: media.title,
          seasons: tvSeasons.map((s) => s.season_number),
        });
        setSeasonStatusRows(seasons || []);
      } catch {
        /* ignore */
      }
    } catch (err: any) {
      showApiErrorToast(err, 'Erreur lors de la demande');
    }
  };

  const { download, confirmModal } = useInteractiveTorrentDownload();

  const handleDownload = async (result: SearchResult) => {
    let indexerTag: string | undefined;
    try {
      if (result.engine_url) {
        indexerTag = new URL(result.engine_url).hostname.replace('www.', '');
      }
    } catch (e) {}

    const seasonFromName = extractSeason(result.name);
    const seasonNum =
      selectedSeason !== 'all'
        ? parseInt(selectedSeason, 10)
        : seasonFromName
          ? parseInt(seasonFromName, 10)
          : undefined;
    const episodeMatch = result.name.match(/\bS\d{1,2}[\s._-]*E(\d{1,4})\b/i)
      || result.name.match(/\b(\d{1,2})x(\d{1,4})\b/i);
    const episodeNum = episodeMatch
      ? parseInt(episodeMatch[episodeMatch.length - 1], 10)
      : undefined;

    await download({
      url: result.link,
      name: result.name,
      itemCategory: result.category,
      categoryId: result.categoryId,
      mediaType: (isAnime
        ? 'anime'
        : isAnimationMovie
          ? 'animation'
          : (media?.type || type)) as 'movie' | 'tv' | 'anime' | 'animation' | undefined,
      tags: indexerTag ? [indexerTag] : undefined,
      tmdbId: media?.id,
      seasonNumber: Number.isInteger(seasonNum) && seasonNum > 0 ? seasonNum : undefined,
      episodeNumber: Number.isInteger(episodeNum) && episodeNum > 0 ? episodeNum : undefined,
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
        setSelectedSeasonNumbers([]);
      } catch (err) {
        setExistingSeasonNumbers([]);
      }
      try {
        const { seasons } = await api.getTvShowSeasonStatus(media.id, {
          mediaType: isAnime ? 'anime' : 'tv',
          title: media.title,
          seasons: tvSeasons.map((s) => s.season_number),
        });
        setSeasonStatusRows(seasons || []);
      } catch {
        /* keep previous rows */
      }
      setSeasonModalOpen(true);
      return;
    }
    try {
      await api.addLibraryItem({
        tmdb_id: media.id,
        media_type: isAnimationMovie ? 'animation' : 'movie',
        title: media.title,
        poster_url: media.posterPath || null,
        release_date: media.releaseDate || null
      });
      showToast('Ajouté aux demandes');
    } catch (err: any) {
      showApiErrorToast(err, 'Erreur lors de la demande');
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
    if (qualityFilter !== 'all') {
      filtered = filtered.filter(r => matchesQualityFilter(r.name, qualityFilter));
    }
    if (languageFilter === 'admin') {
      filtered = filtered.filter((r) => r.is_compatible !== false);
    } else if (languageFilter !== 'all') {
      filtered = filtered.filter((r) => matchesLanguageFilter(r.name, languageFilter));
    }
    return filtered;
  }, [results, selectedSeason, qualityFilter, languageFilter]);

  const seasonFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Toutes' },
      ...availableSeasons.map((s) => ({
        value: s,
        label: `Saison ${parseInt(s, 10)}`,
      })),
    ],
    [availableSeasons]
  );

  const handleSourceFilterChange = useCallback((key: 'quality' | 'language' | 'season', value: string) => {
    if (key === 'quality') setQualityFilter(value as QualityFilter);
    else if (key === 'language') setLanguageFilter(value as LanguageFilter);
    else setSelectedSeason(value);
    setCurrentPage(1);
  }, []);

  const sourceFilterConfigs = useMemo(() => {
    const filters: Array<{
      key: 'quality' | 'language' | 'season';
      label: string;
      value: string;
      options: { value: string; label: string }[];
    }> = [
      { key: 'quality', label: 'Qualité', value: qualityFilter, options: QUALITY_FILTER_OPTIONS },
      { key: 'language', label: 'Langue', value: languageFilter, options: LANGUAGE_FILTER_OPTIONS },
    ];

    if (media?.type === 'tv' && availableSeasons.length > 0) {
      filters.push({
        key: 'season',
        label: 'Saison',
        value: selectedSeason,
        options: seasonFilterOptions,
      });
    }

    return filters;
  }, [qualityFilter, languageFilter, selectedSeason, seasonFilterOptions, media?.type, availableSeasons.length]);

  const sortedAndPaginatedResults = useMemo(() => {
    const sorted = [...filteredResults].sort((a, b) => {
      let comp = 0;
      if (sortOption === 'name') comp = a.name.localeCompare(b.name);
      else if (sortOption === 'size') comp = a.size - b.size;
      else if (sortOption === 'seeds') comp = a.seeds - b.seeds;
      else if (sortOption === 'date') comp = (a.publishDate ? new Date(a.publishDate).getTime() : 0) - (b.publishDate ? new Date(b.publishDate).getTime() : 0);
      return sortDirection === 'asc' ? comp : -comp;
    });
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredResults, sortOption, sortDirection, currentPage]);

  if (!media) return null;

  const displayGenres = media.genres?.filter((g) => !((isAnime || isAnimationMovie) && g.id === TMDB_ANIMATION_GENRE_ID)) ?? [];
  const posterBadges = getPosterBadgesForMedia(media);

  return (
    <div className="animate-premium-fade relative min-h-screen">
      {/* Background Cinématique */}
      {media.backdropPath && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <img
            src={media.backdropPath}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.28] scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/75 via-transparent to-gray-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/65 via-transparent to-gray-950/65" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 85% 75% at 50% 40%, transparent 45%, rgba(3,7,18,0.3) 100%)',
            }}
          />
        </div>
      )}

      <div className="relative z-10 space-y-8">
        {browseReturn && (
          <Link
            to={browseReturn.from}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            {browseReturn.fromLabel}
          </Link>
        )}
        <div className="p-6 md:p-8 rounded-[2rem] border border-blue-500/10 bg-white/[0.03] shadow-[0_16px_64px_rgba(37,99,235,0.12)] backdrop-blur-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-3">
            <div className="relative overflow-hidden rounded-[1.75rem] shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-blue-500/15 max-w-[220px] sm:max-w-[260px] mx-auto lg:mx-0 lg:max-w-none group">
              <div className="relative">
                {posterBadges.length > 0 && <PosterBadgeStack badges={posterBadges} />}
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
            </div>

          <div className="lg:col-span-9 flex flex-col justify-start lg:pt-2">
            <div className="flex items-center gap-4 mb-4">
              <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${media.type === 'movie' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-purple-600/20 border-purple-500/50 text-purple-400'}`}>
                {media.type === 'movie'
                  ? (isAnimationMovie ? 'Animation' : 'Film')
                  : isAnime ? 'Anime' : 'Série TV'}
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

            {displayGenres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {displayGenres.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-gray-300"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
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

            <div className="flex flex-row items-center gap-2 sm:gap-4">
              {trailer && (
                <button
                  type="button"
                  onClick={() => setTrailerModalOpen(true)}
                  className="flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-white/10 transition-all tracking-widest hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play size={16} className="text-red-400 fill-red-400 shrink-0 sm:w-[18px] sm:h-[18px]" />
                  BANDE-ANNONCE
                </button>
              )}
              <button
                onClick={handleTrack}
                className="flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 premium-gradient text-white font-black text-[10px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all tracking-widest"
              >
                <BookmarkPlus size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
                AUTOMATISER
              </button>
            </div>

            {media.type === 'tv' && (
              <TvShowSeasonStatusPanel rows={seasonStatusRows} mediaType={isAnime ? 'anime' : 'tv'} />
            )}
          </div>
        </div>
        </div>

        <div className="space-y-10 border-t border-white/5 pt-8">
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-black text-white tracking-tight uppercase mb-1">Sources Disponibles</h2>
              <p className="text-gray-500 font-medium italic text-sm">
                {searchExpanded
                  ? 'Recherche élargie — plus de sources'
                  : 'Les meilleures versions détectées sur les indexeurs'}
              </p>
            </div>

            <div className="lg:hidden space-y-3 w-full max-w-full">
              <button
                type="button"
                onClick={() => setMobileSourceFiltersOpen((open) => !open)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                aria-expanded={mobileSourceFiltersOpen}
              >
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  <SlidersHorizontal size={14} />
                  Filtres
                  {(qualityFilter !== 'all' || languageFilter !== 'admin' || selectedSeason !== 'all') && (
                    <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                      {(qualityFilter !== 'all' ? 1 : 0) +
                        (languageFilter !== 'admin' ? 1 : 0) +
                        (selectedSeason !== 'all' ? 1 : 0)}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-300 ${mobileSourceFiltersOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mobileSourceFiltersOpen && (
                <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-2 soft-card p-3 w-full">
                  <SortControls
                    sortOption={sortOption}
                    sortDirection={sortDirection}
                    onSort={(option) => handleSort(option)}
                    className="mt-0"
                  />
                  {sourceFilterConfigs.map((filter) => (
                    <FilterSelect
                      key={`mobile-${filter.key}`}
                      label={filter.label}
                      value={filter.value}
                      options={filter.options}
                      onChange={(value) => handleSourceFilterChange(filter.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="hidden lg:flex flex-wrap items-end justify-center gap-x-3 gap-y-2 soft-card p-3 w-fit max-w-full mx-auto">
              <SortControls
                sortOption={sortOption}
                sortDirection={sortDirection}
                onSort={(option) => handleSort(option)}
                className="mt-0"
              />
              {sourceFilterConfigs.map((filter) => (
                <FilterSelect
                  key={`desktop-${filter.key}`}
                  label={filter.label}
                  value={filter.value}
                  options={filter.options}
                  onChange={(value) => handleSourceFilterChange(filter.key, value)}
                />
              ))}
            </div>

            {!isLoading && media && (
              <button
                type="button"
                onClick={handleExpandSearch}
                disabled={isExpandingSearch || searchExpanded}
                className="px-5 py-2.5 rounded-xl bg-transparent border border-blue-500/60 text-blue-300 font-black uppercase tracking-widest text-[10px] hover:bg-blue-500/10 hover:border-blue-400 hover:text-blue-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
                title={
                  searchExpanded
                    ? 'Recherche déjà élargie'
                    : 'Chercher plus de sources'
                }
              >
                <Search size={16} className={isExpandingSearch ? 'animate-pulse' : ''} />
                {isExpandingSearch
                  ? 'Recherche...'
                  : searchExpanded
                    ? 'Déjà fait'
                    : 'Plus de résultats'}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 font-black uppercase tracking-widest animate-pulse text-xs">Scan en cours...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="soft-card py-20 flex flex-col items-center justify-center text-center opacity-50">
              <Film size={48} className="text-blue-400/30 mb-4" />
              <p className="text-blue-400/60 text-lg font-bold uppercase tracking-tighter">Aucune source trouvée</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAndPaginatedResults.map((result) => (
                <ResultCard
                  key={result.link}
                  result={result}
                  onDownload={handleDownload}
                  forcedCategory={
                    isAnime ? 'anime' : isAnimationMovie ? 'animation' : (type as string)
                  }
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

      {confirmModal}
      <TrailerModal
        isOpen={trailerModalOpen}
        video={trailer}
        title={media ? `Bande-annonce — ${media.title}` : 'Bande-annonce'}
        onClose={() => setTrailerModalOpen(false)}
      />

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
              {tvSeasons.length > 0 ? tvSeasons.map((season) => {
                const alreadyTracked = existingSeasonNumbers.includes(season.season_number);
                const alreadyOnEmby = completeSeasonNumbers.has(season.season_number);
                const locked = alreadyTracked || alreadyOnEmby;
                const selected = selectedSeasonNumbers.includes(season.season_number);

                return (
                <label
                  key={season.season_number}
                  className={`group flex items-center justify-between p-5 rounded-2xl transition-all border ${
                    alreadyOnEmby
                      ? 'bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed opacity-60'
                      : alreadyTracked
                        ? 'bg-green-600/10 border-green-600/30 text-white cursor-default'
                        : selected
                          ? 'bg-blue-600/10 border-blue-600/30 text-white shadow-lg shadow-blue-600/5 cursor-pointer'
                          : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 cursor-pointer'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      alreadyOnEmby
                        ? 'bg-gray-700 border-gray-600'
                        : alreadyTracked
                          ? 'bg-green-600 border-green-600'
                          : selected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-white/20'
                      }`}>
                      {(alreadyTracked || selected) && !alreadyOnEmby && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm" />
                      )}
                      {alreadyOnEmby && (
                        <div className="w-2.5 h-2.5 bg-gray-500 rounded-full" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`font-black text-sm uppercase tracking-widest transition-colors ${locked ? '' : 'group-hover:text-white'}`}>
                        {season.name || `Saison ${season.season_number}`}
                      </span>
                      {alreadyOnEmby && (
                        <span className="text-[9px] text-emerald-500/80 font-black uppercase tracking-tighter">
                          Déjà disponible sur Emby
                        </span>
                      )}
                      {!alreadyOnEmby && alreadyTracked && (
                        <span className="text-[9px] text-green-500 font-black uppercase tracking-tighter">Déjà en suivi</span>
                      )}
                    </div>
                  </div>
                  {!locked && (
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selected}
                      onChange={() => toggleSeasonNumber(season.season_number)}
                    />
                  )}
                </label>
                );
              }) : (
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
