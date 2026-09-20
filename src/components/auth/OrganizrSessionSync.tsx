import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

/**
 * Si la session vient d’Organizr (SSO) :
 * - cookie absent / invalide → déconnexion Search
 * - autre utilisateur Organizr → bascule de session
 * Login MP Search : aucun effet.
 */
export function OrganizrSessionSync({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const authVia = useAuthStore((s) => s.user?.auth_via);
  const syncOrganizrSession = useAuthStore((s) => s.syncOrganizrSession);
  const navigate = useNavigate();
  const [ready, setReady] = useState(() => authVia !== 'organizr');

  useEffect(() => {
    if (!token || authVia !== 'organizr') {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    (async () => {
      const action = await syncOrganizrSession();
      if (cancelled) return;

      if (action === 'logout') {
        navigate('/login', { replace: true });
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, authVia, syncOrganizrSession, navigate]);

  if (!ready) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Vérification session…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
