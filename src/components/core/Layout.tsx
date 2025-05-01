import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LogOut, Search, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <Link
                to="/search"
                className="text-gray-300 hover:text-white transition-colors flex items-center space-x-2"
              >
                <Search size={20} />
                <span className="font-medium">Recherche</span>
              </Link>
              {user?.is_admin && (
                <Link
                  to="/admin"
                  className="text-gray-300 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Settings size={20} />
                  <span className="font-medium">Administration</span>
                </Link>
              )}
            </div>
            
            <div className="flex items-center space-x-6">
              <span className="text-gray-300 font-medium">{user?.username}</span>
              <button
                onClick={handleLogout}
                className="text-gray-300 hover:text-white transition-colors"
                title="Déconnexion"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}