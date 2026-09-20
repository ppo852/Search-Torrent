import { api } from '../api';
import { useAuthStore } from '../../stores/authStore';

interface GlobalSettings {
  prowlarr_url?: string;
  prowlarr_api_key?: string;
  tmdb_access_token?: string;
  tmdb_configured?: boolean;
  prowlarr_configured?: boolean;
  emby_configured?: boolean;
  emby_url?: string;
  emby_api_key?: string;
  emby_library_ids?: string[];
  emby_sync_interval_minutes?: number;
  calendar_api_key?: string;
  organizr_sso_enabled?: boolean | string;
  organizr_url?: string;
  organizr_auth_group?: string;
  min_seeds: number;
  auto_search_interval_minutes: number;
  media_scan_interval_minutes: number;
  media_requests_auto_delete_completed_after_hours: number;
}

class GlobalSettingsManager {
  private settings: Partial<GlobalSettings> = {
    min_seeds: 0,
    auto_search_interval_minutes: 60,
    media_scan_interval_minutes: 30,
    media_requests_auto_delete_completed_after_hours: 24
  };

  async load() {
    const user = useAuthStore.getState().user;
    let settings: Partial<GlobalSettings> | null = null;

    try {
      if (user?.is_admin) {
        settings = await api.getSettings();
      } else {
        settings = await api.getPublicSettings();
      }
    } catch {
      // Admin ou session partielle : les flags publics suffisent pour TMDB/Prowlarr côté UI
      settings = await api.getPublicSettings();
    }

    this.settings = {
      ...this.settings,
      ...settings,
    };
    return this.settings;
  }

  isTmdbConfigured(): boolean {
    return Boolean(
      this.settings.tmdb_configured ||
      (this.settings.tmdb_access_token && this.settings.tmdb_access_token.length > 0)
    );
  }

  isProwlarrConfigured(): boolean {
    return Boolean(
      this.settings.prowlarr_configured ||
      (this.settings.prowlarr_url && this.settings.prowlarr_api_key)
    );
  }

  getMinSeeds(): number {
    return this.settings.min_seeds ?? 0;
  }

  async updateSettings(settings: Partial<GlobalSettings>): Promise<void> {
    try {
      await api.updateSettings({
        prowlarr_url: settings.prowlarr_url,
        prowlarr_api_key: settings.prowlarr_api_key,
        tmdb_access_token: settings.tmdb_access_token,
        min_seeds: settings.min_seeds,
        auto_search_interval_minutes: settings.auto_search_interval_minutes,
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

  async save(settings: Partial<GlobalSettings>): Promise<void> {
    return this.updateSettings(settings);
  }
}

export const globalSettings = new GlobalSettingsManager();

export default globalSettings;
