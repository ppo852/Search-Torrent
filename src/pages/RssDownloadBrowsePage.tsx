import { useMemo } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { MediaBrowseGrid } from '../components/media/MediaBrowseGrid';
import { useRssRecentHome } from '../hooks/useRssRecentHome';
import { useRequestStatus } from '../hooks/useRequestStatus';
import {
  RSS_HOME_SECTIONS,
  homeRssItemToTmdbResult,
  type RssHomeSectionKey,
} from '../lib/rss-home';
import type { MediaBrowseReturnState } from '../lib/media-browse';
import type { TmdbResult } from '../types';

const KIND_SET = new Set(RSS_HOME_SECTIONS.map((s) => s.key));

/**
 * Liste complète « à télécharger » (une catégorie RSS home).
 */
export function RssDownloadBrowsePage() {
  const { kind } = useParams<{ kind: string }>();
  const navigate = useNavigate();
  const config =
    kind && KIND_SET.has(kind as RssHomeSectionKey)
      ? RSS_HOME_SECTIONS.find((s) => s.key === kind)!
      : null;

  const { data, isLoading } = useRssRecentHome();
  const { getPosterBadgesForMedia } = useRequestStatus();

  const items = useMemo(() => {
    if (!config || !data) return [];
    return (data[config.key] || []).map((item) =>
      homeRssItemToTmdbResult(item, config.mediaType)
    );
  }, [config, data]);

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
