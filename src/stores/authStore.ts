import { create } from 'zustand';
import { api } from '../services/api';
import { queryClient } from '../lib/queryClient';
import type { SessionUser } from '../types';

interface AuthState {
  user: SessionUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithOrganizr: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  syncOrganizrSession: () => Promise<'noop' | 'same' | 'switched' | 'logout'>;
  logout: () => void;
  patchUser: (partial: Partial<SessionUser>) => void;
}

function toSessionUser(user: any): SessionUser {
  return {
    id: user.id,
    username: user.username,
    is_admin: user.is_admin,
    allow_force_interactive_download: !!user.allow_force_interactive_download,
    qbit_url: user.qbit_url,
    last_seen_app_version: user.last_seen_app_version ?? null,
    auth_via: user.auth_via === 'organizr' ? 'organizr' : 'password',
  };
}

async function refreshPostLoginQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['rss-feeds'] }),
    queryClient.invalidateQueries({ queryKey: ['rss-items'] }),
    queryClient.invalidateQueries({ queryKey: ['library', 'request-status'] }),
  ]);
}

function applySession(token: string, user: any, set: (partial: Partial<AuthState>) => void) {
  const sessionUser = toSessionUser(user);
  localStorage.setItem('auth_token', token);
  localStorage.setItem('user', JSON.stringify(sessionUser));
  set({ token, user: sessionUser });
}

const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('auth_token');

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,

  login: async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      if (!response) return false;

      const { token, user } = response;
      await refreshPostLoginQueries();
      applySession(token, user, set);
      return true;
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return false;
    }
  },

  loginWithOrganizr: async () => {
    try {
      const result = await api.loginWithOrganizr();
      if (!result.ok) {
        return { ok: false as const, error: result.error, code: result.code };
      }

      await refreshPostLoginQueries();
      applySession(result.token, result.user, set);
      return { ok: true as const };
    } catch (error) {
      console.error('Erreur SSO Organizr:', error);
      return { ok: false as const, error: 'Erreur de connexion au serveur' };
    }
  },

  syncOrganizrSession: async () => {
    const { user, token } = get();
    if (!token || user?.auth_via !== 'organizr') {
      return 'noop';
    }

    try {
      const result = await api.syncOrganizrSession();

      if (result.action === 'switched' && result.token && result.user) {
        await refreshPostLoginQueries();
        applySession(result.token, result.user, set);
        return 'switched';
      }

      if (result.action === 'logout') {
        get().logout();
        return 'logout';
      }

      return result.action === 'same' ? 'same' : 'noop';
    } catch (error) {
      console.error('Erreur sync SSO Organizr:', error);
      return 'noop';
    }
  },

  logout: () => {
    queryClient.invalidateQueries({ queryKey: ['rss-feeds'] });
    queryClient.invalidateQueries({ queryKey: ['rss-items'] });
    queryClient.removeQueries({ queryKey: ['library', 'request-status'] });

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');

    set({ user: null, token: null });
  },

  patchUser: (partial) => {
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, ...partial };
      localStorage.setItem('user', JSON.stringify(user));
      return { user };
    });
  },
}));
