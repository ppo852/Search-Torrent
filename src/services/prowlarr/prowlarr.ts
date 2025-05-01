import { globalSettings } from '../settings';
import type { SearchResult, CategoryType } from '../../types';
import { CATEGORY_MAPPING } from '../../types';

class ProwlarrAPI {
  private getHeaders(apiKey: string) {
    return {
      'X-Api-Key': apiKey,
      'Accept': 'application/json'
    };
  }

  private getCategoryName(categoryId: number): string {
    if (!categoryId) return 'Unknown';

    // Movies: 2000-2999 et documentaires (5080)
    if ((categoryId >= 2000 && categoryId < 3000) || categoryId === 5080) return 'movies';

    // TV: 5000-5999 (excluding 5070 and 5080)
    if ((categoryId >= 5000 && categoryId < 5070) || (categoryId > 5080 && categoryId < 6000)) return 'tv';
    
    // Anime: 5070
    if (categoryId === 5070) return 'Anime';
    
    // Audio/Music: 3000-3999
    if (categoryId >= 3000 && categoryId < 4000) return 'music';
    
    // Software: 4000-4999
    if (categoryId >= 4000 && categoryId < 5000) return 'software';
    
    // Books: 7000-7999
    if (categoryId >= 7000 && categoryId < 8000) return 'books';
    
    return 'other';
  }

  async search(query: string, category: CategoryType = 'all'): Promise<SearchResult[]> {
    const settings = globalSettings.getProwlarrSettings();
    const minSeeds = globalSettings.getMinSeeds();
    
    if (!settings.url || !settings.apiKey) {
      throw new Error('Prowlarr settings not configured');
    }

    try {
      const url = new URL('/api/v1/search', settings.url);
      url.searchParams.append('query', query);

      // Gestion des catégories
      if (category !== 'all' && CATEGORY_MAPPING[category]) {
        const categoryId = CATEGORY_MAPPING[category][0];
        if (categoryId) {
          url.searchParams.append('categories', categoryId.toString());
        }
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(settings.apiKey)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Prowlarr API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Prowlarr API error: ${errorText}`);
      }

      const data = await response.json();

      const results = data
        .map((item: any) => {
          const itemCategory = this.getCategoryName(item.categories?.[0]?.id);
          return {
            name: item.title,
            link: item.downloadUrl || item.guid,
            size: item.size,
            seeds: item.seeders || 0,
            leech: item.peers || 0,
            engine_url: item.indexer,
            desc_link: item.infoUrl || '',
            category: itemCategory,
            publishDate: item.publishDate || item.pubDate || null
          };
        })
        .filter((item: SearchResult) => {
          // Filtre par seeds minimum
          if (item.seeds < minSeeds) return false;
          
          // Filtre par catégorie si une catégorie est sélectionnée
          // Comparaison insensible à la casse pour éviter les problèmes de majuscules/minuscules
          if (category !== 'all' && item.category.toLowerCase() !== category.toLowerCase()) return false;
          
          return true;
        });

      return results;

    } catch (error) {
      console.error('Prowlarr search error:', error);
      throw error;
    }
  }
}

export const prowlarrAPI = new ProwlarrAPI();
export default prowlarrAPI;
