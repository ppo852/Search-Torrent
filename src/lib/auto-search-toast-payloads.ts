import { formatRequestErrorMessage } from './request-error-messages.ts';

export type AutoSearchToastPayload = {
  variant: 'success' | 'info' | 'error';
  message: string;
};

export type MovieAutoSearchResult = {
  status?: string;
  error?: string;
};

export type TvAutoSearchResult = {
  status?: string;
  error?: string;
  episode?: number;
  downloadedCount?: number;
  mode?: string;
  episodes?: number[];
};

type TvNotifyOptions = {
  episodeNumber?: number;
  seasonNumber?: number;
};

export function getMovieAutoSearchToastPayload(
  result: MovieAutoSearchResult | null | undefined
): AutoSearchToastPayload | null {
  const status = result?.status;
  if (!status) return null;

  switch (status) {
    case 'sent':
      return { variant: 'success', message: 'Torrent trouvé et envoyé !' };

    case 'no_results':
      return {
        variant: 'info',
        message: 'Aucun torrent pour l’instant — nouvel essai automatique plus tard.',
      };

    case 'already_sent':
      return { variant: 'info', message: 'Un téléchargement est déjà en cours dans qBittorrent.' };

    case 'already_available':
      return { variant: 'info', message: 'Déjà présent dans la bibliothèque.' };

    case 'error':
      return {
        variant: 'error',
        message: formatRequestErrorMessage(result?.error) || 'La recherche automatique a échoué.',
      };

    case 'not_found':
      return { variant: 'error', message: 'Demande introuvable.' };

    default:
      return null;
  }
}

export function getTvAutoSearchToastPayload(
  result: TvAutoSearchResult | null | undefined,
  options: TvNotifyOptions = {}
): AutoSearchToastPayload | null {
  const status = result?.status;
  if (!status) return null;

  const ep = options.episodeNumber ?? result?.episode;
  const season = options.seasonNumber;
  const epLabel = ep != null ? `E${ep}` : 'épisode';

  switch (status) {
    case 'sent_episode':
      return { variant: 'success', message: `Torrent trouvé et envoyé pour ${epLabel} !` };

    case 'sent_season_pack':
      return {
        variant: 'success',
        message: season != null
          ? `Pack saison ${season} trouvé et envoyé !`
          : 'Pack saison trouvé et envoyé !',
      };

    case 'sent_batch': {
      const count = result?.downloadedCount ?? 0;
      if (count <= 0) {
        return {
          variant: 'info',
          message: season != null
            ? `Aucun épisode envoyé pour la saison ${season}.`
            : 'Aucun épisode envoyé.',
        };
      }
      if (count === 1) {
        return {
          variant: 'success',
          message: season != null
            ? `1 épisode envoyé pour la saison ${season}.`
            : '1 épisode envoyé.',
        };
      }
      return {
        variant: 'success',
        message: season != null
          ? `${count} épisodes envoyés pour la saison ${season}.`
          : `${count} épisodes envoyés.`,
      };
    }

    case 'no_results':
      if (ep != null) {
        return {
          variant: 'info',
          message: `Aucun torrent pour l’instant (${epLabel}) — nouvel essai automatique plus tard.`,
        };
      }
      return {
        variant: 'info',
        message: season != null
          ? `Aucun torrent pour l’instant (saison ${season}) — nouvel essai automatique plus tard.`
          : 'Aucun torrent pour l’instant — nouvel essai automatique plus tard.',
      };

    case 'already_present':
      return {
        variant: 'info',
        message: ep != null ? `Épisode ${ep} déjà présent.` : 'Déjà présent dans la bibliothèque.',
      };

    case 'completed_season':
      return {
        variant: 'info',
        message: season != null
          ? `Saison ${season} déjà complète.`
          : 'Saison déjà complète.',
      };

    case 'not_aired':
      if (ep != null) {
        return { variant: 'info', message: `Épisode ${ep} pas encore diffusé.` };
      }
      return {
        variant: 'info',
        message: season != null
          ? `Aucun épisode diffusé à télécharger pour la saison ${season}.`
          : 'Épisode pas encore diffusé.',
      };

    case 'already_in_qbit':
      return {
        variant: 'info',
        message: result?.mode === 'pack'
          ? 'Un pack saison est déjà dans qBittorrent.'
          : 'Un téléchargement est déjà en cours dans qBittorrent.',
      };

    case 'already_sent':
      return { variant: 'info', message: 'Un envoi est déjà en cours pour cette demande.' };

    case 'already_in_history':
      return { variant: 'info', message: `Épisode ${ep ?? '?'} déjà en cours de traitement.` };

    case 'error':
      return {
        variant: 'error',
        message: formatRequestErrorMessage(result?.error) || 'La recherche automatique a échoué.',
      };

    default:
      return null;
  }
}
