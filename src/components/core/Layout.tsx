import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { ToastHost } from './ToastHost';
import { WhatsNewHost } from './WhatsNewHost';
import { useAuthStore } from '../../stores/authStore';
import { useLocation } from 'react-router-dom';
import { fetchRequestStatus } from '../../hooks/useRequestStatus';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { token } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [inIframe] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  // Organizr : éviter que fixed "perde" la barre après changement de route
  useEffect(() => {
    if (!inIframe) return;
    window.scrollTo(0, 0);
    const t = window.setTimeout(() => window.scrollTo(0, 0), 50);
    return () => window.clearTimeout(t);
  }, [inIframe, location.pathname]);

  // Précharge l'inventaire (badges pochettes) dès qu'on est connecté
  useEffect(() => {
    if (!token) return;
    queryClient.prefetchQuery({
      queryKey: ['library', 'request-status'],
      queryFn: fetchRequestStatus,
      staleTime: 30_000,
    });
  }, [token, queryClient]);

  if (!token) {
    return <>{children}</>;
  }

  const shellClass = inIframe
    ? 'flex flex-col lg:flex-row h-[100dvh] max-h-[100dvh] overflow-hidden bg-gray-950 text-gray-100'
    : 'flex min-h-[100dvh] bg-gray-950 text-gray-100';

  const mainClass = inIframe
    ? 'flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto transition-all duration-500 pb-0 lg:pb-0 ml-0 lg:ml-20 xl:ml-72'
    : 'flex-1 flex flex-col min-w-0 transition-all duration-500 pb-20 lg:pb-0 ml-0 lg:ml-20 xl:ml-72';

  return (
    <div className={shellClass}>
      <Sidebar inIframe={inIframe} navRouteKey={location.pathname} />

      <main className={mainClass}>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </main>
      <ToastHost />
      <WhatsNewHost />
    </div>
  );
}
