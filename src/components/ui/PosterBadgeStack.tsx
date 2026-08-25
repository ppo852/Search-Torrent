import type { PosterBadge } from '../../lib/poster-badge';
import { PosterBadgeChip } from './PosterBadgeChip';

interface PosterBadgeStackProps {
  badges: PosterBadge[];
  className?: string;
  chipClassName?: string;
}

export function PosterBadgeStack({ badges, className = '', chipClassName = '' }: PosterBadgeStackProps) {
  if (!badges.length) return null;

  return (
    <div
      className={`absolute top-2 right-2 z-30 flex flex-col items-end gap-1 max-w-[92%] pointer-events-none ${className}`}
    >
      {badges.map((badge, index) => (
        <PosterBadgeChip
          key={`${badge.type}-${index}`}
          badge={badge}
          className={`relative static max-w-full ${chipClassName}`}
        />
      ))}
    </div>
  );
}
