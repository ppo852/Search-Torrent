import { getRequestStatusBadge } from '../../lib/request-status-labels';

/** Statuts visibles sur la page Demandes (libellés utilisateur uniques). */
const REQUEST_STATUS_LEGEND: Array<{ status: string; mediaType?: string; hint: string }> = [
  { status: 'monitoring', hint: 'Demande suivie, pas encore trouvé' },
  { status: 'sent_to_qbit', mediaType: 'movie', hint: 'Trouvé / envoyé, en attente d’apparition' },
  { status: 'downloading', mediaType: 'tv', hint: 'Téléchargement ou suivi en cours' },
  { status: 'completed', hint: 'Terminé ou déjà disponible' },
  { status: 'error', hint: 'Échec du suivi ou de la recherche auto' },
];

/** Légende des badges de statut (page Demandes). */
export function RequestStatusLegend({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-500">
        <span className="font-black uppercase tracking-widest text-gray-600 shrink-0">
          Légende
        </span>
        {REQUEST_STATUS_LEGEND.map(({ status, mediaType, hint }) => {
          const badge = getRequestStatusBadge(status, mediaType);
          return (
            <div key={status} className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-block px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest shrink-0 ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="truncate">{hint}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
