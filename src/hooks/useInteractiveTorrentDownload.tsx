import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export interface InteractiveDownloadParams {
  url: string;
  name?: string;
  itemCategory?: string;
  categoryId?: number;
  mediaType?: 'movie' | 'tv' | 'anime' | 'music' | 'books';
  searchContext?: 'software';
  tags?: string[];
}

interface UseInteractiveTorrentDownloadOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function useInteractiveTorrentDownload(options: UseInteractiveTorrentDownloadOptions = {}) {
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
        params.searchContext
      );
      options.onSuccess?.('Envoi vers qBittorrent réussi !');
      return true;
    } catch (error: any) {
      const isDuplicate =
        error?.status === 409 || error?.data?.error === 'Déjà présent dans la médiathèque';

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
        options.onError?.('Déjà présent dans la médiathèque');
      } else {
        options.onError?.(error?.data?.error || error?.message || 'Échec du transfert');
      }
      return false;
    }
  }, [canForce, options, userId]);

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
      message={`« ${pendingName} » semble déjà être dans la médiathèque. Voulez-vous quand même lancer le téléchargement ?`}
      confirmLabel="Forcer"
      cancelLabel="Annuler"
      onConfirm={handleConfirmForce}
      onClose={handleCloseConfirm}
      isDanger
    />
  );

  return { download, confirmModal };
}
