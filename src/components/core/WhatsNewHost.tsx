import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { APP_VERSION, getWhatsNewSince } from '../../lib/whats-new';
import { WhatsNewModal } from './WhatsNewModal';

/**
 * Affiche la modale Nouveautés une fois par utilisateur et par version.
 */
export function WhatsNewHost() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [releases, setReleases] = useState(() => getWhatsNewSince(null));

  useEffect(() => {
    if (!token || !user?.id) {
      setOpen(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const fresh = await api.getUser(user.id);
        if (cancelled) return;
        const lastSeen = fresh?.last_seen_app_version ?? null;
        patchUser({ last_seen_app_version: lastSeen });
        const next = getWhatsNewSince(lastSeen);
        setReleases(next);
        setOpen(next.length > 0);
      } catch {
        if (cancelled) return;
        const lastSeen = user.last_seen_app_version ?? null;
        const next = getWhatsNewSince(lastSeen);
        setReleases(next);
        setOpen(next.length > 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user?.id, patchUser]);

  const handleDismiss = useCallback(async () => {
    if (!user?.id) {
      setOpen(false);
      return;
    }
    setIsSaving(true);
    try {
      await api.updateUser(user.id, { last_seen_app_version: APP_VERSION });
      patchUser({ last_seen_app_version: APP_VERSION });
    } catch {
      // On ferme quand même pour ne pas bloquer l'UI
    } finally {
      setIsSaving(false);
      setOpen(false);
    }
  }, [user?.id, patchUser]);

  return (
    <WhatsNewModal
      isOpen={open}
      releases={releases}
      onDismiss={handleDismiss}
      isSaving={isSaving}
    />
  );
}
