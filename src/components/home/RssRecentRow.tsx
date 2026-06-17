import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { formatYear } from '../../utils/formatters';

const RSS_HOME_HOURS = 72;

interface HomeRssItem {
  tmdb: {
    tmdb_id: number;
    title: string;
    poster_url: string | null;
    release_date?: string;
    vote_average?: number;
  };
}

interface RecentHomeResponse {
  films: HomeRssItem[];
  series: HomeRssItem[];
  anime: HomeRssItem[];
  hours: number;
}

interface TrackerSectionConfig {
  key: 'films' | 'series' | 'anime';
  title: string;
  accentBarClass: string;
  mediaType: 'movie' | 'tv';
  loadingLabel: string;
  errorLabel: string;
}

const SECTIONS: TrackerSectionConfig[] = [
  {
    key: 'films',
    title: 'Nouveaux films à télécharger',
    accentBarClass: 'before:bg-gradient-to-b before:from-orange-500 before:to-red-600',
    mediaType: 'movie',
    loadingLabel: 'Chargement des nouveaux films...',
    errorLabel: 'Impossible de charger les nouveaux films',
  },
  {
    key: 'series',
    title: 'Nouvelles séries à télécharger',
    accentBarClass: 'before:bg-gradient-to-b before:from-blue-500 before:to-indigo-600',
    mediaType: 'tv',
    loadingLabel: 'Chargement des nouvelles séries...',
    errorLabel: 'Impossible de charger les nouvelles séries',
  },
  {
    key: 'anime',
    title: 'Nouveaux animes à télécharger',
    accentBarClass: 'before:bg-gradient-to-b before:from-pink-500 before:to-purple-600',
    mediaType: 'tv',
    loadingLabel: 'Chargement des nouveaux animes...',
    errorLabel: 'Impossible de charger les nouveaux animes',
  },
];

async function fetchRecentHome(token: string): Promise<RecentHomeResponse> {
  const response = await fetch(`/api/rss/recent-home?hours=${RSS_HOME_HOURS}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Erreur lors du chargement des médias trackers');
  }

  const data = await response.json();
  return {
    films: data.films || [],
    series: data.series || [],
    anime: data.anime || [],
    hours: data.hours ?? RSS_HOME_HOURS,
  };
}

interface TrackerCardProps {
  item: HomeRssItem;
  onClick: (item: HomeRssItem) => void;
}

function TrackerCard({ item, onClick }: TrackerCardProps) {
  const { tmdb } = item;

  return (
    <div
      className="flex-shrink-0 cursor-pointer w-[160px] md:w-[200px] animate-premium-fade"
      onClick={() => onClick(item)}
    >
      <div className="glass-card relative overflow-hidden group/card hover:scale-[1.03] hover:-translate-y-2 hover:shadow-orange-500/10">
        <div className="aspect-[2/3] overflow-hidden bg-white/5">
          <img
            src={tmdb.poster_url || ''}
            alt={tmdb.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
            loading="lazy"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-sm md:text-base line-clamp-2 leading-tight mb-2 transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300">
            {tmdb.title}
          </h3>

          <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-300 transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300 delay-75">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded uppercase font-bold tracking-wider">
                Disponible
              </span>
              {tmdb.release_date && <span>{formatYear(tmdb.release_date)}</span>}
            </div>
            {tmdb.vote_average != null && tmdb.vote_average > 0 && (
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                ⭐ {tmdb.vote_average.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="absolute inset-0 border border-white/0 group-hover/card:border-white/20 rounded-2xl transition-colors duration-300 pointer-events-none" />
      </div>
    </div>
  );
}

interface RssTrackerSectionProps {
  config: TrackerSectionConfig;
  items: HomeRssItem[];
  isLoading: boolean;
  isError: boolean;
  onCardClick: (item: HomeRssItem) => void;
}

function RssTrackerSection({
  config,
  items,
  isLoading,
  isError,
  onCardClick,
}: RssTrackerSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
      <h2
        className={`text-xl font-bold text-white mb-6 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:rounded ${config.accentBarClass}`}
      >
        {config.title}
      </h2>

      {isLoading && (
        <div className="px-4 text-gray-500 text-sm">{config.loadingLabel}</div>
      )}

      {isError && (
        <div className="px-4 text-red-400 text-sm">{config.errorLabel}</div>
      )}

      {items.length > 0 && (
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
              {items.map((item) => (
                <TrackerCard
                  key={item.tmdb.tmdb_id}
                  item={item}
                  onClick={onCardClick}
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
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rss', 'recent-home', RSS_HOME_HOURS],
    queryFn: () => fetchRecentHome(token || ''),
    enabled: !!token,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  if (!token) return null;

  const hasAnyContent =
    isLoading ||
    isError ||
    (data?.films?.length ?? 0) > 0 ||
    (data?.series?.length ?? 0) > 0 ||
    (data?.anime?.length ?? 0) > 0;

  if (!hasAnyContent) return null;

  return (
    <>
      {SECTIONS.map((config) => {
        const items = data?.[config.key] ?? [];
        const handleCardClick = (item: HomeRssItem) => {
          navigate(`/media/${config.mediaType}/${item.tmdb.tmdb_id}`);
        };

        return (
          <RssTrackerSection
            key={config.key}
            config={config}
            items={items}
            isLoading={isLoading}
            isError={isError}
            onCardClick={handleCardClick}
          />
        );
      })}
    </>
  );
}

/** @deprecated Utiliser RssTrackerHome */
export const RssRecentRow = RssTrackerHome;
