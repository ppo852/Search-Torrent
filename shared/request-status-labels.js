function isTvMediaType(mediaType) {
  return mediaType === 'tv' || mediaType === 'anime';
}

/** @type {Record<string, { label: string, className: string }>} */
const STATUS_MAP = {
  monitoring: {
    label: 'En attente',
    className: 'bg-black/75 backdrop-blur-md text-gray-300 border-white/25 shadow-lg',
  },
  sent_to_qbit: {
    label: 'En Scan',
    className: 'bg-black/75 backdrop-blur-md text-violet-300 border-violet-400/50 shadow-lg',
  },
  pending: {
    label: 'En attente',
    className: 'bg-black/75 backdrop-blur-md text-gray-300 border-white/25 shadow-lg',
  },
  found: {
    label: 'En Scan',
    className: 'bg-black/75 backdrop-blur-md text-violet-300 border-violet-400/50 shadow-lg',
  },
  error: {
    label: 'Erreur',
    className: 'bg-black/75 backdrop-blur-md text-red-300 border-red-400/50 shadow-lg',
  },
  completed: {
    label: 'Complet',
    className: 'bg-black/75 backdrop-blur-md text-green-300 border-green-400/50 shadow-lg',
  },
  already_available: {
    label: 'Complet',
    className: 'bg-black/75 backdrop-blur-md text-green-300 border-green-400/50 shadow-lg',
  },
  downloading: {
    label: 'En cours',
    className: 'bg-black/75 backdrop-blur-md text-sky-300 border-sky-400/50 shadow-lg',
  },
};

/**
 * @param {string | null | undefined} status
 * @param {string | null | undefined} [mediaType]
 * @returns {{ label: string, className: string }}
 */
export function getRequestStatusBadge(status, mediaType) {
  if (!status) {
    return { label: 'Inconnu', className: 'bg-black/75 backdrop-blur-md text-gray-400 border-white/20 shadow-lg' };
  }

  if (isTvMediaType(mediaType) && (status === 'sent_to_qbit' || status === 'found' || status === 'downloading')) {
    return STATUS_MAP.downloading;
  }

  if (!isTvMediaType(mediaType) && status === 'downloading') {
    return STATUS_MAP.sent_to_qbit;
  }

  return STATUS_MAP[status] || {
    label: status.replace(/_/g, ' '),
    className: 'bg-black/75 backdrop-blur-md text-gray-300 border-white/20 shadow-lg',
  };
}

/**
 * @param {string[]} statuses
 * @returns {string}
 */
export function aggregateSeasonStatuses(statuses) {
  const list = statuses.filter(Boolean);
  if (list.length === 0) return 'monitoring';

  const unique = new Set(list);
  if (unique.has('error')) return 'error';

  const done = (s) => s === 'completed' || s === 'already_available';
  if (list.every(done)) return 'completed';

  if (
    unique.has('downloading') ||
    unique.has('sent_to_qbit') ||
    unique.has('found') ||
    list.some(done)
  ) {
    return 'downloading';
  }

  if (unique.has('monitoring') || unique.has('pending')) return 'monitoring';
  return list[0] || 'monitoring';
}
