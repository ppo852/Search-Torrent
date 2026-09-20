const EVENT_LABELS: Record<string, string> = {
  'auth.login_success': 'Connexion réussie',
  'auth.login_failed': 'Échec de connexion',
  'auth.organizr_sso_success': 'Connexion Organizr (SSO)',
  'auth.organizr_sso_not_provisioned': 'SSO Organizr — compte Search absent',
  'request.movie_created': 'Demande film créée',
  'request.movie_deleted': 'Demande film supprimée',
  'request.tv_season_created': 'Demande saison créée',
  'request.tv_season_deleted': 'Demande saison supprimée',
  'qbit.sent': 'Envoyé à qBittorrent',
  'auto_search.error': 'Erreur recherche auto',
  'download.blocked_inventory': 'Téléchargement bloqué (Emby)',
};

export function getActivityEventLabel(eventType?: string | null): string {
  if (!eventType) return 'Événement';
  return EVENT_LABELS[eventType] || eventType.replace(/[._]/g, ' ');
}

export function formatActivityDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;

  const d = details as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof d.torrent_name === 'string' && d.torrent_name.trim()) {
    parts.push(`Torrent : ${d.torrent_name.trim()}`);
  } else if (typeof d.matched_torrent_name === 'string' && d.matched_torrent_name.trim()) {
    parts.push(`Torrent : ${d.matched_torrent_name.trim()}`);
  }

  if (typeof d.details === 'string' && d.details.trim()) {
    parts.push(d.details.trim());
  } else if (typeof d.message === 'string' && d.message.trim()) {
    parts.push(d.message.trim());
  }

  if (d.episode != null && d.episode !== '') {
    parts.push(`Épisode ${d.episode}`);
  }

  if (typeof d.kind === 'string' && d.kind.trim() && parts.length === 0) {
    const kindLabels: Record<string, string> = {
      movie: 'Film',
      media_request: 'Film',
      tv_season: 'Saison',
      tv: 'Série',
      anime: 'Anime',
      animation: 'Animation',
    };
    parts.push(kindLabels[d.kind] || d.kind);
  }

  if (d.forced === true) {
    parts.push('Forcé');
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
