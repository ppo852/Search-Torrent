import { api } from '../api';
import { useAuthStore } from '../../stores/authStore';

interface GlobalSettings {
  prowlarr_url: string;
  prowlarr_api_key: string;
  tmdb_access_token: string;
  min_seeds: number;
  auto_search_interval_minutes: number;
  media_movies_path: string;
  media_series_path: string;
  media_scan_interval_minutes: number;
  media_requests_auto_delete_completed_after_hours: number;
}

class GlobalSettingsManager {
  private settings: Partial<GlobalSettings> = {
    prowlarr_url: '',
    prowlarr_api_key: '',
    tmdb_access_token: '',
    min_seeds: 3,
    auto_search_interval_minutes: 60,
    media_movies_path: '/media/Films',
    media_series_path: '/media/series',
    media_scan_interval_minutes: 30,
    media_requests_auto_delete_completed_after_hours: 24
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
      return this.settings;
    } catch (error) {
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
        min_seeds: settings.min_seeds,
        auto_search_interval_minutes: settings.auto_search_interval_minutes,
        media_movies_path: settings.media_movies_path,
        media_series_path: settings.media_series_path,
        media_scan_interval_minutes: settings.media_scan_interval_minutes,
        media_requests_auto_delete_completed_after_hours: settings.media_requests_auto_delete_completed_after_hours
      });
      this.settings = {
        ...this.settings,
        ...settings
      };
    } catch (error) {
 
      throw error;
    }
  }

  // Alias pour updateSettings pour une meilleure lisibilité
  async save(settings: Partial<GlobalSettings>): Promise<void> {
    return this.updateSettings(settings);
  }
}

export const globalSettings = new GlobalSettingsManager();

export default globalSettings;
