import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from '../ui/MediaCard';
import { useRssRecentHome } from '../../hooks/useRssRecentHome';
import { useRequestStatus } from '../../hooks/useRequestStatus';
import { MEDIA_PREVIEW_LIMIT, buildMediaBrowseState } from '../../lib/media-browse';
import {
  RSS_HOME_SECTIONS,
  homeRssItemToTmdbResult,
  type HomeRssItem,
  type RssHomeSectionConfig,
} from '../../lib/rss-home';
import type { PosterBadge } from '../../lib/poster-badge';
import type { TmdbResult } from '../../types';

interface RssTrackerSectionProps {
  config: RssHomeSectionConfig;
  items: HomeRssItem[];
  isLoading: boolean;
  isError: boolean;
  getBadges: (media: TmdbResult) => PosterBadge[];
  onMediaClick: (media: TmdbResult) => void;
}

function RssTrackerSection({
  config,
  items,
  isLoading,
  isError,
  getBadges,
  onMediaClick,
}: RssTrackerSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const previewItems = items
    .slice(0, MEDIA_PREVIEW_LIMIT)
    .map((item) => homeRssItemToTmdbResult(item, config.mediaType));

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -800 : 800;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!isLoading && !isError && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-12 relative group">
      <div className="flex items-center justify-between gap-4 mb-6 pl-4 pr-4">
        <h2
          className={`text-xl font-bold text-white relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:rounded pl-4 ${config.accentBarClass}`}
        >
          {config.title}
        </h2>
        {items.length > 0 && !isLoading && (
          <Link
            to={config.browsePath}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-orange-400 hover:text-orange-300 transition-colors"
          >
            Voir plus
            <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="px-4 text-gray-500 text-sm">{config.loadingLabel}</div>
      )}

      {isError && (
        <div className="px-4 text-red-400 text-sm">{config.errorLabel}</div>
      )}

      {previewItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black text-white p-2 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            aria-label="Précédent"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black text-white p-2 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            aria-label="Suivant"
          >
            <ChevronRight size={24} />
          </button>
          <div ref={scrollRef} className="overflow-x-auto pb-4 scrollbar-hide">
            <div className="flex gap-4 px-4" style={{ width: 'max-content' }}>
              {previewItems.map((media) => (
                <MediaCard
                  key={`${media.type}-${media.id}`}
                  media={media}
                  onClick={onMediaClick}
                  posterBadge={getBadges(media)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function RssTrackerHome() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRssRecentHome();
  const { getPosterBadgesForMedia } = useRequestStatus();
  const tmdbMissing = data?.tmdbConfigured === false;

  const hasAnyContent =
    isLoading ||
    isError ||
    tmdbMissing ||
    (data?.films?.length ?? 0) > 0 ||
    (data?.animations?.length ?? 0) > 0 ||
    (data?.series?.length ?? 0) > 0 ||
    (data?.anime?.length ?? 0) > 0;

  if (!hasAnyContent) return null;

  return (
    <div className="space-y-12 pt-4">
      <div className="px-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-black uppercase tracking-widest">
            Trackers
          </span>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">À télécharger</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sorties récentes déjà présentes sur tes flux RSS
            </p>
          </div>
        </div>
        {tmdbMissing && (
          <p className="mt-3 text-xs text-amber-400/90">
            Enrichissement TMDB indisponible — séries et animes masqués. Vérifie le token TMDB dans l’admin.
          </p>
        )}
      </div>

      {RSS_HOME_SECTIONS.map((config) => {
        const items = data?.[config.key] ?? [];

        return (
          <RssTrackerSection
            key={config.key}
            config={config}
            items={items}
            isLoading={isLoading}
            isError={isError}
            getBadges={getPosterBadgesForMedia}
            onMediaClick={(media) => {
              navigate(`/media/${media.type}/${media.id}`, {
                state: buildMediaBrowseState('/', 'Découvrir'),
              });
            }}
          />
        );
      })}
    </div>
  );
}
