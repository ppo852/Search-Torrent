/**
 * Module de normalisation des titres
 * Fournit des fonctions pour normaliser les titres à différentes fins
 */

/**
 * Normalise un titre pour la recherche générale
 * Version simple pour les recherches basiques et le stockage en cache
 * @param {string} title - Titre à normaliser
 * @returns {string} Titre normalisé
 */
export function normalizeTitleForSearch(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Supprimer la ponctuation
    .replace(/\s+/g, ' ')     // Normaliser les espaces
    .trim();
}

/**
 * Normalise un titre pour la recherche sur TMDB
 * Version avancée avec extraction intelligente pour les recherches TMDB
 * @param {string} title - Titre à normaliser
 * @returns {string} Titre normalisé
 */
export function normalizeTitleForTMDB(title) {
  if (!title) return '';
  
  // console.log(`[TMDB Normalisation] Titre original: "${title}"`);
  
  // Étape 1: Extraire l'année pour la réutiliser plus tard
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';
  // console.log(`[TMDB Normalisation] Année extraite: "${year}"`);
  
  // Étape 2: Détection du type de contenu (film, série, collection)
  const isTvShow = /S\d{1,2}|saison|season|episode/i.test(title);
  const isCollection = /collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptalogy|octology/i.test(title);
  
  /* if (isTvShow) {
    console.log(`[TMDB Normalisation] Détecté comme série TV`);
  } else if (isCollection) {
    console.log(`[TMDB Normalisation] Détecté comme collection`);
  } */
  
  // Extraire tous les titres entre parenthèses
  const parenthesesMatches = [...title.matchAll(/\(([^)]+)\)/g)];
  let extractedTitles = [];
  
  if (parenthesesMatches.length > 0) {
    for (const match of parenthesesMatches) {
      let extracted = match[1].trim();
      // Ne pas considérer comme titre alternatif si c'est juste une année ou une résolution
      if (!/^(?:19|20)\d{2}$|^(?:720p|1080p|2160p|4K|HDR)$/i.test(extracted)) {
        // Nettoyer la ponctuation du titre extrait
        extracted = extracted
          .replace(/[,\.]/g, ' ') // Remplacer les virgules et points par des espaces
          .replace(/\s+/g, ' ')   // Normaliser les espaces
          .trim();
        
        // Ignorer explicitement certains indicateurs de langue courants
        if (extracted.toUpperCase() === "MULTI VFI" || 
            extracted.toUpperCase() === "MULTI" || 
            extracted.toUpperCase() === "VFI" || 
            extracted.toUpperCase() === "VOSTFR" || 
            extracted.toUpperCase() === "FRENCH") {
          // console.log(`[TMDB Normalisation] Titre ignoré (indicateur de langue): "${extracted}"`);
          continue;
        }
        
        // Vérifier si c'est juste un indicateur de langue
        const languageIndicators = ['MULTI', 'VF', 'VFI', 'VOSTFR', 'FRENCH', 'TRUEFRENCH', 'VO'];
        let isJustLanguage = false;
        
        // Vérifier si le titre ne contient que des indicateurs de langue
        for (const indicator of languageIndicators) {
          if (extracted.toUpperCase().includes(indicator)) {
            const remaining = extracted.toUpperCase().replace(new RegExp(indicator, 'gi'), '').trim();
            if (remaining.length < 3) {
              isJustLanguage = true;
              // console.log(`[TMDB Normalisation] Titre ignoré (juste un indicateur de langue): "${extracted}"`);
              break;
            }
          }
        }
        
        if (!isJustLanguage) {
          extractedTitles.push(extracted);
          // console.log(`[TMDB Normalisation] Titre extrait des parenthèses: "${extracted}"`);
        }
      }
    }
  }
  
  // Extraire le titre entre crochets (parfois utilisé pour le titre original)
  const bracketsMatch = title.match(/\[([^\]]+)\]/);
  let bracketsTitle = null;
  
  if (bracketsMatch) {
    let extracted = bracketsMatch[1].trim();
    // Ne pas considérer comme titre alternatif si c'est juste une résolution
    if (!/^(?:720p|1080p|2160p|4K|HDR)$/i.test(extracted)) {
      // Nettoyer la ponctuation du titre extrait
      extracted = extracted
        .replace(/[,\.]/g, ' ') // Remplacer les virgules et points par des espaces
        .replace(/\s+/g, ' ')   // Normaliser les espaces
        .trim();
      
      bracketsTitle = extracted;
      // console.log(`[TMDB Normalisation] Titre extrait des crochets: "${bracketsTitle}"`);
    } else {
      bracketsTitle = null;
    }
  }
  
  // Étape 3: Approche par découpage en mots
  const parts = title.split(/[.\s]+/);
  let cleanedByParts = '';
  
  // Liste des indicateurs de format, codecs, etc. à supprimer
  const formatIndicators = [
    // Langues
    'MULTI', 'FRENCH', 'VOSTFR', 'SUBFRENCH', 'TRUEFRENCH', 'VFF', 'VFI', 'VF2', 'VO', 'VOST', 'VOSTEN', 'CUSTOM', 'VF', 'VOF',
    // Résolutions et qualité
    '720P', '1080P', '2160P', '4K', 'UHD', 'HD', 'HDLIGHT', 'HDTV', 'BLURAY', 'BLU-RAY', 'BDRIP', 'BRRIP', 'DVDRIP', 'REMUX', 'WEBRIP', 'WEBDL', 'WEB-DL', 'WEB',
    // Codecs et audio
    'X264', 'X265', 'H264', 'H265', 'HEVC', 'AVC', 'XVID', 'MP4', 'MP3', 'AAC', 'DTS', 'TRUEHD', 'ATMOS', 'DD5', 'DDP5', 'AC3', 'FLAC', 'DDP', 'EAC3', 'LPCM', 'MA', 'HDMA',
    // Services de streaming
    'NETFLIX', 'AMZN', 'AMAZON', 'DISNEY', 'CANAL', 'APPLE', 'HULU', 'DSNP', 'MAX', 'HMAX', 'NF',
    // Groupes de release - liste étendue
    'FW', 'NOTAG', 'RAF66', 'EXTREME', 'BAWLS', 'GLADOS', 'BULITT', 'AMEN', 'THESYNDI', 'THESYNDICAT', 'THESYNDICATÉ', 'THESYNDICATEE', 
    'BTT', 'KAF', 'KAMUI', '55H', 'ULYSSE', 'BNZBNZ', 'DTONE', 'TELEMO', 'MCSWI', 'SONJE03', 'SIC', 'KRUPPE', 'BTRS', 'BYHGO', 'ILT', 'JAROD', 'DAM',
    // Autres indicateurs techniques
    'PROPER', 'REPACK', 'EXTENDED', 'DIRECTORS', 'CUT', 'UNRATED', 'COMPLETE', 'SUBBED', 'DUBBED', 'FINAL', 'RETAIL', 'THEATRICAL', 'LIMITED', 'COMPLETE', 'RESTORED', 'REMASTERED', 'CRITERION', 'HDR', 'DV', 'DOLBY', 'VISION', 'IMAX', 'ENHANCED', '10BIT', 'LIGHT', 'SAMPLE', 'MUET', 'DOC', 'INTEGRALE', 'INTÉGRALE'
  ];
  
  // Traiter chaque partie du titre jusqu'à rencontrer un indicateur technique
  if (isTvShow) {
    // Pour les séries, ne garder que ce qui est avant les indicateurs de saison/épisode
    for (const part of parts) {
      if (part.match(/^S\d{1,2}(E\d{1,2})?$/i) || // S01, S01E02
          part.match(/^(?:saison|season)$/i) || // Mot "saison" ou "season"
          part.match(/^(?:episode|e)$/i) || // Mot "episode" ou "e"
          formatIndicators.some(indicator => part.toUpperCase() === indicator)) {
        break;
      }
      cleanedByParts += part + ' ';
    }
  } else {
    // Pour les films et collections, garder jusqu'au premier indicateur technique
    for (const part of parts) {
      // Vérifier si c'est un indicateur de format ou un groupe de release
      if (formatIndicators.some(indicator => part.toUpperCase() === indicator) || 
          part.match(/^[A-Z0-9]{2,}$/) || // Groupes de release probables
          part.match(/S\d{1,2}E\d{1,2}/i)) { // Indicateurs d'épisode
        break;
      }
      cleanedByParts += part + ' ';
    }
  }
  
  cleanedByParts = cleanedByParts.trim();
  // console.log(`[TMDB Normalisation] Titre nettoyé par parties: "${cleanedByParts}"`);
  
  // Étape 4: Nettoyage par expressions régulières
  let normalizedByRegex = title
    // Supprimer les crochets et leur contenu
    .replace(/\[.*?\]/g, '')
    // Supprimer les parenthèses et leur contenu
    .replace(/\(.*?\)/g, '')
    // Supprimer les accolades et leur contenu
    .replace(/\{.*?\}/g, '')
    // Supprimer les mots entre guillemets
    .replace(/".*?"/g, '')
    // Supprimer les apostrophes
    .replace(/'/g, ' ');
  
  // Supprimer les dates au format JJ.MM.AAAA ou AAAA.MM.JJ
  normalizedByRegex = normalizedByRegex.replace(/\b\d{2,4}\.\d{2}\.\d{2,4}\b/g, '');
  
  // Supprimer les mots techniques en utilisant la liste formatIndicators
  for (const indicator of formatIndicators) {
    // Créer une regex pour chaque indicateur (mot entier, insensible à la casse)
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    normalizedByRegex = normalizedByRegex.replace(regex, '');
  }
  
  // Supprimer les références numériques comme "5.1", "7.1", etc.
  normalizedByRegex = normalizedByRegex.replace(/\b\d+\.\d+\b/g, '');
  
  // Supprimer les nombres isolés qui ne sont pas des années
  normalizedByRegex = normalizedByRegex.replace(/\b(?<!\d)\d{1,3}(?!\d)\b/g, '');
  
  // Remplacer les points, tirets et underscores par des espaces
  normalizedByRegex = normalizedByRegex.replace(/[\.\-_+]/g, ' ');
  
  // Supprimer les espaces multiples
  normalizedByRegex = normalizedByRegex.replace(/\s+/g, ' ');
  
  // Supprimer les espaces de début et fin
  normalizedByRegex = normalizedByRegex.trim();
  
  // console.log(`[TMDB Normalisation] Titre nettoyé par regex: "${normalizedByRegex}"`);
  
  // Étape 5: Traitement spécial pour les collections
  if (isCollection || normalizedByRegex.includes('trilogy') || normalizedByRegex.match(/\d+-\d+/) ||
      /\b(?:trilogy|trilogie|pentalogy|pentalogie|hexalogy|heptology|octology)\b/i.test(normalizedByRegex)) {
    
    // Extraire le nom de base de la collection (sans les mots comme "collection", "saga", etc.)
    let collectionBaseTitle = normalizedByRegex
      .replace(/\b(?:collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptalogy|octology)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Supprimer les groupes de release potentiels à la fin du nom
    for (const indicator of formatIndicators) {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      collectionBaseTitle = collectionBaseTitle.replace(regex, '');
    }
    collectionBaseTitle = collectionBaseTitle.replace(/\s+/g, ' ').trim();
    
    // Supprimer les plages d'années (ex: 1993-2015)
    collectionBaseTitle = collectionBaseTitle.replace(/\b\d{4}-\d{4}\b/g, '').trim();
    
    // Supprimer les nombres isolés qui pourraient rester (comme "5 1" dans X-Men Collection)
    collectionBaseTitle = collectionBaseTitle.replace(/\b\d+\b/g, '').trim();
    
    // console.log(`[TMDB Normalisation] Nom de base de la collection: "${collectionBaseTitle}"`);
    
    // Ajouter "Collection" au nom de base si ce n'est pas déjà présent
    if (!collectionBaseTitle.toLowerCase().includes('collection')) {
      normalizedByRegex = `${collectionBaseTitle} Collection`.trim();
    } else {
      normalizedByRegex = collectionBaseTitle;
    }
    
    // console.log(`[TMDB Normalisation] Nom final de la collection: "${normalizedByRegex}"`);
  }
  
  // Étape 6: Choisir la meilleure version du titre
  
  // Liste des titres candidats par ordre de préférence
  const candidates = [];
  
  // Cas spéciaux connus
  if (normalizedByRegex.toLowerCase().includes('frere') || normalizedByRegex.toLowerCase().includes('frère')) {
    if (extractedTitles.some(t => t.toLowerCase().includes('bratan'))) {
      candidates.push({
        title: 'Bratan',
        source: 'cas_special',
        score: 15
      });
    }
  }
  
  if (normalizedByRegex.toLowerCase().includes('bugged') && extractedTitles.some(t => t.toLowerCase().includes('cars toon'))) {
    const carsToonTitle = extractedTitles.find(t => t.toLowerCase().includes('cars toon'));
    candidates.push({
      title: carsToonTitle,
      source: 'cas_special',
      score: 15
    });
  }
  
  // Ajouter les titres extraits s'ils semblent valides
  if (extractedTitles.length > 0) {
    for (let i = 0; i < extractedTitles.length; i++) {
      const extractedTitle = extractedTitles[i];
      
      // Vérifier si le titre est juste un indicateur de langue ou un mot technique
      const languageIndicators = ['MULTI', 'VF', 'VFI', 'VOSTFR', 'FRENCH', 'TRUEFRENCH', 'VO'];
      
      // Vérifier si le titre ne contient que des indicateurs de langue
      let isJustTechnical = false;
      
      // Si le titre est court et contient un indicateur de langue, c'est probablement juste un indicateur
      if (extractedTitle.length < 15) {
        for (const indicator of languageIndicators) {
          if (extractedTitle.toUpperCase().includes(indicator)) {
            // Calculer le pourcentage du titre occupé par l'indicateur
            const ratio = indicator.length / extractedTitle.replace(/\s/g, '').length;
            if (ratio > 0.5) { // Si l'indicateur représente plus de 50% du titre
              isJustTechnical = true;
              // console.log(`[TMDB Normalisation] Titre ignoré (principalement un indicateur): "${extractedTitle}"`);
              break;
            }
          }
        }
      }
      
      // Vérifier si le titre contient des mots significatifs
      const words = extractedTitle.split(' ');
      const significantWords = words.filter(word => 
        word.length > 2 && 
        !formatIndicators.some(indicator => word.toUpperCase() === indicator)
      );
      
      // Si le titre n'a pas de mots significatifs, c'est probablement juste un indicateur technique
      if (significantWords.length === 0) {
        isJustTechnical = true;
      }
      
      // Ajouter le titre aux candidats s'il est valide
      if (extractedTitle.length > 3 && 
          !/^(?:MULTI|FRENCH|TRUEFRENCH|VOSTFR|720p|1080p)$/i.test(extractedTitle) &&
          !isJustTechnical) {
        
        // Détecter si c'est probablement un titre français
        const isFrenchTitle = /\b(le|la|les|du|des|au|aux|un|une|ce|cette|ces)\b/i.test(extractedTitle);
        
        candidates.push({
          title: extractedTitle,
          source: `parenthèses_${i}`,
          score: 10 + 
                 (extractedTitle.includes(year) ? 5 : 0) + // Bonus si contient l'année
                 (isFrenchTitle ? 8 : 0) + // Bonus important pour les titres français
                 (extractedTitle.split(' ').length > 2 ? 3 : 0) - i // Bonus pour les titres avec plusieurs mots
        });
      }
    }
  }
  
  // Ajouter le titre extrait des crochets s'il est valide
  if (bracketsTitle && bracketsTitle.length > 3 && 
      !/^(?:MULTI|FRENCH|TRUEFRENCH|VOSTFR|720p|1080p)$/i.test(bracketsTitle)) {
    
    const isFrenchTitle = /\b(le|la|les|du|des|au|aux|un|une|ce|cette|ces)\b/i.test(bracketsTitle);
    
    candidates.push({
      title: bracketsTitle,
      source: 'crochets',
      score: 8 + 
             (bracketsTitle.includes(year) ? 5 : 0) +
             (isFrenchTitle ? 6 : 0) +
             (bracketsTitle.split(' ').length > 2 ? 2 : 0)
    });
  }
  
  // Ajouter les titres nettoyés
  if (cleanedByParts && cleanedByParts.length > 3) {
    candidates.push({
      title: cleanedByParts,
      source: 'parties',
      score: 7 + 
             (cleanedByParts.includes(year) ? 5 : 0) + 
             (cleanedByParts.split(' ').length > 1 ? 3 : 0) // Bonus pour les titres avec plusieurs mots
    });
  }
  
  if (normalizedByRegex && normalizedByRegex.length > 3) {
    // Vérifier si le titre contient des groupes de release ou des indicateurs techniques
    let cleanTitle = normalizedByRegex;
    
    // Supprimer les groupes de release potentiels à la fin du titre
    for (const indicator of formatIndicators) {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      cleanTitle = cleanTitle.replace(regex, '');
    }
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
    
    candidates.push({
      title: cleanTitle,
      source: 'regex',
      score: 5 + 
             (cleanTitle.includes(year) ? 5 : 0) + 
             (cleanTitle.split(' ').length > 1 ? 2 : 0)
    });
  }
  
  // Trier les candidats par score décroissant
  candidates.sort((a, b) => b.score - a.score);
  
  // Utiliser le meilleur candidat
  let normalized = '';
  if (candidates.length > 0) {
    normalized = candidates[0].title;
    // console.log(`[TMDB Normalisation] Titre choisi (source: ${candidates[0].source}): "${normalized}"`);
  } else {
    // Fallback au titre nettoyé par regex si aucun candidat n'est trouvé
    normalized = normalizedByRegex;
    // console.log(`[TMDB Normalisation] Aucun candidat valide, utilisation du titre nettoyé par regex: "${normalized}"`);
  }
  
  // Vérifier si le titre est une plage d'années (comme "2000-2020")
  // Si c'est le cas, essayer d'extraire un meilleur titre du titre original
  if (/^\d{4}-\d{4}$/.test(normalized)) {
    // Extraire les mots significatifs du titre original
    // Ignorer les articles et autres mots non significatifs
    const titleWords = title.split(/\s+/).filter(word => !/^(le|la|les|the|a|an|de|du|des)$/i.test(word));
    
    // Chercher des mots substantifs jusqu'à un mot clé de collection ou jusqu'à 3 mots maximum
    let baseTitle = '';
    let wordCount = 0;
    let collectionFound = false;
    
    for (const word of titleWords) {
      if (/collection|coffret|integrale|intégrale|saga|trilogie|trilogy|quadrilogy|pentalogy|hexalogy|heptology|octology/i.test(word)) {
        collectionFound = true;
        break;
      }
      
      baseTitle += (baseTitle ? ' ' : '') + word;
      wordCount++;
      
      if (wordCount >= 3) break;
    }
    
    if (baseTitle) {
      normalized = `${baseTitle}${collectionFound ? ' Collection' : ''}`.trim();
      // console.log(`[TMDB Normalisation] Remplacement du titre (plage d'années) par: "${normalized}"`);
    }
  }
  
  // Étape 7: Finalisation - Nettoyer la ponctuation finale et les groupes de release
  // Remplacer toute ponctuation restante par des espaces
  normalized = normalized
    .replace(/[,\.;:!?]/g, ' ')  // Remplacer la ponctuation par des espaces
    .replace(/\s+/g, ' ')        // Normaliser les espaces
    .trim();
  
  // Nettoyer les groupes de release et indicateurs techniques qui pourraient rester
  for (const indicator of formatIndicators) {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    normalized = normalized.replace(regex, '');
  }
  
  // Supprimer les indicateurs de pays (USA, FR, etc.) qui ne font pas partie du titre
  normalized = normalized.replace(/\b(?:USA|FR|UK|JP|DE|IT|ES)\b/gi, '');
  
  // Supprimer les indicateurs techniques spécifiques qui pourraient rester
  normalized = normalized.replace(/\b(?:2in1|H64|LPCM|E-AC3|E AC3|E-|E |Dread|Team|HD|MA|FoX|Notag|KRUPPE|SiCFoI|AvALoN|Dam|Jarod|DTOne|telemO|BNZBNZ|GLaDOS|TFA|ILT|55H|TyHD|BULiTT|BTT|THESYNDiCATE|FW)\b/gi, '');
  
  // Supprimer les patterns de groupes de release (mot avec tiret suivi d'un mot ou mot en majuscules)
  normalized = normalized.replace(/\b[A-Za-z]+-[A-Za-z]+\b/g, '');
  normalized = normalized.replace(/\b[A-Z]{2,}\b/g, ''); // Mots en majuscules (groupes de release)
  
  // Conserver les nombres qui font partie d'un titre (comme "24 heures chrono")
  // Mais supprimer les nombres isolés qui ne sont pas des années et qui ne sont pas suivis de mots clés temporels
  normalized = normalized.replace(/\b(?<!\d)\d{1,3}(?!\d)\b(?!\s+(?:heures|jours|semaines|mois|ans|days|hours|weeks|months|years))\b/g, '');
  
  // Nettoyer les espaces multiples
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Supprimer les mots très courts (articles, etc.) à la fin du titre
  normalized = normalized.replace(/\s+(?:a|an|the|le|la|les|un|une|des|el|los|las)$/i, '');
  
  // Amélioration pour la détection des sagas et collections
  // Vérifier si le titre contient des mots-clés de saga/collection ou des noms de personnages connus
  const knownCharacters = ['freddy krueger', 'jason voorhees', 'harry potter', 'james bond', 'star wars', 'marvel', 'avengers'];
  const isFamousCharacter = knownCharacters.some(character => normalized.toLowerCase().includes(character));
  
  // Pour les collections, ne pas ajouter l'année si le titre contient déjà "Collection", "Trilogy", etc.
  const isCollectionTitle = /\b(?:collection|trilogy|trilogie|pentalogy|pentalogie|saga)\b/i.test(normalized) || isFamousCharacter;
  
  // Si c'est une collection avec un personnage connu, ajouter "Saga" si ce n'est pas déjà présent
  if (isFamousCharacter && !isCollectionTitle) {
    normalized = `${normalized} Saga`.trim();
    // console.log(`[TMDB Normalisation] Ajout de "Saga" au titre de personnage connu: "${normalized}"`);
  }
  
  // Supprimer les plages d'années pour les collections
  if (isCollectionTitle) {
    normalized = normalized.replace(/\b\d{4}-\d{4}\b/g, '').trim();
  }
  // Sinon, ajouter l'année si elle existe et n'est pas déjà dans le titre normalisé
  else if (year && !normalized.includes(year)) {
    normalized = `${normalized} ${year}`;
  }
  
  // Dernière passe de nettoyage pour les titres courts (moins de 3 mots)
  // Pour éviter que des titres comme "Six jours 2024" deviennent "Six jours 2024 TyHD"
  if (normalized.split(/\s+/).length <= 3) {
    // Supprimer tous les groupes de release connus une dernière fois
    normalized = normalized.replace(/\b(?:TyHD|BULiTT|BTT|THESYNDiCATE|FW|MULTI|VFF|VFI|VOSTFR|FRENCH)\b/gi, '');
    normalized = normalized.replace(/\s+/g, ' ').trim();
  }
  
  // console.log(`[TMDB Normalisation] Titre final: "${normalized}"`);
  return normalized;
}

export default {
  normalizeTitleForSearch,
  normalizeTitleForTMDB
};
