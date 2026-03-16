import { useAuthStore } from '../../stores/authStore';

class API {
  private getHeaders() {
    const token = useAuthStore.getState().token;
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  private async handleResponse(response: Response) {
    if (response.status === 401 || response.status === 403) {
      const body = await response.clone().json().catch(() => ({} as any));
      const msg = String(body?.message || body?.error || '').toLowerCase();
      const isAuthError =
        response.status === 401 ||
        msg.includes('token invalide') ||
        msg.includes('token manquant') ||
        msg.includes('jwt');

      if (isAuthError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
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

  async updateUser(userId: string, updates: any) {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    
    return this.handleResponse(response);
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

  async getClientSettings() {
    const response = await fetch('/api/settings/client', {
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

  // Méthodes pour qBittorrent
  async getTorrents() {
    const response = await fetch('/api/qbittorrent/torrents', {
      headers: this.getHeaders()
    });
    
    await this.handleResponse(response);
    return response.json();
  }

  async deleteTorrents(hashes: string[], deleteFiles: boolean = false) {
    const response = await fetch('/api/qbittorrent/delete', {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes, deleteFiles })
    });
    
    return this.handleResponse(response);
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

  async pauseTorrent(hash: string) {
    const response = await fetch('/api/qbittorrent/pause', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hash })
    });

    return this.handleResponse(response);
  }

  async resumeTorrent(hash: string) {
    const response = await fetch('/api/qbittorrent/resume', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ hashes: hash })
    });

    return this.handleResponse(response);
  }

  async addTorrentUrl(url: string, options: { category?: string, mediaType?: 'movie' | 'tv' } = {}) {
    let category = options.category;
    
    // Fallback sur le type de média (pour MediaDetailPage)
    if (!category && options.mediaType) {
      category = options.mediaType === 'movie' ? 'Films' : 'Séries';
    }
    
    const response = await fetch('/api/qbittorrent/add', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ 
        urls: [url], // Envoi de l'URL dans un tableau
        options: { 
          category // Categorie dans un sous-objet options
        }
      })
    });
    
    return this.handleResponse(response);
  }

  /**
   * Ajoute un torrent avec catégorisation automatique
   * @param url URL du torrent à ajouter
   * @param itemCategory Catégorie fournie par les résultats de recherche
   * @param mediaType Type de média (film ou série) si disponible
   * @returns Réponse de l'API qBittorrent
   */
  async addTorrentWithCategory(url: string, itemCategory?: string, mediaType?: 'movie' | 'tv') {
    // Détermine la catégorie la plus appropriée
    let category = 'Autres';
    
    // Priorité 1 : Utiliser la catégorie fournie par les résultats de recherche
    if (itemCategory) {
      // Normalisation des catégories
      if (/movie|film/i.test(itemCategory)) {
        category = 'Films';
      } else if (/tv|série|serie|show/i.test(itemCategory)) {
        category = 'Séries';
      } else if (/music|musique/i.test(itemCategory)) {
        category = 'Musique';
      } else if (/book|livre/i.test(itemCategory)) {
        category = 'Livres';
      } else if (/game|jeu/i.test(itemCategory)) {
        category = 'Jeux';
      } else if (/software|logiciel/i.test(itemCategory)) {
        category = 'Logiciels';
      } else {
        // Catégorie non reconnue, on utilise celle d'origine
        category = itemCategory;
      }
    } 
    // Priorité 2 : Fallback sur le type de média (pour MediaDetailPage)
    else if (mediaType) {
      category = mediaType === 'movie' ? 'Films' : 'Séries';
    }
    
    // Ajouter le torrent avec la catégorie
    return this.addTorrentUrl(url, { category });
  }

  async addTorrentFile(file: File, options: { category?: string; tags?: string[] } = {}) {
    if (!file.name.endsWith('.torrent')) {
      throw new Error('Le fichier doit être un .torrent');
    }
    
    const formData = new FormData();
    formData.append('fileselect', file);
    
    if (options.category) {
      formData.append('category', options.category);
    }
    
    if (options.tags && options.tags.length > 0) {
      formData.append('tags', options.tags.join(','));
    }
    
    const response = await fetch('/api/qbittorrent/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: formData
    });
    
    return this.handleResponse(response);
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
    media_type: 'movie' | 'tv';
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

  async scanMediaInventoryNow() {
    const response = await fetch('/api/media-inventory/scan', {
      method: 'POST',
      headers: this.getHeaders()
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

  async searchMovie(title: string, year?: string, tmdbId?: number) {
    const response = await fetch('/api/prowlarr/search/movie', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title, year, tmdbId })
    });

    await this.handleResponse(response);
    return response.json();
  }

  async searchTvEpisode(title: string, seasonNumber: number, episodeNumber: number, mediaType?: string) {
    const response = await fetch('/api/prowlarr/search/tv/episode', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title, seasonNumber, episodeNumber, mediaType })
    });

    await this.handleResponse(response);
    return response.json();
  }

  async searchTvSeries(title: string, mediaType?: string, tmdbId?: number) {
    const response = await fetch('/api/prowlarr/search/tv', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title, mediaType, tmdbId })
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
}

export const api = new API();
export default api;
