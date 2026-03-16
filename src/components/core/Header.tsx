import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSearchStore } from '../../stores/searchStore';
import { Settings, LogOut, Home, Download, Menu, X, Bookmark, Search } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuthStore();
  const { resetSearch } = useSearchStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      // Si nous sommes sur la page d'accueil, on réinitialise juste la recherche
      resetSearch();
    } else {
      // Sinon, on navigue vers l'accueil et on réinitialise la recherche
      resetSearch();
      navigate('/');
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo toujours visible */}
          <Link to="/" className="text-xl font-semibold text-white hover:text-gray-200 transition-colors">
            Search-Torrent
          </Link>

          {/* Bouton menu hamburger - visible uniquement sur mobile */}
          <button 
            className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Navigation desktop - masquée sur mobile */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={handleHomeClick}
              className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            >
              <Home size={20} />
              <span>Accueil</span>
            </button>
            {user && (
              <Link
                to="/new-torrent"
                className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              >
                <Search size={20} />
                <span>Recherche</span>
              </Link>
            )}
            {user && (
              <Link
                to="/library"
                className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              >
                <Bookmark size={20} />
                <span>Demandes</span>
              </Link>
            )}
            {user && (
              <Link
                to="/qbittorrent"
                className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              >
                <Download size={20} />
                <span>Gestionaire de Torrents</span>
              </Link>
            )}
          </div>

          {/* Informations utilisateur - masquées sur mobile */}
          <div className="hidden md:flex items-center gap-4">
            {user && (
              <>
                <span className="text-gray-300">
                  {user.username}
                  {user.is_admin && (
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                      Admin
                    </span>
                  )}
                </span>

                {user.is_admin && (
                  <Link
                    to="/admin"
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                    title="Paramètres administrateur"
                  >
                    <Settings size={20} />
                  </Link>
                )}

                <button
                  onClick={logout}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                  title="Déconnexion"
                >
                  <LogOut size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Menu mobile - visible uniquement quand ouvert */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-gray-700 animate-fade-in">
            <div className="flex flex-col gap-3">
              <button
                onClick={handleHomeClick}
                className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              >
                <Home size={20} />
                <span>Accueil</span>
              </button>
              {user && (
                <Link
                  to="/new-torrent"
                  className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Search size={20} />
                  <span>Recherche</span>
                </Link>
              )}
              {user && (
                <Link
                  to="/library"
                  className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Bookmark size={20} />
                  <span>Demandes</span>
                </Link>
              )}
              {user && (
                <Link
                  to="/qbittorrent"
                  className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Download size={20} />
                  <span>Gestionaire de Torrents</span>
                </Link>
              )}
              
              {/* Informations utilisateur et actions */}
              {user && (
                <div className="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">
                      {user.username}
                      {user.is_admin && (
                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                          Admin
                        </span>
                      )}
                    </span>
                    
                    <div className="flex items-center gap-3">
                      {user.is_admin && (
                        <Link
                          to="/admin"
                          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors"
                          title="Paramètres administrateur"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Settings size={22} />
                        </Link>
                      )}
                      
                      <button
                        onClick={() => {
                          logout();
                          setMobileMenuOpen(false);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors"
                        title="Déconnexion"
                      >
                        <LogOut size={22} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
