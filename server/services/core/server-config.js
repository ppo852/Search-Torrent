/**
 * Configuration du serveur Express
 * Ce module centralise la configuration du serveur et des middlewares
 */

import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fileUpload from 'express-fileupload';
import sqlite3 from 'sqlite3';

// Import des routes
import rssRoutes from '../../routes/rss/index.js';
import authRoutes from '../../routes/auth/index.js';
import settingsRoutes from '../../routes/settings/index.js';
import usersRoutes from '../../routes/users/index.js';
import qbittorrentRoutes from '../../routes/qbittorrent/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure l'application Express avec les middlewares et les routes
 * @returns {Object} L'application Express configurée et les variables d'environnement
 */
export function configureServer() {
  // Initialisation de l'application Express
  const app = express();
  
  // Variables d'environnement
  const port = process.env.PORT || 3001;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Configuration des middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Limite à 50MB
    abortOnLimit: true
  }));
  
  // Configuration de la base de données
  const dbPath = join(dirname(dirname(dirname(__dirname))), 'data/database.sqlite');
  const db = new sqlite3.Database(dbPath);
  app.locals.db = db;  // Rendre la db accessible aux routes
  
  // Montage des routes API
  app.use('/api/rss', rssRoutes);
  app.use('/api/qbittorrent', qbittorrentRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/users', usersRoutes);
  
  // Route de compatibilité pour maintenir l'ancien endpoint de login
  app.post('/api/login', (req, res) => {
    // Rediriger vers le nouvel endpoint
    req.url = '/api/auth/login';
    app._router.handle(req, res);
  });
  
  // Fichiers statiques en production
  if (!isDevelopment) {
    const distPath = join(dirname(dirname(dirname(__dirname))), 'dist');
    if (existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(join(distPath, 'index.html'));
      });
    }
  }
  
  return {
    app,
    port,
    JWT_SECRET,
    isDevelopment,
    db
  };
}

export default {
  configureServer
};
