import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { isAlreadyPresentConflict } from './request-conflict';

export { isAlreadyPresentConflict };

/**
 * Relit le droit de forçage côté serveur et synchronise le store auth si besoin.
 */
export async function resolveForceDownloadPermission(options: {
  userId?: string | null;
  canForce: boolean;
}): Promise<boolean> {
  let canForceLive = options.canForce;
  if (!options.userId) return canForceLive;

  try {
    const freshUser = await api.getUser(options.userId);
    canForceLive = !!freshUser?.allow_force_interactive_download;
    if (canForceLive !== options.canForce) {
      useAuthStore.getState().patchUser({
        allow_force_interactive_download: canForceLive,
      });
    }
  } catch {
    // Garder la valeur locale si la relecture échoue
  }

  return canForceLive;
}
