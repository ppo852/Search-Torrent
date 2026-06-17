import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useSearchStore } from '../../stores/searchStore';
import { 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { useState } from 'react';
import packageJson from '../../../package.json';
import { MobileBottomNav } from './MobileBottomNav';
import { navigation, handleNavItemClick } from './navigation';

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function Sidebar({
  inIframe = false,
  navRouteKey = '',
}: {
  inIframe?: boolean;
  navRouteKey?: string;
}) {
  const { user, logout, token } = useAuthStore();
  const { resetSearch } = useSearchStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['system', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/system/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    },
    enabled: !!token,
    refetchInterval: 30000 // Rafraîchir toutes les 30s
  });

  return (
    <>
      {/* Sidebar Desktop */}
      <aside 
        className={`hidden lg:flex fixed top-0 left-0 h-full bg-gray-950/60 backdrop-blur-3xl border-r border-white/5 transition-all duration-500 z-50 flex-col ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Header / Logo */}
        <div className="p-8 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3 group">
               <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:rotate-12 transition-transform duration-500">
                  <span className="text-white font-black text-xl italic">S</span>
               </div>
               <span className="text-xl font-black text-white tracking-tighter uppercase leading-none">
                 Search<span className="text-blue-500">Torrent</span>
               </span>
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-gray-500 hover:text-white transition-all duration-300 shadow-xl"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-4 space-y-3 mt-6">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => handleNavItemClick(item.href, resetSearch)}
              className={({ isActive }) => `
                flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30 font-black' 
                  : 'text-gray-500 hover:bg-white/5 hover:text-white font-bold'}
              `}
            >
              <item.icon size={20} className={`shrink-0 transition-transform duration-500 ${!collapsed && 'group-hover:scale-110'}`} />
              {!collapsed && <span className="text-[11px] tracking-[0.2em]">{item.name}</span>}
              {location.pathname === item.href && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
              )}
            </NavLink>
          ))}

          {user?.is_admin && (
            <div className="pt-10">
              {!collapsed && <p className="px-5 mb-4 text-[9px] font-black text-gray-600 uppercase tracking-[0.4em]">ADMINISTRATION</p>}
              <NavLink
                to="/admin"
                className={({ isActive }) => `
                  flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group
                  ${isActive 
                    ? 'bg-violet-600 text-white shadow-2xl shadow-violet-600/30 font-black' 
                    : 'text-gray-500 hover:bg-white/5 hover:text-white font-bold'}
                `}
              >
                <Settings size={20} className="shrink-0 transition-transform duration-500 group-hover:rotate-90" />
                {!collapsed && <span className="text-[11px] tracking-[0.2em]">PARAMÈTRES</span>}
              </NavLink>
            </div>
          )}
        </nav>

        {/* System Stats Area */}
        {!collapsed && stats && (
          <div className="px-6 pb-6 space-y-4">
            <div className="glass-card p-4 space-y-4 border-white/5 bg-white/[0.02]">
              {/* Network Speeds */}
              {stats?.qbit && stats.qbit.status === 'online' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <ArrowDown size={10} strokeWidth={3} />
                      </div>
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Down</span>
                    </div>
                    <span className="text-[10px] font-black text-white truncate">{formatBytes(stats.qbit.dlSpeed)}/s</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-green-500/20 flex items-center justify-center text-green-400">
                        <ArrowUp size={10} strokeWidth={3} />
                      </div>
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Up</span>
                    </div>
                    <span className="text-[10px] font-black text-white truncate">{formatBytes(stats.qbit.upSpeed)}/s</span>
                  </div>
                </div>
              )}

              {/* Storage */}
              {stats?.disk && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <HardDrive size={11} className="text-gray-400" />
                      <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Stockage</span>
                    </div>
                    <span className="text-[9px] font-black text-white">{stats.disk.percentUsed}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${stats.disk.percentUsed > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${stats.disk.percentUsed}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight text-right">
                    {formatBytes(stats.disk.free)} libres
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Area */}
        <div className="p-4 md:p-6 border-t border-white/5 bg-gray-950/20">
          {!collapsed && user ? (
            <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-2.5 group hover:border-white/10 transition-all duration-500">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-black text-sm shadow-inner group-hover:scale-110 transition-transform duration-500 shrink-0">
                  {user.username.substring(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate">{user.username}</span>
                  <span className="text-[8px] text-blue-400 font-black uppercase tracking-widest mt-0.5">{user.is_admin ? 'Master Admin' : 'User'}</span>
                </div>
              </div>
              
              <button
                onClick={logout}
                title="Déconnexion"
                className="p-2 ml-2 text-gray-500 hover:text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-xl transition-all duration-300 shrink-0 group/logout"
              >
                <LogOut size={16} className="transition-transform group-hover/logout:-translate-x-0.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              title="Déconnexion"
              className="w-full flex items-center justify-center p-3 text-gray-500 hover:text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] rounded-xl transition-all duration-300"
            >
              <LogOut size={20} />
            </button>
          )}

          {!collapsed && (
            <div className="mt-4 flex justify-center">
              <span className="px-2 py-1 bg-white/5 border border-white/5 rounded-md text-[9px] font-black text-gray-500 tracking-widest cursor-default hover:text-white transition-colors">
                v{packageJson.version}
              </span>
            </div>
          )}
        </div>
      </aside>

      <MobileBottomNav key={navRouteKey} inIframe={inIframe} />
    </>
  );
}
