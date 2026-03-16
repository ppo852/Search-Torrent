/**
 * Module de détection et normalisation des catégories RSS
 * Fournit des fonctions pour détecter et normaliser les catégories
 */

/**
 * Détecte la catégorie d'un élément RSS à partir de son code de catégorie
 * @param {string} category - Code de catégorie (généralement numérique)
 * @param {string} title - Titre de l'élément (utilisé pour la détection par mots-clés si nécessaire)
 * @returns {string} Catégorie normalisée
 */
export function detectCategory(category, title = '') {
  if (!category) {
    // Tentative de détection par le titre si pas de catégorie
    return detectCategoryFromTitle(title);
  }

  const categoryCode = parseInt(category);
  
  // Ignorer délibérément les codes spécifiques aux indexeurs (100000+)
  // Ces codes sont spécifiques à chaque indexeur et ne font pas partie des standards Newznab/Torznab
  if (categoryCode >= 100000) {
    return 'Autres'; // Pour les codes spécifiques aux indexeurs, on utilise "Autres"
  }

  // Catégories principales basées sur les codes Prowlarr/Newznab standards
  
  // Films (2000-2999)
  if (categoryCode >= 2000 && categoryCode < 3000) {
    // Sous-catégories spécifiques pour les films
    if (categoryCode === 2030) return 'Documentaire';
    return 'Films';
  }
  
  // Musique (3000-3999)
  if (categoryCode === 3000 || (categoryCode >= 3000 && categoryCode < 4000)) return 'Musique';
  
  // Logiciels (4000-4999)
  if (categoryCode === 4010 || (categoryCode >= 4000 && categoryCode < 5000 && categoryCode !== 4070)) return 'Logiciels';
  
  // Jeux (4070 spécifiquement)
  if (categoryCode === 4070) return 'Jeux';
  
  // Séries TV (5000-5999, avec exceptions)
  if (categoryCode >= 5000 && categoryCode < 6000) {
    // Exceptions spécifiques dans la catégorie TV
    if (categoryCode === 5060) return 'Sport';
    if (categoryCode === 5070) return 'Anime';
    return 'Séries TV';
  }
  
  // Adulte (6000-6999) - ignoré complètement
  if (categoryCode >= 6000 && categoryCode < 7000) return null;
  
  // Livres (7000-7999)
  if (categoryCode >= 7000 && categoryCode < 8000) return 'Livres';
 
  // Other (8000-8999)
  if (categoryCode >= 8000 && categoryCode < 9000) return 'Autres';
  
  // Par défaut
  return 'Autres';
}

/**
 * Détecte la catégorie à partir du titre quand le code de catégorie n'est pas disponible
 * @param {string} title - Titre de l'élément
 * @returns {string} Catégorie détectée
 */
function detectCategoryFromTitle(title) {
  if (!title) return 'Autres';
  
  const lowerTitle = title.toLowerCase();
  
  // Détection par mots-clés
  if (/\b(?:sport|football|tennis|basket|rugby|f1|formule 1|nfl|nba|nhl|mlb|ufc|boxe|golf)\b/i.test(lowerTitle)) {
    return 'Sport';
  }
  
  if (/\b(?:documentaire|documentary|docu)\b/i.test(lowerTitle)) {
    return 'Documentaire';
  }
  
  if (/\b(?:vostfr|vost)\b/i.test(lowerTitle) && /\b(?:anime|animation japonaise)\b/i.test(lowerTitle)) {
    return 'Anime';
  }
  
  if (/\b(?:anime|animation japonaise)\b/i.test(lowerTitle)) {
    return 'Anime';
  }
  
  if (/\b(?:s\d{2}e\d{2}|saison|season|episode)\b/i.test(lowerTitle)) {
    return 'Séries TV';
  }
  
  if (/\b(?:film|movie|bluray|bdrip|dvdrip|webrip|hdrip)\b/i.test(lowerTitle)) {
    return 'Films';
  }
  
  if (/\b(?:mp3|flac|wav|album|discography|music|musique|audio|concert)\b/i.test(lowerTitle)) {
    return 'Musique';
  }
  
  if (/\b(?:ebook|epub|pdf|livre|book|roman|comics|manga|bd)\b/i.test(lowerTitle)) {
    return 'Livres';
  }
  
  if (/\b(?:jeu|game|ps4|ps5|xbox|switch|nintendo|pc game)\b/i.test(lowerTitle)) {
    return 'Jeux';
  }
  
  if (/\b(?:logiciel|software|app|application|windows|macos|linux)\b/i.test(lowerTitle)) {
    return 'Logiciels';
  }
  
  // Par défaut
  return 'Autres';
}

export default {
  detectCategory
};
