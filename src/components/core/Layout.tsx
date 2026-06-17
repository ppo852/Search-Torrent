import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { token } = useAuthStore();
  const location = useLocation();

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

  if (!token) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[100dvh] bg-gray-950 text-gray-100">
      <Sidebar inIframe={inIframe} navRouteKey={location.pathname} />

      <main className="flex-1 flex flex-col min-w-0 transition-all duration-500 pb-20 lg:pb-0 ml-0 lg:ml-20 xl:ml-72">
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
