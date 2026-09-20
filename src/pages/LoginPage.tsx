import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { LogIn, User, Lock, Eye, EyeOff } from 'lucide-react';
import packageJson from '../../package.json';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ssoChecking, setSsoChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);
  const loginWithOrganizr = useAuthStore((state) => state.loginWithOrganizr);
  const navigate = useNavigate();

  // SSO silencieux : cookie Organizr déjà présent → session Search, sinon formulaire MP.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await api.getOrganizrSsoStatus();
        if (cancelled) return;

        if (!status.enabled) {
          setSsoChecking(false);
          return;
        }

        const result = await loginWithOrganizr();
        if (cancelled) return;

        if (result.ok) {
          navigate('/');
          return;
        }

        if (result.code === 'ORGANIZR_USER_NOT_PROVISIONED') {
          setError(result.error);
        }
      } catch {
        // formulaire classique
      } finally {
        if (!cancelled) setSsoChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loginWithOrganizr, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Identifiants incorrects');
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-outfit">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-[pulse_1.6s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-[pulse_1.6s_ease-in-out_infinite] [animation-delay:0.8s]" />
      </div>

      <div className="animate-premium-fade max-w-md w-full z-10">
        <div className="p-10 space-y-10 rounded-[2rem] bg-transparent">
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-2xl bg-blue-600 shadow-[0_0_28px_rgba(37,99,235,0.45)] rotate-3 hover:rotate-0 transition-transform duration-500 animate-[pulse_1.6s_ease-in-out_infinite]">
              <span className="text-white font-black text-3xl italic leading-none">S</span>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
                Search<span className="text-blue-500">Torrent</span>
              </h1>
              <p className="text-blue-400/70 font-bold text-xs uppercase tracking-[0.2em] mt-2">
                Accès privé
              </p>
            </div>
          </div>

          {ssoChecking ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-8 w-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              <p className="text-xs font-bold text-blue-400/70 uppercase tracking-widest">
                Connexion…
              </p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 animate-shake text-center">
                  <span className="text-sm text-red-400 font-bold">{error}</span>
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-1">Utilisateur</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-blue-400/50 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-white placeholder-blue-300/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-blue-600/15 focus:border-blue-500/40 transition-all font-medium [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#0a1220] [&:-webkit-autofill]:[caret-color:white]"
                      placeholder="Votre identifiant"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-1">Mot de passe</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-blue-400/50 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-12 pr-12 py-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-white placeholder-blue-300/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-blue-600/15 focus:border-blue-500/40 transition-all font-medium [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#0a1220] [&:-webkit-autofill]:[caret-color:white]"
                      placeholder="••••••••"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-blue-400/50 hover:text-blue-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-[0.2em] shadow-[0_12px_40px_rgba(37,99,235,0.35)] hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>SE CONNECTER <LogIn size={18} /></>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-white/50 font-black uppercase tracking-widest">
          Connexion sécurisée • v{packageJson.version}
        </p>
      </div>
    </div>
  );
}
