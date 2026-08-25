import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { showErrorToast, showInfoToast, showToast, isSoftApiError, getApiErrorMessage } from '../stores/toastStore';

export interface InteractiveDownloadParams {
  url: string;
  name?: string;
  itemCategory?: string;
  categoryId?: number;
  mediaType?: 'movie' | 'tv' | 'anime' | 'animation' | 'music' | 'books';
  searchContext?: 'software';
  tags?: string[];
  /** TMDB de la fiche (pochette) — anti-doublon fiable */
  tmdbId?: number;
  /** Contexte explicite (pack saison sans SxxEyy dans le nom) */
  seasonNumber?: number;
  episodeNumber?: number;
}

export function useInteractiveTorrentDownload() {
  const userId = useAuthStore((s) => s.user?.id);
  const canForce = useAuthStore((s) => !!s.user?.allow_force_interactive_download);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState<InteractiveDownloadParams | null>(null);
  const [pendingName, setPendingName] = useState('');

  const download = useCallback(async (params: InteractiveDownloadParams, force = false) => {
    try {
      await api.addTorrentWithCategory(
        params.url,
        params.name,
        params.itemCategory,
        params.categoryId,
        params.mediaType,
        params.tags,
        force,
        params.searchContext,
        params.tmdbId,
        params.seasonNumber,
        params.episodeNumber
      );
      showToast('Envoi vers qBittorrent réussi !');
      return true;
    } catch (error: any) {
      const isDuplicate = isSoftApiError(error) && (error?.status === 409 || /déjà présent/i.test(getApiErrorMessage(error, '')));

      let canForceLive = canForce;
      if (isDuplicate && !force && userId) {
        try {
          const freshUser = await api.getUser(userId);
          canForceLive = !!freshUser?.allow_force_interactive_download;
          if (canForceLive !== canForce) {
            useAuthStore.getState().patchUser({
              allow_force_interactive_download: canForceLive,
            });
          }
        } catch {
          // Garder la valeur locale si la relecture échoue
        }
      }

      if (isDuplicate && canForceLive && !force) {
        setPending(params);
        setPendingName(params.name || 'Ce fichier');
        setShowConfirm(true);
        return false;
      }

      if (isDuplicate) {
        showInfoToast('Ce média est déjà dans la médiathèque');
      } else {
        showErrorToast(getApiErrorMessage(error, 'Échec du transfert'));
      }
      return false;
    }
  }, [canForce, userId]);

  const handleConfirmForce = useCallback(async () => {
    if (!pending) return;
    const params = pending;
    setShowConfirm(false);
    setPending(null);
    await download(params, true);
  }, [pending, download]);

  const handleCloseConfirm = useCallback(() => {
    setShowConfirm(false);
    setPending(null);
  }, []);

  const confirmModal = (
    <ConfirmModal
      isOpen={showConfirm}
      title="Média déjà présent"
      message={`« ${pendingName} » semble déjà être dans la médiathèque (disque ou Emby). Voulez-vous quand même lancer le téléchargement ?`}
      confirmLabel="Forcer"
      cancelLabel="Annuler"
      onConfirm={handleConfirmForce}
      onClose={handleCloseConfirm}
      isDanger
    />
  );

  return { download, confirmModal };
}
