/**
 * Point d'entrée principal du serveur
 * Utilise les modules configurés pour initialiser et démarrer l'application
 */

import { initializeDatabase } from './services/core/init-db.js';
import schedulerService from './services/core/scheduler.js';
import serverConfig from './services/core/server-config.js';
import { closeDatabase } from './services/core/db.js';

// Configuration du serveur Express avec tous les middlewares et routes
const { app, port, db } = serverConfig.configureServer();

// ... (previous comments remain) ...

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[Server] Signal ${signal} reçu. Arrêt propre en cours...`);
  try {
    // Arrêter les tâches planifiées
    await schedulerService.stopAllTasks();
    
    // Fermer la base de données
    await closeDatabase();
    console.log('[Database] Connexion fermée.');
    process.exit(0);
  } catch (err) {
    console.error('[Server] Erreur lors de l\'arrêt:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
try {
  // Initialiser la base de données avant de démarrer le serveur
  initializeDatabase()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        
        // Initialiser toutes les tâches planifiées
        schedulerService.initializeScheduledTasks();
      });
    })
    .catch(error => {
      console.error('Erreur lors de l\'initialisation de la base de données:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}