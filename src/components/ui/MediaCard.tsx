import type { TmdbResult } from '../../types';
import { formatYear } from '../../utils/formatters';

interface MediaCardProps {
  media: TmdbResult;
  onClick: (media: TmdbResult) => void;
}

export function MediaCard({ media, onClick }: MediaCardProps) {
<<<<<<< HEAD
  return (
    <div
      className="flex-shrink-0 cursor-pointer w-[160px] md:w-[200px] animate-premium-fade"
      onClick={() => onClick(media)}
    >
      <div className="glass-card relative overflow-hidden group/card hover:scale-[1.03] hover:-translate-y-2 hover:shadow-blue-500/10">
        {/* Poster Image */}
        <div className="aspect-[2/3] overflow-hidden">
          <img
            src={media.posterPath?.replace('/w185/', '/w500/') || ''}
            alt={media.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
            loading="lazy"
          />
        </div>

        {/* Overlay with info */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-sm md:text-base line-clamp-2 leading-tight mb-2 transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300">
            {media.title}
          </h3>
          
          <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-300 transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300 delay-75">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/10 rounded uppercase font-bold tracking-wider">
                {media.type === 'movie' ? 'Film' : 'Série'}
              </span>
              <span>{formatYear(media.releaseDate)}</span>
            </div>
            {media.voteAverage > 0 && (
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                ⭐ {media.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Subtle border shine effect */}
        <div className="absolute inset-0 border border-white/0 group-hover/card:border-white/20 rounded-2xl transition-colors duration-300" />
=======

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
>>>>>>> 15ec46204cab2ad0a8e3fbb48c9f120c5a8625ed
      </div>
    </div>
  );
}
