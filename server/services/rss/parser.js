import { parseString } from 'xml2js';
import fetch from 'node-fetch';
import { normalizeTitleForSearch } from './normalizer.js';
import { detectCategory } from './category.js';

// Classes d'erreur pour la gestion des flux RSS
export class RSSError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'RSSError';
    this.originalError = originalError;
  }
}

export class RSSFetchError extends RSSError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'RSSFetchError';
  }
}

export class RSSParseError extends RSSError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'RSSParseError';
  }
}

export class RSSFormatError extends RSSError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'RSSFormatError';
  }
}

/**
 * Analyse un flux RSS à partir d'une URL
 * @param {string} url - URL du flux RSS à récupérer et analyser
 * @returns {Promise<Array>} Tableau d'objets représentant les éléments du flux
 * @throws {RSSFetchError} Si une erreur se produit lors de la récupération
 * @throws {RSSParseError} Si une erreur se produit lors de l'analyse XML
 * @throws {RSSFormatError} Si le format du flux n'est pas reconnu
 */
export async function parseRSSFeed(url) {
  try {
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      throw new RSSFetchError(`Erreur HTTP: ${response.status}`);
    }
    
    const xml = await response.text();
    
    return new Promise((resolve, reject) => {
      parseString(xml, { trim: true }, (err, result) => {
        if (err) {
          reject(new RSSParseError('Erreur lors de l\'analyse XML', err));
          return;
        }
        
        try {
          // Traitement pour les flux RSS standard
          if (result.rss && result.rss.channel && result.rss.channel.length > 0) {
            const channel = result.rss.channel[0];
            const items = channel.item || [];
            
            const parsedItems = items.map(item => {
              // Récupérer les attributs torznab s'ils existent
              const torznabAttrs = {};
              let categoryFromTorznab = null;
              
              if (item['torznab:attr']) {
                const attrs = Array.isArray(item['torznab:attr']) 
                  ? item['torznab:attr'] 
                  : [item['torznab:attr']];
                
                // Traiter les attributs dans leur ordre d'apparition (important)
                for (let i = 0; i < attrs.length; i++) {
                  const attr = attrs[i];
                  if (attr.$ && attr.$.name && attr.$.value) {
                    switch(attr.$.name) {
                      case 'category':
                        // Ne prendre que la première catégorie trouvée
                        if (categoryFromTorznab === null) {
                          categoryFromTorznab = attr.$.value;
                        }
                        break;
                      case 'seeders':
                        torznabAttrs.seeders = parseInt(attr.$.value, 10) || 0;
                        break;
                      case 'peers':
                        torznabAttrs.peers = parseInt(attr.$.value, 10) || 0;
                        break;
                      case 'grabs':
                        torznabAttrs.grabs = parseInt(attr.$.value, 10) || 0;
                        break;
                      case 'downloadvolumefactor':
                        torznabAttrs.downloadvolumefactor = parseFloat(attr.$.value) || 1;
                        break;
                      case 'uploadvolumefactor':
                        torznabAttrs.uploadvolumefactor = parseFloat(attr.$.value) || 1;
                        break;
                      case 'size':
                        torznabAttrs.size = parseInt(attr.$.value, 10) || 0;
                        break;
                    }
                  }
                }
              }
              
              // Fallback pour les catégories standard RSS si pas de torznab
              if (categoryFromTorznab === null && item.category) {
                if (Array.isArray(item.category)) {
                  categoryFromTorznab = item.category[0];
                } else {
                  categoryFromTorznab = item.category;
                }
              }

              const title = item.title ? item.title[0] : 'Sans titre';
              const categoryCode = categoryFromTorznab;
              const detectedCategory = detectCategory(categoryCode, title);
              
              // Si la catégorie est null, on ignore cet élément
              if (detectedCategory === null) {
                return null;
              }
              
              return {
                title: title,
                link: item.link ? item.link[0] : '',
                pubDate: item.pubDate ? item.pubDate[0] : '',
                description: item.description ? item.description[0] : '',
                category: categoryCode,
                categoryName: detectedCategory, // Nouvelle propriété avec la catégorie détectée
                torrent: (item.enclosure && item.enclosure.$ && item.enclosure.$.url) ? item.enclosure.$.url : (item.link ? item.link[0] : ''),
                feedName: channel && channel.title ? channel.title[0] : '',
                size: (item.enclosure && item.enclosure[0] && item.enclosure[0].$ && item.enclosure[0].$.length) ? parseInt(item.enclosure[0].$.length, 10) : (torznabAttrs.size || 0),
                torznab_attr: Object.keys(torznabAttrs).length > 0 ? torznabAttrs : undefined
              };
            }).filter(item => item !== null); // Filtrer les éléments null
            
            resolve(parsedItems);
          } 
          // Traitement pour les flux Atom
          else if (result.feed) {
            const items = result.feed.entry || [];
            
            const parsedItems = items.map(item => {
              let categoryFromAtom = null;
              const torznabAttrs = {};
              
              // Extraire la catégorie Atom si disponible
              if (item.category) {
                const categories = Array.isArray(item.category) ? item.category : [item.category];
                if (categories.length > 0 && categories[0].$ && categories[0].$.term) {
                  categoryFromAtom = categories[0].$.term;
                }
              }
              
              const title = item.title ? (typeof item.title === 'string' ? item.title : item.title[0]._ || item.title[0]) : 'Sans titre';
              const categoryCode = categoryFromAtom;
              const detectedCategory = detectCategory(categoryCode, title);
              
              // Si la catégorie est null, on ignore cet élément
              if (detectedCategory === null) {
                return null;
              }
              
              return {
                title: title,
                link: item.link ? item.link[0].$.href : '',
                pubDate: item.published ? item.published[0] : (item.updated ? item.updated[0] : ''),
                description: item.summary ? (typeof item.summary === 'string' ? item.summary : item.summary[0]._ || item.summary[0]) : '',
                category: categoryCode,
                categoryName: detectedCategory, // Nouvelle propriété avec la catégorie détectée
                torrent: item.link ? item.link[0].$.href : '',
                size: 0, // Par défaut pour les flux Atom qui n'ont généralement pas cette information
                feedName: result.feed.title ? (typeof result.feed.title === 'string' ? result.feed.title : result.feed.title[0]) : ''
              };
            }).filter(item => item !== null); // Filtrer les éléments null
            
            resolve(parsedItems);
          } 
          else {
            reject(new RSSFormatError('Format de flux non reconnu'));
          }
        } catch (error) {
          reject(new RSSFormatError('Erreur lors du traitement du flux', error));
        }
      });
    });
  } catch (error) {
    if (error instanceof RSSError) {
      throw error;
    }
    throw new RSSFetchError(`Erreur lors de la récupération du flux: ${error.message}`, error);
  }
}

// La fonction normalizeTitleForSearch est maintenant importée depuis normalizer.js
// La fonction detectCategory est importée depuis category.js

export default {
  parseRSSFeed,
  normalizeTitleForSearch,
  detectCategory,
  RSSError,
  RSSFetchError,
  RSSParseError,
  RSSFormatError
};
