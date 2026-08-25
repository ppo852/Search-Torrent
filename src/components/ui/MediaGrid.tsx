import { useNavigate } from 'react-router-dom';
import type { TmdbResult } from '../../types';
import type { PosterBadge } from '../../lib/poster-badge';
import { filterTmdbBySearchCategory } from '../../lib/tmdb-category-filter';
import { PosterBadgeStack } from './PosterBadgeStack';

interface MediaGridProps {
  items: TmdbResult[];
  category?: string;
  onSelect?: (item: TmdbResult) => void;
  getPosterBadges?: (item: TmdbResult) => PosterBadge | PosterBadge[] | null | undefined;
}

export function MediaGrid({ items, category, onSelect, getPosterBadges }: MediaGridProps) {
  const filteredItems = filterTmdbBySearchCategory(items, category);
  const navigate = useNavigate();

  const handleClick = (item: TmdbResult) => {
    if (onSelect) {
      onSelect(item);
    } else {
      navigate(`/media/${item.type}/${item.id}`);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    const [year] = date.split('-');
    return year;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2">
      {filteredItems.map((item) => {
        const rawBadges = getPosterBadges?.(item);
        const badges = Array.isArray(rawBadges) ? rawBadges : rawBadges ? [rawBadges] : [];
        return (
        <div
          key={`${item.type}-${item.id}`}
          className="relative group cursor-pointer transition-transform duration-200 hover:scale-105"
          onClick={() => handleClick(item)}
        >
          {/* Poster */}
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
            {badges.length > 0 && (
              <PosterBadgeStack
                badges={badges}
                chipClassName="px-1.5 py-0.5 rounded text-[7px] max-w-full"
              />
            )}
            {item.posterPath ? (
              <img
                src={item.posterPath?.replace('/w500/', '/w342/')}
                alt={item.title}
                className="w-full h-full object-cover max-h-[250px] max-w-full"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No Poster
              </div>
            )}
          </div>

          {/* Overlay with info */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex flex-col justify-end p-2 pointer-events-none">
            <h3 className="text-white font-semibold text-xs sm:text-sm line-clamp-2">
              {item.title}
            </h3>
            <div className="flex items-center gap-1 text-xs text-gray-300 mt-1">
              <span>{formatDate(item.releaseDate)}</span>
              {item.voteAverage > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center">
                    <span>★</span>
                    <span>{item.voteAverage.toFixed(1)}</span>
                  </div>
                </>
              )}
            </div>
            {item.overview && (
              <div className="mt-1 text-[10px] sm:text-xs text-gray-200 line-clamp-4 whitespace-pre-line">
                {item.overview}
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
