import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from './MediaCard';
import type { TmdbResult } from '../../types';

interface MediaSectionProps {
  title: string;
  items: TmdbResult[];
  onMediaClick: (media: TmdbResult) => void;
}

export function MediaSection({ title, items, onMediaClick }: MediaSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -800 : 800;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-12 relative group">
      <h2 className="text-2xl font-bold text-white mb-6 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-gradient-to-b before:from-blue-500 before:to-purple-600 before:rounded">
        {title}
      </h2>
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Précédent"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Suivant"
      >
        <ChevronRight size={24} />
      </button>
      <div ref={scrollRef} className="overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex gap-4 px-4" style={{ width: 'max-content' }}>
          {items.map((media) => (
            <MediaCard
              key={`${media.type}-${media.id}`}
              media={media}
              onClick={onMediaClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
