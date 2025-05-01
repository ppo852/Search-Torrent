import { api } from '../api';
import { useAuthStore } from '../../stores/authStore';

interface GlobalSettings {
  prowlarr_url: string;
  prowlarr_api_key: string;
  tmdb_access_token: string;
  min_seeds: number;
}

class GlobalSettingsManager {
  private settings: Partial<GlobalSettings> = {
    prowlarr_url: '',
    prowlarr_api_key: '',
    tmdb_access_token: '',
    min_seeds: 3
  };

  async load() {
    try {
      const user = useAuthStore.getState().user;
      let settings;

      if (user?.is_admin) {
        // Les admins utilisent la route admin
        settings = await api.getSettings();
      } else {
        // Les utilisateurs normaux utilisent la route publique
        settings = await api.getPublicSettings();
      }

      this.settings = {
        ...this.settings,
        ...settings
      };
      "console.log('Paramètres chargés pour:', user?.username);"
      return this.settings;
    } catch (error) {
      "console.error('Failed to load settings:', error);"
      throw error;
    }
  }

  getProwlarrSettings() {
    return {
      url: this.settings.prowlarr_url || '',
      apiKey: this.settings.prowlarr_api_key || ''
    };
  }

  getTmdbAccessToken(): string {
    return this.settings.tmdb_access_token || '';
  }

  getMinSeeds(): number {
    return this.settings.min_seeds ?? 3;
  }

  async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {      
    try {
      await api.updateSettings({
        prowlarr_url: settings.prowlarr_url,
        prowlarr_api_key: settings.prowlarr_api_key,
        tmdb_access_token: settings.tmdb_access_token,
        min_seeds: settings.min_seeds
      });
      this.settings = {
        ...this.settings,
        ...settings
      };
      "console.log('Paramètres mis à jour');"
    } catch (error) {
      "console.error('Failed to update settings:', error);" 
      throw error;
    }
  }

  // Alias pour updateSettings pour une meilleure lisibilité
  async save(settings: Partial<GlobalSettings>): Promise<void> {
    return this.updateSettings(settings);
  }
}

export const globalSettings = new GlobalSettingsManager();
