import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LogIn, User, Lock, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        navigate('/');
      } else {
        setError('Identifiants incorrects');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-outfit">
      {/* Premium Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] animate-pulse rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] animate-pulse rounded-full delay-1000" />
      </div>

      <div className="animate-premium-fade max-w-md w-full z-10">
        <div className="glass-card p-10 shadow-2xl border-white/5 space-y-10">
          <div className="text-center space-y-4">
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-2xl premium-gradient shadow-2xl shadow-blue-600/20 rotate-3 hover:rotate-0 transition-transform duration-500">
              <LogIn className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
                Search <span className="text-blue-500">Torrent</span>
              </h1>
              <p className="text-gray-500 font-bold text-xs uppercase tracking-[0.2em] mt-2">
                Accès Privé
              </p>
            </div>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 animate-shake text-center">
                <span className="text-sm text-red-400 font-bold">{error}</span>
              </div>
            )}
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Utilisateur</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/10 transition-all font-medium"
                    placeholder="Votre identifiant"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mot de passe</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-12 py-4 bg-white/5 border border-white/5 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/10 transition-all font-medium"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-1">
              <div className="relative flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                />
                <div className="h-5 w-5 border-2 border-white/10 rounded-md peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                   <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
              </div>
              <label htmlFor="remember-me" className="text-sm font-bold text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                Maintenir la session
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 premium-gradient text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>SE CONNECTER <LogIn size={18} /></>
              )}
            </button>
          </form>
        </div>
        
        <p className="mt-8 text-center text-[10px] text-gray-600 font-black uppercase tracking-widest">
          Système sécurisé par chiffrement AES-256 • v1.0.0
        </p>
      </div>
    </div>
  );
}