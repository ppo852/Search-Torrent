import type { TvSeasonStatusRow } from '../../services/api/api';
import { formatEpisodeRange } from '../../lib/format-episode-range';

interface TvShowSeasonStatusPanelProps {
  rows: TvSeasonStatusRow[];
}

function libraryLabel(row: TvSeasonStatusRow): string | null {
  if (!row.in_library) return null;
  if (row.complete) return 'Disponible sur Emby';
  return formatEpisodeRange(row.present_episodes);
}

export function TvShowSeasonStatusPanel({ rows }: TvShowSeasonStatusPanelProps) {
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
          const lib = libraryLabel(row);
          const showRequested = row.requested && !row.complete;

          return (
            <li
              key={row.season_number}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider"
            >
              <span className="text-gray-400 shrink-0">S{row.season_number}</span>
              {lib && (
                <span
                  className={`px-1.5 py-0.5 rounded-md border text-[9px] tracking-wider ${
                    row.complete
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                  }`}
                >
                  {lib}
                </span>
              )}
              {showRequested && (
                <span className="px-1.5 py-0.5 rounded-md border border-blue-500/40 text-blue-300 bg-blue-500/10 text-[9px] tracking-wider">
                  Demandé
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
