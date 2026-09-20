import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { MediaSection } from '../components/ui/MediaSection';
import { PosterBadgeLegend } from '../components/ui/PosterBadgeLegend';
import { RssTrackerHome } from '../components/home/RssRecentRow';
import { formatYear } from '../utils/formatters';
import type { TmdbResult } from '../types';
import { useRequestStatus } from '../hooks/useRequestStatus';
import { useTmdbMovieBrowse, useTmdbTvBrowse } from '../hooks/useTmdbBrowse';
import { MEDIA_PREVIEW_LIMIT, buildMediaBrowseState } from '../lib/media-browse';
import { TMDB_MOVIE_BROWSE_SECTIONS } from '../lib/tmdb-movie-browse';
import { TMDB_TV_BROWSE_SECTIONS } from '../lib/tmdb-tv-browse';

function hasBackdrop(media: TmdbResult): boolean {
  return Boolean(media.backdropPath);
}

/** Intercale films au cinéma + séries tendance (avec backdrop) pour le hero. */
function buildHeroMedias(movies: TmdbResult[], shows: TmdbResult[], limit = 10): TmdbResult[] {
  const moviePool = movies.filter(hasBackdrop);
  const showPool = shows.filter(hasBackdrop);
  const combined: TmdbResult[] = [];
  const seen = new Set<string>();
  const max = Math.max(moviePool.length, showPool.length);

  for (let i = 0; i < max && combined.length < limit; i++) {
    if (i < moviePool.length) {
      const m = moviePool[i];
      const key = `${m.type}-${m.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(m);
      }
    }
    if (combined.length >= limit) break;
    if (i < showPool.length) {
      const s = showPool[i];
      const key = `${s.type}-${s.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(s);
      }
    }
  }

  return combined;
}

export function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { getPosterBadgesForMedia } = useRequestStatus();

  const upcomingCinema = useTmdbMovieBrowse('upcoming-cinema', MEDIA_PREVIEW_LIMIT);
  const recentStreamingMovies = useTmdbMovieBrowse('recent-streaming', MEDIA_PREVIEW_LIMIT);
  const nowPlaying = useTmdbMovieBrowse('now-playing', MEDIA_PREVIEW_LIMIT);
  const movieQueriesByKind = {
    'upcoming-cinema': upcomingCinema,
    'recent-streaming': recentStreamingMovies,
    'now-playing': nowPlaying,
  } as const;
  const isMoviesLoading = Object.values(movieQueriesByKind).some((q) => q.isLoading);

  const recentStreamingTv = useTmdbTvBrowse('recent-streaming', MEDIA_PREVIEW_LIMIT);
  const trendingTv = useTmdbTvBrowse('trending', MEDIA_PREVIEW_LIMIT);
  const tvQueriesByKind = {
    'recent-streaming': recentStreamingTv,
    trending: trendingTv,
  } as const;
  const isTvLoading = Object.values(tvQueriesByKind).some((q) => q.isLoading);

  const isHeroLoading = nowPlaying.isLoading || trendingTv.isLoading;

  const heroMedias = useMemo(
    () => buildHeroMedias(nowPlaying.data || [], trendingTv.data || [], 10),
    [nowPlaying.data, trendingTv.data]
  );

  useEffect(() => {
    if (heroMedias.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroMedias.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [heroMedias.length]);

  useEffect(() => {
    if (currentSlide >= heroMedias.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, heroMedias.length]);

  const handleMediaClick = (media: TmdbResult) => {
    navigate(`/media/${media.type}/${media.id}`, {
      state: buildMediaBrowseState('/', 'Découvrir'),
    });
  };

  const currentMedia = heroMedias[currentSlide];

  return (
    <div className="min-h-screen">
      {isHeroLoading && !currentMedia && (
        <div className="relative h-[400px] md:h-[600px] -mt-8 -mx-8 mb-12 flex items-center justify-center bg-gray-900/50">
          <div className="text-gray-400">Chargement des nouveautés...</div>
        </div>
      )}

      {currentMedia && (
        <div className="relative h-[400px] md:h-[600px] -mt-8 -mx-8 mb-12 overflow-hidden shadow-2xl">
          {heroMedias.map((media, index) => (
            <div
              key={`${media.type}-${media.id}`}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
              }`}
              style={{ transition: 'opacity 1000ms ease-in-out, transform 10000ms linear' }}
            >
              <img
                src={media.backdropPath || media.posterPath?.replace('/w185/', '/original/') || ''}
                alt={media.title || ''}
                className="w-full h-full object-cover"
              />
            </div>
          ))}

          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/40 to-transparent">
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 animate-premium-fade">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-widest">Nouveauté</span>
                <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
                  <span>{formatYear(currentMedia.releaseDate || '')}</span>
                  {currentMedia.voteAverage > 0 && (
                    <>
                      <span className="w-1 h-1 bg-gray-500 rounded-full" />
                      <span className="text-yellow-400 font-bold">⭐ {currentMedia.voteAverage.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </div>

              <h1 className="text-3xl md:text-6xl font-black text-white mb-6 leading-tight max-w-4xl tracking-tight">
                {currentMedia.title || 'Découvrez'}
              </h1>

              <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl line-clamp-3 leading-relaxed font-medium">
                {currentMedia.overview}
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleMediaClick(currentMedia)}
                  className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-blue-500 hover:text-white transition-all duration-300 flex items-center gap-2 shadow-xl hover:shadow-blue-500/40"
                >
                  Détails & Recherche
                </button>

                <div className="flex gap-2 ml-8">
                  {heroMedias.map((media, index) => (
                    <button
                      key={`${media.type}-${media.id}-dot`}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        index === currentSlide ? 'w-12 bg-blue-500' : 'w-4 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-y-0 right-0 w-32 md:w-56 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
        </div>
      )}

      <div className="space-y-16 animate-premium-fade delay-200">
        <div className="space-y-12">
          <div className="space-y-6">
            <PosterBadgeLegend />

            <div className="px-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">
                  Catalogue
                </span>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-white">Nouveautés</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Sorties cinéma, plateformes et tendances (TMDB)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isMoviesLoading ? (
            <div className="px-4 text-gray-500 text-sm">Chargement des films...</div>
          ) : (
            TMDB_MOVIE_BROWSE_SECTIONS.map((section) => {
              const query = movieQueriesByKind[section.kind];
              const items = (query.data || []).slice(0, MEDIA_PREVIEW_LIMIT);
              if (!query.isLoading && items.length === 0) return null;
              return (
                <MediaSection
                  key={section.kind}
                  title={section.title}
                  items={items}
                  onMediaClick={handleMediaClick}
                  getPosterBadges={getPosterBadgesForMedia}
                  seeMoreTo={section.browsePath}
                />
              );
            })
          )}

          {isTvLoading ? (
            <div className="px-4 text-gray-500 text-sm">Chargement des séries...</div>
          ) : (
            TMDB_TV_BROWSE_SECTIONS.map((section) => {
              const query = tvQueriesByKind[section.kind];
              const items = (query.data || []).slice(0, MEDIA_PREVIEW_LIMIT);
              if (!query.isLoading && items.length === 0) return null;
              return (
                <MediaSection
                  key={section.kind}
                  title={section.title}
                  items={items}
                  onMediaClick={handleMediaClick}
                  getPosterBadges={getPosterBadgesForMedia}
                  seeMoreTo={section.browsePath}
                />
              );
            })
          )}
        </div>

        <RssTrackerHome />
      </div>
    </div>
  );
}
