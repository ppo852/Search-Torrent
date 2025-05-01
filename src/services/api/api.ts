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
    if (response.status === 403) {
      // Token invalide ou expiré
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Une erreur est survenue');
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
}

export const api = new API();
export default api;
