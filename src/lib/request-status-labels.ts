export interface RequestStatusBadge {
  label: string;
  className: string;
}

/** Libellés unifiés films / animations / séries / animes.
 * Contraste fort pour lecture sur pochettes (fond sombre opaque).
 */
const STATUS_MAP: Record<string, RequestStatusBadge> = {
  monitoring: {
    label: 'En recherche',
    className: 'bg-black/75 backdrop-blur-md text-sky-300 border-sky-400/50 shadow-lg',
  },
  // Envoyé à qBit, en attente de confirmation inventaire (scan / watcher)
  sent_to_qbit: {
    label: 'En cours',
    className: 'bg-black/75 backdrop-blur-md text-violet-300 border-violet-400/50 shadow-lg',
  },
  pending: {
    label: 'En attente',
    className: 'bg-black/75 backdrop-blur-md text-gray-300 border-white/25 shadow-lg',
  },
  found: {
    label: 'Trouvé',
    className: 'bg-black/75 backdrop-blur-md text-emerald-300 border-emerald-400/50 shadow-lg',
  },
  error: {
    label: 'Erreur',
    className: 'bg-black/75 backdrop-blur-md text-red-300 border-red-400/50 shadow-lg',
  },
  completed: {
    label: 'Terminé',
    className: 'bg-black/75 backdrop-blur-md text-green-300 border-green-400/50 shadow-lg',
  },
  already_available: {
    label: 'Disponible',
    className: 'bg-black/75 backdrop-blur-md text-emerald-300 border-emerald-400/50 shadow-lg',
  },
  downloading: {
    label: 'En cours',
    className: 'bg-black/75 backdrop-blur-md text-violet-300 border-violet-400/50 shadow-lg',
  },
};

export function getRequestStatusBadge(status?: string | null): RequestStatusBadge {
  if (!status) {
    return { label: 'Inconnu', className: 'bg-black/75 backdrop-blur-md text-gray-400 border-white/20 shadow-lg' };
  }
  return STATUS_MAP[status] || {
    label: status.replace(/_/g, ' '),
    className: 'bg-black/75 backdrop-blur-md text-gray-300 border-white/20 shadow-lg',
  };
}

export function aggregateSeasonStatuses(statuses: string[]): string {
  const unique = new Set(statuses.filter(Boolean));
  if (unique.has('error')) return 'error';
  if (unique.has('downloading')) return 'downloading';
  if (unique.has('monitoring')) return 'monitoring';
  if (unique.has('sent_to_qbit')) return 'sent_to_qbit';
  if (unique.has('pending')) return 'pending';
  if (unique.has('found')) return 'found';
  if (unique.has('already_available')) return 'already_available';
  if (unique.has('completed')) return 'completed';
  return statuses[0] || 'monitoring';
}
