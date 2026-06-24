// Handlers pour les routes utilisateurs
import userService from '../../services/users/index.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { get, run } from '../../services/core/db.js';

/**
 * Récupère la liste des utilisateurs
 */
export async function getUsersHandler(req, res) {
  try {
    if (!req.user?.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des utilisateurs' });
  }
}

/**
 * Crée un nouvel utilisateur
 */
export async function createUserHandler(req, res) {
  try {
    const { username, password, is_admin, qbit_url, qbit_username, qbit_password, download_path_movies, download_path_series, download_path_anime } = req.body;
    
    // Validation basique
    if (!username || !password) {
      return res.status(400).json({ error: 'Le nom d\'utilisateur et le mot de passe sont requis' });
    }
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }
    
    if (is_admin && !req.user?.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    // Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Génération d'un ID unique
    const userId = randomUUID();
    const now = new Date().toISOString();
    const adminFlag = req.user?.is_admin && is_admin ? 1 : 0;
    
    // Insertion dans la base de données
    const result = await run(
      `INSERT INTO users (id, username, password, is_admin, created_at, qbit_url, qbit_username, qbit_password, download_path_movies, download_path_series, download_path_anime) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        hashedPassword,
        adminFlag,
        now,
        qbit_url || null,
        qbit_username || null,
        qbit_password || null,
        download_path_movies || null,
        download_path_series || null,
        download_path_anime || null
      ]
    );
    
    if (result && result.changes > 0) {
      // Récupérer l'utilisateur nouvellement créé sans le mot de passe
      const newUser = await get(
        `SELECT id, username, is_admin, created_at, qbit_url, qbit_username, download_path_movies, download_path_series, download_path_anime FROM users WHERE id = ?`,
        [userId]
      );
      
      res.status(201).json({
        ...newUser,
        is_admin: !!newUser.is_admin
      });
    } else {
      res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
    }
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création de l\'utilisateur' });
  }
}

/**
 * Récupère les détails d'un utilisateur par son ID
 */
export async function getUserByIdHandler(req, res) {
  try {
    const { id } = req.params;
    
    // Vérifier si l'utilisateur qui fait la requête est admin ou l'utilisateur demandé
    if (!req.user.is_admin && req.user.id !== id) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }
    
    const user = await userService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération de l\'utilisateur' });
  }
}

/**
 * Met à jour un utilisateur
 */
export async function updateUserHandler(req, res) {
  try {
    const { id } = req.params;
    const { 
      username, 
      password, 
      is_admin, 
      qbit_url, 
      qbit_username, 
      qbit_password,
      download_path_movies,
      download_path_series,
      download_path_anime,
      allow_force_interactive_download
    } = req.body;
    
    // Vérifier si l'utilisateur qui fait la requête est admin ou l'utilisateur demandé
    if (!req.user.is_admin && req.user.id !== id) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }
    
    // Vérifier que l'utilisateur existe
    const existingUser = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Si l'utilisateur souhaite changer son nom d'utilisateur, vérifier s'il existe déjà
    if (username && username !== existingUser.username) {
      const userWithSameUsername = await get('SELECT * FROM users WHERE username = ? AND id != ?', [username, id]);
      if (userWithSameUsername) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
      }
    }
    
    // Construire la requête de mise à jour dynamiquement
    let updateFields = [];
    let params = [];
    
    if (username) {
      updateFields.push('username = ?');
      params.push(username);
    }
    
    if (password) {
      updateFields.push('password = ?');
      params.push(await bcrypt.hash(password, 10));
    }
    
    // Seul un admin peut changer le statut admin d'un utilisateur
    if (typeof is_admin !== 'undefined' && req.user.is_admin) {
      updateFields.push('is_admin = ?');
      params.push(is_admin ? 1 : 0);
    }
    
    if (typeof qbit_url !== 'undefined') {
      updateFields.push('qbit_url = ?');
      params.push(qbit_url || null);
    }
    
    if (typeof qbit_username !== 'undefined') {
      updateFields.push('qbit_username = ?');
      params.push(qbit_username || null);
    }
    
    // Le mot de passe qBittorrent : ne mettre à jour que si une nouvelle valeur non vide est fournie
    if (typeof qbit_password === 'string' && qbit_password.trim() !== '') {
      updateFields.push('qbit_password = ?');
      params.push(qbit_password);
    }

    if (download_path_movies !== undefined) {
      updateFields.push('download_path_movies = ?');
      params.push(download_path_movies);
    }

    if (download_path_series !== undefined) {
      updateFields.push('download_path_series = ?');
      params.push(download_path_series);
    }

    if (download_path_anime !== undefined) {
      updateFields.push('download_path_anime = ?');
      params.push(download_path_anime);
    }

    if (typeof allow_force_interactive_download !== 'undefined' && req.user.is_admin) {
      updateFields.push('allow_force_interactive_download = ?');
      params.push(allow_force_interactive_download ? 1 : 0);
    }
    
    // S'il n'y a rien à mettre à jour
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }
    
    // Ajouter l'ID à la fin des paramètres
    params.push(id);
    
    // Exécuter la requête de mise à jour
    const result = await run(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    
    if (result && result.changes > 0) {
      // Récupérer l'utilisateur mis à jour
      const updatedUser = await get(
        `SELECT id, username, is_admin, created_at, qbit_url, qbit_username, download_path_movies, download_path_series, download_path_anime, allow_force_interactive_download FROM users WHERE id = ?`,
        [id]
      );
      
      res.json({
        ...updatedUser,
        is_admin: !!updatedUser.is_admin,
        allow_force_interactive_download: !!updatedUser.allow_force_interactive_download
      });
    } else {
      res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de l\'utilisateur' });
  }
}

/**
 * Supprime un utilisateur
 */
export async function deleteUserHandler(req, res) {
  try {
    if (!req.user?.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const { id } = req.params;
    
    // Vérifier que l'utilisateur existe
    const existingUser = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Empêcher la suppression de l'admin principal
    if (existingUser.username === 'admin') {
      return res.status(403).json({ error: 'Impossible de supprimer l\'utilisateur admin principal' });
    }
    
    // Supprimer l'utilisateur
    const result = await run('DELETE FROM users WHERE id = ?', [id]);
    
    if (result && result.changes > 0) {
      res.json({ message: 'Utilisateur supprimé avec succès' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de l\'utilisateur' });
  }
}
