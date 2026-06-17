import { NavLink, useLocation } from 'react-router-dom';
import { Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSearchStore } from '../../stores/searchStore';
import { navigation, handleNavItemClick } from './navigation';

interface MobileBottomNavProps {
  inIframe?: boolean;
}

export function MobileBottomNav({ inIframe = false }: MobileBottomNavProps) {
  const { user, logout } = useAuthStore();
  const { resetSearch } = useSearchStore();
  const location = useLocation();

  return (
    <nav
      className={`lg:hidden fixed left-0 right-0 w-full h-auto bg-gray-950/80 backdrop-blur-3xl border-t border-white/5 z-[100] flex items-start justify-around px-2 pt-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] ${
        inIframe ? 'bottom-14' : 'bottom-0'
      }`}
    >
      {navigation.map((item) => (
        <NavLink
          key={item.name}
          to={item.href}
          onClick={() => handleNavItemClick(item.href, resetSearch)}
          className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1.5 w-16 h-14 rounded-xl transition-all duration-300
              ${isActive ? 'text-blue-500' : 'text-gray-500 hover:text-white'}
            `}
        >
          <item.icon size={22} className={location.pathname === item.href ? 'scale-110' : ''} />
          <span className="text-[8px] font-black uppercase tracking-widest">{item.name}</span>
        </NavLink>
      ))}
      {user?.is_admin && (
        <NavLink
          to="/admin"
          className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1.5 w-16 h-14 rounded-xl transition-all duration-300
              ${isActive ? 'text-violet-500' : 'text-gray-500 hover:text-white'}
            `}
        >
          <Settings size={22} />
          <span className="text-[8px] font-black uppercase tracking-widest">ADMIN</span>
        </NavLink>
      )}
      <button
        onClick={logout}
        className="flex flex-col items-center justify-center gap-1.5 w-16 h-14 text-gray-500 hover:text-red-500 rounded-xl transition-all duration-300"
      >
        <LogOut size={22} />
        <span className="text-[8px] font-black uppercase tracking-widest">OFF</span>
      </button>
    </nav>
  );
}
