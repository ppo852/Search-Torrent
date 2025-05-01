import fetch from 'node-fetch';
import { get } from '../core/db.js';
import { getTMDBCacheByTitle, saveTMDBCache } from './cache.js';
import { normalizeTitleForTMDB } from './normalizer.js';

/**
 * Cherche des informations TMDB pour un titre donné
 * @param {string} title - Titre pour lequel chercher des informations
 * @returns {Promise<Object|null>} Données TMDB ou null si rien trouvé
 */
export async function searchTMDB(title) {
  try {
    // Vérifier d'abord dans le cache
    const cachedData = await getTMDBCacheByTitle(title);
    if (cachedData) {
      return cachedData;
    }
    
    // Nettoyer le titre pour la recherche TMDB avec la fonction spécialisée
    const normalizedTitle = normalizeTitleForTMDB(title);
    // Les logs sont déjà gérés par la fonction normalizeTitleForTMDB
    
    // Récupérer l'access token depuis les paramètres (table app_settings)
    const settings = await get("SELECT value FROM app_settings WHERE name = 'tmdb_access_token'");
    if (!settings || !settings.value) {
      console.warn('Clé API TMDB non configurée');
      return null;
    }
    
    // Utiliser directement la valeur du token sans JSON.parse car c'est un token JWT
    const tmdbAccessToken = settings.value;
    if (!tmdbAccessToken) {
      console.warn('Clé API TMDB non configurée ou invalide');
      return null;
    }
    
    // Vérifier si le titre contient une année
    const yearMatch = normalizedTitle.match(/\b(19|20)\d{2}\b/);
    const hasYear = yearMatch !== null;
    const year = hasYear ? yearMatch[0] : '';
    
    // Détecter si c'est une collection
    const isCollection = /collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptalogy|octology/i.test(normalizedTitle);
    // console.log(`[TMDB] Détection de collection: ${isCollection ? 'Oui' : 'Non'} pour "${normalizedTitle}"`);
    
    // Première tentative avec le titre complet (avec année si présente)
    // Si c'est une collection, chercher d'abord dans les collections
    let searchUrl;
    if (isCollection) {
      // Extraire le nom de base de la collection (sans le mot "collection", "trilogy", etc.)
      const baseTitle = normalizedTitle.replace(/\s*(collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptalogy|octology)\s*/i, '').trim();
      // console.log(`[TMDB] Recherche de collection avec le titre de base: "${baseTitle}"`);
      searchUrl = `https://api.themoviedb.org/3/search/collection?query=${encodeURIComponent(baseTitle)}&include_adult=false&language=fr-FR&page=1`;
    } else {
      // Recherche standard multi
      searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(normalizedTitle)}&include_adult=false&language=fr-FR&page=1`;
    }
    
    let response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tmdbAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Erreur API TMDB: ${response.status} ${response.statusText}`);
      return null;
    }

    let data = await response.json();
    // console.log(`[TMDB] Réponse de la première recherche: ${data.results ? data.results.length : 0} résultats`);
    
    // Si c'est une collection et qu'on n'a pas trouvé de résultats, essayer la recherche multi standard
    if (isCollection && (!data.results || data.results.length === 0)) {
      // console.log(`[TMDB] Aucun résultat dans les collections, essai de recherche multi standard`);
      searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(normalizedTitle)}&include_adult=false&language=fr-FR&page=1`;
      
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tmdbAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Erreur API TMDB (recherche multi après collection): ${response.status} ${response.statusText}`);
        return null;
      }

      data = await response.json();
      // console.log(`[TMDB] Réponse de la recherche multi après collection: ${data.results ? data.results.length : 0} résultats`);
    }
    
    // Si aucun résultat n'est trouvé, essayer avec une version plus simple du titre
    if (!data.results || data.results.length === 0) {
      // Essayer sans l'année pour les titres qui ne sont pas des collections
      if (hasYear && !isCollection) {
        const titleWithoutYear = normalizedTitle.replace(/\s+\b(19|20)\d{2}\b/, '').trim();
        // console.log(`[TMDB] Aucun résultat, essai sans l'année: "${titleWithoutYear}"`);
        
        searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(titleWithoutYear)}&include_adult=false&language=fr-FR&page=1`;
        
        response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tmdbAccessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          data = await response.json();
          // console.log(`[TMDB] Résultats sans l'année: ${data.results ? data.results.length : 0}`);
        }
      }
      
      // Si toujours aucun résultat, essayer avec seulement les premiers mots du titre
      if (!data.results || data.results.length === 0) {
        // Prendre les 2-3 premiers mots significatifs du titre
        const words = normalizedTitle.split(/\s+/);
        let simplifiedTitle = '';
        
        // Prendre jusqu'à 3 mots, mais s'arrêter si on rencontre un mot-clé de collection
        let wordCount = 0;
        for (const word of words) {
          if (/collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptalogy|octology/i.test(word)) {
            break;
          }
          
          if (wordCount >= 3) break;
          
          // Ignorer les articles et prépositions courants
          if (!/^(le|la|les|the|a|an|de|du|des|et|and|of)$/i.test(word)) {
            simplifiedTitle += (simplifiedTitle ? ' ' : '') + word;
            wordCount++;
          }
        }
        
        if (simplifiedTitle && simplifiedTitle !== normalizedTitle) {
          // console.log(`[TMDB] Essai avec titre simplifié: "${simplifiedTitle}"`);
          
          searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(simplifiedTitle)}&include_adult=false&language=fr-FR&page=1`;
          
          response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tmdbAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            data = await response.json();
            // console.log(`[TMDB] Résultats avec titre simplifié: ${data.results ? data.results.length : 0}`);
          }
        }
      }
      
      // Pour les titres très courts (comme "Six jours"), essayer une recherche plus précise
      if ((!data.results || data.results.length === 0) && normalizedTitle.split(/\s+/).length <= 3) {
        // Extraire le titre de base sans année et sans mots-clés de collection
        const baseTitle = normalizedTitle
          .replace(/\b(19|20)\d{2}\b/, '')
          .replace(/\s*(collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptalogy|octology)\s*/i, '')
          .trim();
        
        if (baseTitle && baseTitle.length >= 3) {
          // console.log(`[TMDB] Essai avec titre court: "${baseTitle}"`);
          
          // Pour les titres courts, essayer d'abord une recherche de film
          searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(baseTitle)}&include_adult=false&language=fr-FR&page=1`;
          
          response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tmdbAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            data = await response.json();
            // console.log(`[TMDB] Résultats de recherche film pour titre court: ${data.results ? data.results.length : 0}`);
            
            // Si aucun résultat, essayer une recherche de série
            if (!data.results || data.results.length === 0) {
              searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(baseTitle)}&include_adult=false&language=fr-FR&page=1`;
              
              response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${tmdbAccessToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                data = await response.json();
                // console.log(`[TMDB] Résultats de recherche série pour titre court: ${data.results ? data.results.length : 0}`);
              }
            }
          }
        }
      }
    }
    
    if (data.results && data.results.length > 0) {
      // console.log(`[TMDB] Premier résultat: ${JSON.stringify(data.results[0], null, 2)}`);
      
      // Traitement différent selon qu'il s'agit d'une collection ou d'un résultat multi
      let result;
      
      if (isCollection && searchUrl.includes('/search/collection')) {
        // Traitement spécifique pour les collections
        // console.log(`[TMDB] Traitement d'une collection: ${data.results[0].name}`);
        
        // Construire les URLs complètes pour les images
        const posterUrl = data.results[0].poster_path ? `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}` : null;
        const backdropUrl = data.results[0].backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.results[0].backdrop_path}` : null;
        
        result = {
          tmdb_id: data.results[0].id,
          media_type: 'collection',  // Type spécifique pour les collections
          title: data.results[0].name,
          overview: data.results[0].overview,
          poster_path: data.results[0].poster_path,
          poster_url: posterUrl,  // URL complète de la pochette
          backdrop_path: data.results[0].backdrop_path,
          backdrop_url: backdropUrl,  // URL complète de l'arrière-plan
          // Pas de release_date pour les collections
          vote_average: null  // Pas de vote pour les collections
        };
      } else {
        // Traitement standard pour les résultats multi (films, séries)
        // console.log(`[TMDB] Traitement d'un ${data.results[0].media_type}: ${data.results[0].title || data.results[0].name}`);
        
        // Construire les URLs complètes pour les images
        const posterUrl = data.results[0].poster_path ? `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}` : null;
        const backdropUrl = data.results[0].backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.results[0].backdrop_path}` : null;
        
        result = {
          tmdb_id: data.results[0].id,
          media_type: data.results[0].media_type,
          title: data.results[0].title || data.results[0].name,
          overview: data.results[0].overview,
          poster_path: data.results[0].poster_path,
          poster_url: posterUrl,  // URL complète de la pochette
          backdrop_path: data.results[0].backdrop_path,
          backdrop_url: backdropUrl,  // URL complète de l'arrière-plan
          release_date: data.results[0].release_date || data.results[0].first_air_date,
          vote_average: data.results[0].vote_average
        };
      }
      
      // Sauvegarder dans le cache pour les futures requêtes
      await saveTMDBCache(title, result);
      
      // [DEBUG ONLY] console.log(`[TMDB] Résultat final avec URLs: ${JSON.stringify(result, null, 2)}`);
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur lors de la recherche TMDB:', error);
    return null;
  }
}

/**
 * Vérifie si une catégorie est pertinente pour TMDB (films, séries, etc.)
 * @param {string} category - Catégorie à vérifier
 * @returns {boolean} True si la catégorie est pertinente pour TMDB
 */
function isTMDBRelevantCategory(category) {
  if (!category) return true; // Si pas de catégorie, on essaie quand même
  
  // Convertir en nombre si c'est une chaîne numérique
  const categoryNum = parseInt(category, 10);
  const categoryStr = category.toString().toLowerCase();
  
  // Catégories numériques standard Newznab/Torznab
  // 2000-2999: Films
  // 5000-5999: TV (mais on exclut 5060 qui est pour le sport et 5070 pour les animes VOSTFR)
  // 6000-6999: XXX (ignoré)
  // 7000-7999: Livres (ignoré)
  // 1000-1999: Audio (ignoré)
  // 3000-3999: Applications (ignoré)
  // 4000-4999: Jeux (ignoré)
  if (!isNaN(categoryNum)) {
    return (categoryNum >= 2000 && categoryNum < 3000) || // Films
           (categoryNum >= 5000 && categoryNum < 6000 && categoryNum !== 5060 && categoryNum !== 5070);   // TV (sauf sport et anime VOSTFR)
  }
  
  // Catégories textuelles
  return categoryStr.includes('movie') || 
         categoryStr.includes('film') || 
         categoryStr.includes('tv') || 
         categoryStr.includes('serie') || 
         categoryStr.includes('série') || 
         categoryStr.includes('show') || 
         categoryStr.includes('anime');
}

/**
 * Enrichit une liste d'éléments RSS avec des données TMDB
 * @param {Array} items - Éléments RSS à enrichir
 * @returns {Promise<Array>} Éléments enrichis avec des données TMDB
 */
export async function enrichItemsWithTMDB(items) {
  const enrichedItems = [];
  let skippedCount = 0;
  
  for (const item of items) {
    try {
      // Vérifier si la catégorie est pertinente pour TMDB
      if (!isTMDBRelevantCategory(item.category)) {
        skippedCount++;
        enrichedItems.push({
          ...item,
          tmdb: null
        });
        continue;
      }
      
      const tmdbData = await searchTMDB(item.title);
      
      enrichedItems.push({
        ...item,
        tmdb: tmdbData || null
      });
    } catch (err) {
      console.error(`Erreur lors de l'enrichissement TMDB pour ${item.title}:`, err);
      enrichedItems.push({
        ...item,
        tmdb: null
      });
    }
  }
  
  if (skippedCount > 0) {
    // [DEBUG ONLY] console.log(`[TMDB] ${skippedCount} éléments ignorés car catégorie non pertinente pour TMDB`);
  }
  
  return enrichedItems;
}

export default {
  searchTMDB,
  enrichItemsWithTMDB
};
