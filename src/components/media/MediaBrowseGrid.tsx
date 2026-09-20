import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MediaCard } from '../ui/MediaCard';
import type { TmdbResult } from '../../types';
import type { PosterBadge } from '../../lib/poster-badge';
import { buildMediaBrowseState } from '../../lib/media-browse';

type Props = {
  title: string;
  backTo?: string;
  backLabel?: string;
  items: TmdbResult[];
  isLoading?: boolean;
  emptyLabel?: string;
  /** Chemin courant (pour le state retour fiche). */
  browsePath: string;
  browseLabel: string;
  onMediaClick: (media: TmdbResult, returnState: ReturnType<typeof buildMediaBrowseState>) => void;
  getPosterBadges?: (media: TmdbResult) => PosterBadge | PosterBadge[] | null | undefined;
};

/**
 * Grille « Voir plus » réutilisable (listes TMDB films/séries, RSS à télécharger).
 */
export function MediaBrowseGrid({
  title,
  backTo = '/',
  backLabel = 'Découvrir',
  items,
  isLoading,
  emptyLabel = 'Aucun média',
  browsePath,
  browseLabel,
  onMediaClick,
  getPosterBadges,
}: Props) {
  return (
    <div className="space-y-8 animate-premium-fade">
      <div className="flex flex-wrap items-center gap-4 px-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase">
          {title}
        </h1>
      </div>

      {isLoading ? (
        <p className="px-4 text-gray-500 text-sm">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="px-4 text-gray-500 text-sm">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-4 pb-8">
          {items.map((media) => (
            <div key={`${media.type}-${media.id}`} className="w-full min-w-0 [&_.flex-shrink-0]:w-full">
              <MediaCard
                media={media}
                onClick={(m) =>
                  onMediaClick(m, buildMediaBrowseState(browsePath, browseLabel))
                }
                posterBadge={getPosterBadges?.(media) || null}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
