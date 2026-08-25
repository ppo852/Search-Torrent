export type PosterBadge =
  | { type: 'requested'; label: string }
  | { type: 'in_library'; label: string }
  | { type: 'series_complete'; label: string }
  | { type: 'series_partial'; label: string };

export const POSTER_BADGE_CLASS: Record<PosterBadge['type'], string> = {
  requested: 'bg-black/70 backdrop-blur-md border-blue-500/30 text-blue-300',
  in_library: 'bg-black/70 backdrop-blur-md border-emerald-500/30 text-emerald-300',
  series_complete: 'bg-black/70 backdrop-blur-md border-emerald-500/30 text-emerald-300',
  series_partial: 'bg-black/70 backdrop-blur-md border-amber-500/40 text-amber-300',
};

export function posterBadgeTitle(badge: PosterBadge): string {
  if (badge.type === 'requested') return 'Demande en cours';
  if (badge.type === 'series_complete') return 'Série terminée et complète';
  if (badge.type === 'series_partial') return 'Série incomplète';
  return badge.label;
}
