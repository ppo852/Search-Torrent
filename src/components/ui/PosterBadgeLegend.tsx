import { PosterBadgeChip } from './PosterBadgeChip';
import { POSTER_BADGE_LEGEND } from '../../lib/poster-badge';

/** Légende compacte des badges pochettes (une fois sur Découvrir). */
export function PosterBadgeLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`px-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-500">
        <span className="font-black uppercase tracking-widest text-gray-600 shrink-0">
          Légende
        </span>
        {POSTER_BADGE_LEGEND.map(({ badge, hint }) => (
          <div key={badge.type} className="flex items-center gap-2 min-w-0">
            <PosterBadgeChip badge={badge} className="shadow-none shrink-0" />
            <span className="truncate">{hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
