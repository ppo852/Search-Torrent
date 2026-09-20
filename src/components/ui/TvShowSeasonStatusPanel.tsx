import type { TvSeasonStatusRow } from '../../services/api/api';
import { formatEpisodeRange } from '../../lib/format-episode-range';
import { getRequestStatusBadge } from '../../lib/request-status-labels';

interface TvShowSeasonStatusPanelProps {
  rows: TvSeasonStatusRow[];
  /** `tv` ou `anime` — pour les libellés de statut demande */
  mediaType?: 'tv' | 'anime';
}

/** Chip Emby : « Ép. 1 à 2 sur Emby » / « Sur Emby » */
function embyLabel(row: TvSeasonStatusRow): string | null {
  if (!row.in_library) return null;
  if (row.complete) return 'Disponible sur Emby';
  const range = formatEpisodeRange(row.present_episodes);
  return range ? `${range} sur Emby` : 'Sur Emby';
}

function requestBadge(row: TvSeasonStatusRow, mediaType: 'tv' | 'anime') {
  if (!row.requested || row.complete) return null;
  if (row.request_status) {
    return getRequestStatusBadge(row.request_status, mediaType);
  }
  return { label: 'Demandé', className: 'bg-black/75 backdrop-blur-md text-gray-300 border-white/25 shadow-lg' };
}

export function TvShowSeasonStatusPanel({ rows, mediaType = 'tv' }: TvShowSeasonStatusPanelProps) {
  const visible = rows
    .filter((r) => r.in_library || r.requested)
    .sort((a, b) => a.season_number - b.season_number);

  if (visible.length === 0) return null;

  return (
    <div className="mt-8 space-y-3">
      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
        Bibliothèque & demandes
      </h3>
      <ul className="flex flex-wrap gap-2">
        {visible.map((row) => {
          const reqBadge = requestBadge(row, mediaType);
          const emby = embyLabel(row);

          return (
            <li
              key={row.season_number}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider"
            >
              <span className="text-gray-400 shrink-0">S{row.season_number}</span>
              {reqBadge && (
                <span
                  className={`px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${reqBadge.className}`}
                >
                  {reqBadge.label}
                </span>
              )}
              {emby && (
                <span
                  className={`px-1.5 py-0.5 rounded-md border text-[9px] tracking-wider ${
                    row.complete
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                  }`}
                >
                  {emby}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
