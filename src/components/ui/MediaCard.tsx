import type { TmdbResult } from '../../types';
import { formatYear } from '../../utils/formatters';

interface MediaCardProps {
  media: TmdbResult;
  onClick: (media: TmdbResult) => void;
}

export function MediaCard({ media, onClick }: MediaCardProps) {

  return (
    <div
      className="media-card flex-shrink-0 cursor-pointer"
      style={{ width: '150px' }}
      onClick={() => onClick(media)}
    >
      <div className="relative overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-500/30">
        <img
          src={media.posterPath?.replace('/w185/', '/w342/') || ''}
          alt={media.title}
          className="w-full h-56 object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">
              {media.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span>{formatYear(media.releaseDate)}</span>
              {media.voteAverage > 0 && (
                <>
                  <span>•</span>
                  <span>⭐ {media.voteAverage.toFixed(1)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
