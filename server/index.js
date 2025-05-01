/**
 * Point d'entrée principal du serveur
 * Utilise les modules configurés pour initialiser et démarrer l'application
 */

import { initializeDatabase } from './services/core/init-db.js';
import schedulerService from './services/core/scheduler.js';
import serverConfig from './services/core/server-config.js';

// Configuration du serveur Express avec tous les middlewares et routes
const { app, port, db } = serverConfig.configureServer();

// Toute la configuration des middlewares, des routes et des fichiers statiques
// a été déplacée dans le module services/core/server-config.js

// Start server
try {
  // Initialiser la base de données avant de démarrer le serveur
  initializeDatabase()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        
        // Initialiser toutes les tâches planifiées (nettoyage des caches et rafraîchissement des flux RSS)
        schedulerService.initializeScheduledTasks();
      });
    })
    .catch(error => {
      console.error('Erreur lors de l\'initialisation de la base de données:', error);
      process.exit(1); // Arrêter le serveur en cas d'erreur critique
    });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}