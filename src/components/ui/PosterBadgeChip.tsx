import type { PosterBadge } from '../../lib/poster-badge';
import { POSTER_BADGE_CLASS, posterBadgeTitle } from '../../lib/poster-badge';

interface PosterBadgeChipProps {
  badge: PosterBadge;
  className?: string;
}

export function PosterBadgeChip({ badge, className = '' }: PosterBadgeChipProps) {
  return (
    <div
      className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider truncate shadow-lg ${POSTER_BADGE_CLASS[badge.type]} ${className}`}
      title={posterBadgeTitle(badge)}
    >
      {badge.label}
    </div>
  );
}
