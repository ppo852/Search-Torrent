import { useAuthStore } from '../../stores/authStore';
import { getCategoryLabel, normalizeQbitCategory, resolveQbitCategory } from '../../lib/categories';
import { RSS_HOME_HOURS } from '../../lib/rss-home';

export interface TvSeasonStatusRow {
  season_number: number;
  present_episodes: number[];
  present_count: number;
  expected_count: number;
  still_airing?: boolean;
  complete: boolean;
  partial: boolean;
  in_library: boolean;
  requested: boolean;
  request_status: string | null;
}

class API {
  private getHeaders() {
    const token = useAuthStore.getState().token;
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /** Auth seule (FormData : ne pas forcer Content-Type) */
  private getAuthHeaders() {
    const token = useAuthStore.getState().token;
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      console.warn('Session invalide ou expirée (HTTP 401). Déconnexion...');
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.message || errorBody.error || 'Une erreur est survenue';
      const err = new Error(message);
      (err as any).status = response.status;
      (err as any).data = errorBody;
      throw err;
    }

    return response;
  }

  async login(username: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    await this.handleResponse(response);
    return response.json();
  }

  /** Statut SSO Organizr (public) */
  async getOrganizrSsoStatus(): Promise<{ enabled: boolean; authGroup?: string }> {
    const response = await fetch('/api/auth/organizr-sso/status');
    if (!response.ok) {
      return { enabled: false };
    }
    return response.json();
  }

  async testOrganizrSso(): Promise<{ ok: boolean; message?: string; httpStatus?: number }> {
    const response = await fetch('/api/auth/organizr-sso/test', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  /**
   * SSO via cookie Organizr. Ne déclenche pas de logout global sur 401
   * (cookie absent = cas normal sur la page login).
   */
  async loginWithOrganizr(): Promise<
    | { ok: true; token: string; user: any }
    | { ok: false; status: number; error: string; code?: string }
  > {
    const response = await fetch('/api/auth/organizr-sso', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body.error || 'SSO Organizr impossible',
        code: body.code,
      };
    }

    return { ok: true, token: body.token, user: body.user };
  }

  /**
   * Resync session SSO (lié Organizr). Toujours 200 + action
   * pour ne pas déclencher le logout global sur 401.
   */
  async syncOrganizrSession(): Promise<{
    action: 'noop' | 'same' | 'switched' | 'logout';
    token?: string;
    user?: any;
    code?: string;
    error?: string;
  }> {
    const response = await fetch('/api/auth/organizr-sso/sync', {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async getUsers() {
    const response = await fetch('/api/users', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async autoSearchTvSeasonRequest(id: string) {
    const response = await fetch(`/api/library/tv/${id}/auto-search`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async autoSearchTvSeasonEpisodeRequest(id: string, payload: { episode_number: number }) {
    const response = await fetch(`/api/library/tv/${id}/auto-search-episode`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    await this.handleResponse(response);
    return response.json();
  }

  async createUser(username: string, password: string, is_admin: boolean) {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ username, password, is_admin }),
    });

    return this.handleResponse(response);
  }

  async getUser(userId: string) {
    const response = await fetch(`/api/users/${userId}`, {
      headers: this.getHeaders(),
    });

    await this.handleResponse(response);
    return response.json();
  }

  async updateUser(userId: string, updates: any) {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    await this.handleResponse(response);
    return response.json();
  }

  async deleteUser(userId: string) {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getSettings() {
    const response = await fetch('/api/settings/global', {
      headers: this.getHeaders(),
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getPublicSettings() {
    const response = await fetch('/api/settings/public', {
      headers: this.getHeaders(),
    });

    await this.handleResponse(response);
    return response.json();
  }

  async updateSettings(settings: any) {
    const response = await fetch('/api/settings/global', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });

    return this.handleResponse(response);
  }

  async generateCalendarApiKey() {
    const response = await fetch('/api/settings/calendar-api-key', {
      method: 'POST',
      headers: this.getHeaders(),
    });

    await this.handleResponse(response);
    return response.json() as Promise<{ calendar_api_key: string }>;
  }

  // Méthodes pour qBittorrent
  async getTorrents() {
    const response = await fetch('/api/qbittorrent/torrents', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async deleteTorrents(hashes: string[] | string, deleteFiles: boolean = false) {
    const hashList = Array.isArray(hashes) ? hashes : [hashes];
    const response = await fetch('/api/qbittorrent/delete', {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hashList, deleteFiles })
    });

    await this.handleResponse(response);
    return response.json().catch(() => ({}));
  }

  async reannounceTrackers(hash: string) {
    const response = await fetch('/api/qbittorrent/reannounce', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hash })
    });

    return this.handleResponse(response);
  }

  async recheckTorrent(hash: string) {
    const response = await fetch('/api/qbittorrent/recheck', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hash })
    });

    return this.handleResponse(response);
  }

  async exportTorrentFile(hash: string, name?: string) {
    const params = new URLSearchParams({ hash });
    if (name) params.set('name', name);
    const response = await fetch(`/api/qbittorrent/export?${params.toString()}`, {
      headers: this.getHeaders(),
    });

    await this.handleResponse(response);
    const blob = await response.blob();
    const safe =
      (name || hash)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\.torrent$/i, '')
        .trim()
        .slice(0, 120) || hash;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safe}.torrent`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async pauseTorrent(hash: string) {
    const response = await fetch('/api/qbittorrent/pause', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hash })
    });

    await this.handleResponse(response);
    return response.json().catch(() => ({}));
  }

  async resumeTorrent(hash: string) {
    const response = await fetch('/api/qbittorrent/resume', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hash })
    });

    await this.handleResponse(response);
    return response.json().catch(() => ({}));
  }

  async getQbitMainData(rid = 0) {
    const response = await fetch(`/api/qbittorrent/sync/maindata?rid=${rid}`, {
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async getQbitCategories() {
    const response = await fetch('/api/qbittorrent/categories', {
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async createQbitCategory(category: string) {
    const response = await fetch('/api/qbittorrent/createCategory', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ category }),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async addTorrentForm(options: {
    files?: File[];
    magnet?: string;
    category?: string;
    tags?: string;
  }) {
    const formData = new FormData();
    for (const file of options.files || []) {
      formData.append('torrents', file);
    }
    if (options.magnet) formData.append('magnet', options.magnet);
    if (options.category) formData.append('category', options.category);
    if (options.tags) formData.append('tags', options.tags);

    const response = await fetch('/api/qbittorrent/add', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    await this.handleResponse(response);
    return response.json();
  }

  async addTorrentUrl(url: string, options: {
    name?: string;
    category?: string;
    mediaType?: 'movie' | 'tv' | 'anime' | 'animation' | 'music' | 'books';
    tags?: string[];
    force?: boolean;
    tmdbId?: number;
    seasonNumber?: number;
    episodeNumber?: number;
  } = {}) {
    const category = (options.category || options.mediaType)
      ? resolveQbitCategory(options.category, options.mediaType) ?? undefined
      : undefined;

    const response = await fetch('/api/qbittorrent/add', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        urls: [url],
        name: options.name,
        force: !!options.force,
        tmdb_id: options.tmdbId || undefined,
        mediaType: options.mediaType || undefined,
        season_number: options.seasonNumber || undefined,
        episode_number: options.episodeNumber || undefined,
        options: {
          ...(category ? { category } : {}),
          tags: options.tags?.join(',')
        }
      })
    });

    return this.handleResponse(response);
  }

  /**
   * Ajoute un torrent avec catégorisation automatique
   */
  async addTorrentWithCategory(
    url: string,
    name?: string,
    itemCategory?: string,
    categoryId?: number,
    mediaType?: 'movie' | 'tv' | 'anime' | 'animation' | 'music' | 'books',
    tags?: string[],
    force?: boolean,
    searchContext?: 'software',
    tmdbId?: number,
    seasonNumber?: number,
    episodeNumber?: number
  ) {
    // Catégorie UI déjà canonique (ex. RSS « Animation ») prime sur tmdbType « movie »
    const category =
      normalizeQbitCategory(itemCategory) ||
      getCategoryLabel(categoryId, itemCategory, name, mediaType, searchContext);
    return this.addTorrentUrl(url, { name, category, tags, force, mediaType, tmdbId, seasonNumber, episodeNumber });
  }

  async addTorrentFile(file: File, options: { category?: string; tags?: string[] } = {}) {
    if (!file.name.endsWith('.torrent')) {
      throw new Error('Le fichier doit être un .torrent');
    }

    return this.addTorrentForm({
      files: [file],
      category: options.category,
      tags: options.tags?.join(','),
    });
  }

  async getLibrary() {
    const response = await fetch('/api/library', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async addLibraryItem(payload: {
    tmdb_id: number;
    media_type: 'movie' | 'tv' | 'anime' | 'animation';
    title: string;
    poster_url?: string | null;
    release_date?: string | null;
  }) {
    const response = await fetch('/api/library', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    await this.handleResponse(response);
    return response.json();
  }

  async deleteLibraryItem(id: string) {
    const response = await fetch(`/api/library/${id}`,
      {
        method: 'DELETE',
        headers: this.getHeaders()
      }
    );

    await this.handleResponse(response);
    return response.json();
  }

  async searchLibraryRequest(id: string) {
    const response = await fetch(`/api/library/${id}/search`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async selectLibraryRequest(
    id: string,
    payload: {
      name: string;
      link: string;
      size?: number;
      seeds?: number;
    }
  ) {
    const response = await fetch(`/api/library/${id}/select`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    await this.handleResponse(response);
    return response.json();
  }

  async sendLibraryRequestToQbit(id: string, payload?: { force?: boolean }) {
    const response = await fetch(`/api/library/${id}/send-to-qbit`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: payload ? JSON.stringify(payload) : undefined
    });

    await this.handleResponse(response);
    return response.json();
  }

  async autoSearchLibraryRequest(id: string) {
    const response = await fetch(`/api/library/${id}/auto-search`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getTvSeasonRequests() {
    const response = await fetch('/api/library/tv', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getExistingSeasons(tmdbId: number, mediaType: 'tv' | 'anime' = 'tv') {
    const response = await fetch(`/api/library/tv/check/${tmdbId}?mediaType=${mediaType}`, {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getTvShowSeasonStatus(
    tmdbId: number,
    options: {
      mediaType?: 'tv' | 'anime';
      title?: string;
      seasons?: number[];
    } = {}
  ) {
    const params = new URLSearchParams();
    params.set('mediaType', options.mediaType || 'tv');
    if (options.title) params.set('title', options.title);
    if (options.seasons?.length) {
      params.set('seasons', options.seasons.join(','));
    }

    const response = await fetch(
      `/api/library/tv/show/${tmdbId}/season-status?${params.toString()}`,
      { headers: this.getHeaders() }
    );

    await this.handleResponse(response);
    return response.json() as Promise<{ seasons: TvSeasonStatusRow[] }>;
  }

  async createTvSeasonRequests(payload: {
    tmdb_id: number;
    media_type: 'tv' | 'anime';
    title: string;
    poster_url?: string | null;
    season_numbers: number[];
  }) {
    const response = await fetch('/api/library/tv', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    await this.handleResponse(response);
    return response.json();
  }

  async deleteTvSeasonRequest(id: string) {
    const response = await fetch(`/api/library/tv/${id}`,
      {
        method: 'DELETE',
        headers: this.getHeaders()
      }
    );

    await this.handleResponse(response);
    return response.json();
  }

  async searchTvSeasonRequest(id: string) {
    const response = await fetch(`/api/library/tv/${id}/search`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async searchTvSeasonRequestEpisode(id: string, payload: { episode_number: number }) {
    const response = await fetch(`/api/library/tv/${id}/search-episode`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    await this.handleResponse(response);
    return response.json();
  }

  async selectTvSeasonRequest(
    id: string,
    payload: {
      name: string;
      link: string;
      size?: number;
      seeds?: number;
    }
  ) {
    const response = await fetch(`/api/library/tv/${id}/select`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    await this.handleResponse(response);
    return response.json();
  }

  async sendTvSeasonRequestToQbit(id: string, payload?: { episode_number?: number; force?: boolean }) {
    const response = await fetch(`/api/library/tv/${id}/send-to-qbit`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: payload ? JSON.stringify(payload) : undefined
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getTvSeasonPresence(id: string) {
    const response = await fetch(`/api/library/tv/${id}/presence`, {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getTvSeasonHistory(id: string) {
    const response = await fetch(`/api/library/tv/${id}/history`, {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async scanMediaInventoryNow(options?: { force?: boolean }) {
    const response = await fetch('/api/media-inventory/scan', {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options || {})
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getMediaInventoryScanStatus() {
    const response = await fetch('/api/media-inventory/scan/status', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async testEmbyConnection(payload?: { url?: string; api_key?: string }) {
    const response = await fetch('/api/emby/test', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload || {})
    });

    await this.handleResponse(response);
    return response.json();
  }

  async testProwlarrConnection(payload?: { url?: string; api_key?: string }) {
    const response = await fetch('/api/prowlarr/test', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload || {})
    });

    await this.handleResponse(response);
    return response.json();
  }

  async testTmdbConnection(payload?: { access_token?: string }) {
    const response = await fetch('/api/tmdb/test', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload || {})
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getEmbyLibraries(options?: { url?: string; api_key?: string }) {
    const params = new URLSearchParams();
    if (options?.url) params.set('url', options.url);
    if (options?.api_key) params.set('api_key', options.api_key);
    const qs = params.toString();
    const response = await fetch(`/api/emby/libraries${qs ? `?${qs}` : ''}`, {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getEmbyStatus() {
    const response = await fetch('/api/emby/status', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async syncEmbyNow() {
    const response = await fetch('/api/emby/sync', {
      method: 'POST',
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async searchMovie(
    title: string,
    year?: string,
    tmdbId?: number,
    mediaType?: 'movie' | 'animation',
    options?: { expandTextSearch?: boolean }
  ) {
    const response = await fetch('/api/prowlarr/search/movie', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        title,
        year,
        tmdbId,
        mediaType,
        expandTextSearch: options?.expandTextSearch === true,
      })
    });

    await this.handleResponse(response);
    return response.json();
  }

  async searchTvSeries(
    title: string,
    mediaType?: string,
    tmdbId?: number,
    year?: string,
    options?: { expandTextSearch?: boolean }
  ) {
    const response = await fetch('/api/prowlarr/search/tv', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        title,
        mediaType,
        tmdbId,
        year,
        expandTextSearch: options?.expandTextSearch === true,
      })
    });

    await this.handleResponse(response);
    return response.json();
  }

  async searchGeneral(query: string, category?: string) {
    const response = await fetch('/api/prowlarr/search', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query, category })
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getSystemHealth() {
    const response = await fetch('/api/system/health', {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async getAdminActivity(limit = 100, eventType?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (eventType) params.set('event_type', eventType);

    const response = await fetch(`/api/admin/activity?${params.toString()}`, {
      headers: this.getHeaders()
    });

    await this.handleResponse(response);
    return response.json();
  }

  async downloadDatabaseBackup(): Promise<void> {
    const response = await fetch('/api/system/backup/database', {
      headers: this.getHeaders()
    });

    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Erreur lors du téléchargement');
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `search-torrent-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // --- RSS ---
  async getRssFeeds() {
    const response = await fetch('/api/rss', { headers: this.getHeaders() });
    await this.handleResponse(response);
    return response.json();
  }

  async getAllRssItems(forceRefresh = false) {
    const query = forceRefresh ? '?force_refresh=true' : '';
    const response = await fetch(`/api/rss/all-items${query}`, {
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async getRssRecentHome(hours = RSS_HOME_HOURS) {
    const response = await fetch(`/api/rss/recent-home?hours=${hours}`, {
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async createRssFeed(payload: { feed_name: string; feed_url: string }) {
    const response = await fetch('/api/rss', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async deleteRssFeed(id: string) {
    const response = await fetch(`/api/rss/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json().catch(() => ({}));
  }

  async getRssCacheStats() {
    const response = await fetch('/api/rss/cache/stats', {
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
    return response.json();
  }

  async manageRssCache(payload: { action: string; type: string; feedId?: string }) {
    const response = await fetch('/api/rss/cache/manage', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    await this.handleResponse(response);
    return response.json().catch(() => ({}));
  }
}

export const api = new API();
export default api;
