import { create } from 'zustand';
import { api } from '../services/api';
import { queryClient } from '../lib/queryClient';

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  allow_force_interactive_download?: boolean;
  qbit_url?: string;
  last_seen_app_version?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  patchUser: (partial: Partial<User>) => void;
}

// Récupérer l'utilisateur du localStorage au démarrage
const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('auth_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,

  login: async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);

      if (!response) {
        return false;
      }

      const { token, user } = response;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rss-feeds'] }),
        queryClient.invalidateQueries({ queryKey: ['rss-items'] }),
        queryClient.invalidateQueries({ queryKey: ['library', 'request-status'] }),
      ]);

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        token,
        user: {
          id: user.id,
          username: user.username,
          is_admin: user.is_admin,
          allow_force_interactive_download: !!user.allow_force_interactive_download,
          qbit_url: user.qbit_url,
          last_seen_app_version: user.last_seen_app_version ?? null,
        },
      });

      return true;
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return false;
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
