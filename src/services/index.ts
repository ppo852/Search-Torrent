/**
 * Point d'entrée principal pour tous les services de l'application
 * Permet un import centralisé des différents services
 */

// Import et re-export des services API
export * from './api';
export { default as apiService } from './api';

// Import et re-export des services TMDB
export * from './tmdb';
export { default as tmdbService } from './tmdb';

// Import et re-export des services Prowlarr
export * from './prowlarr';
export { default as prowlarrService } from './prowlarr';

// Import et re-export des services de paramètres
export * from './settings';
export { default as settingsService } from './settings';

// Import et re-export des services de base de données
export * from './database';
export { default as databaseService, db } from './database';
