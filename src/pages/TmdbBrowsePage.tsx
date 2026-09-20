import { useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { MediaBrowseGrid } from '../components/media/MediaBrowseGrid';
import { useTmdbMovieBrowse, useTmdbTvBrowse } from '../hooks/useTmdbBrowse';
import { useRequestStatus } from '../hooks/useRequestStatus';
import {
  getMovieBrowseSectionBySlug,
  type TmdbMovieBrowseKind,
} from '../lib/tmdb-movie-browse';
import {
  getTvBrowseSectionBySlug,
  type TmdbTvBrowseKind,
} from '../lib/tmdb-tv-browse';
import type { MediaBrowseReturnState } from '../lib/media-browse';
import type { TmdbResult } from '../types';

/**
 * Page « Voir plus » TMDB (films / séries) — même UI, source selon l’URL.
 */
export function TmdbBrowsePage() {
  const { kind } = useParams<{ kind: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isTv = pathname.startsWith('/series');

  const movieConfig = !isTv && kind ? getMovieBrowseSectionBySlug(kind) : null;
  const tvConfig = isTv && kind ? getTvBrowseSectionBySlug(kind) : null;
  const config = isTv ? tvConfig : movieConfig;

  const movieQuery = useTmdbMovieBrowse(
    (movieConfig?.kind ?? 'now-playing') as TmdbMovieBrowseKind,
    80,
    Boolean(movieConfig)
  );
  const tvQuery = useTmdbTvBrowse(
    (tvConfig?.kind ?? 'trending') as TmdbTvBrowseKind,
    80,
    Boolean(tvConfig)
  );

  const { data: items = [], isLoading } = isTv ? tvQuery : movieQuery;
  const { getPosterBadgesForMedia } = useRequestStatus();

  if (!config) {
    return <Navigate to="/" replace />;
  }

  const handleMediaClick = (media: TmdbResult, returnState: MediaBrowseReturnState) => {
    navigate(`/media/${media.type}/${media.id}`, { state: returnState });
  };

  return (
    <MediaBrowseGrid
      title={config.title}
      backTo="/"
      backLabel="Découvrir"
      items={items}
      isLoading={isLoading}
      emptyLabel={config.emptyLabel}
      browsePath={config.browsePath}
      browseLabel={config.title}
      onMediaClick={handleMediaClick}
      getPosterBadges={getPosterBadgesForMedia}
    />
  );
}
