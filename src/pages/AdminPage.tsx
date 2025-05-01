import React, { useState, useEffect } from 'react';
import { UserPlus, Settings, Users, Rss } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

// Imports des composants depuis la nouvelle structure
import { UserSettingsModal } from '../components/settings/UserSettingsModal';
import { AdminRssFeedManager } from '../components/rss/AdminRssFeedManager';

// Imports des services depuis la nouvelle structure
import { db } from '../services/database';
import { globalSettings } from '../services/settings';

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
  qbit_url?: string;
  qbit_username?: string;
  qbit_password?: string;
}

export function AdminPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false });
  const [globalConfig, setGlobalConfig] = useState({
    prowlarr_url: '',
    prowlarr_api_key: '',
    tmdb_access_token: '',
    min_seeds: 3
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (currentUser && !currentUser.is_admin) {
      window.location.href = '/';
    }
  }, [currentUser]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const loadedUsers = await db.getAllUsers();
      setUsers(loadedUsers || []);

      const settings = await globalSettings.load();
      if (settings) {
        setGlobalConfig({
          prowlarr_url: settings.prowlarr_url || '',
          prowlarr_api_key: settings.prowlarr_api_key || '',
          tmdb_access_token: settings.tmdb_access_token || '',
          min_seeds: settings.min_seeds || 3
        });
      }
    } catch (err) {
      setError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.createUser(newUser.username, newUser.password, newUser.is_admin);
      setSuccess('Utilisateur créé avec succès');
      setNewUser({ username: '', password: '', is_admin: false });
      loadInitialData();
    } catch (err) {
      setError('Erreur lors de la création de l\'utilisateur');
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      await db.updateUser(userId, updates);
      setSuccess('Utilisateur mis à jour avec succès');
      loadInitialData();
    } catch (err) {
      setError('Erreur lors de la mise à jour de l\'utilisateur');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      await db.deleteUser(userId);
      setSuccess('Utilisateur supprimé avec succès');
      loadInitialData();
    } catch (err) {
      setError('Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalSettings.save(globalConfig);
      setSuccess('Configuration globale mise à jour avec succès');
    } catch (err) {
      setError('Erreur lors de la mise à jour de la configuration globale');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!currentUser?.is_admin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 ${activeTab === 'users' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'} rounded-md flex items-center space-x-2`}
        >
          <Users size={20} />
          <span>Utilisateurs</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 ${activeTab === 'settings' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'} rounded-md flex items-center space-x-2`}
        >
          <Settings size={20} />
          <span>Configuration</span>
        </button>
        <button
          onClick={() => setActiveTab('rss')}
          className={`px-4 py-2 ${activeTab === 'rss' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'} rounded-md flex items-center space-x-2`}
        >
          <Rss size={20} />
          <span>Flux RSS</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-500 text-green-200 rounded">
          {success}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-100">Gestion des utilisateurs</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between bg-gray-700/50 p-4 rounded"
              >
                <div>
                  <h3 className="font-medium text-gray-200">
                    {user.username}
                    {user.is_admin && (
                      <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                        Admin
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">Créé le {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <Settings size={20} />
                  </button>
                  {!user.is_admin && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <UserPlus size={20} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-200 mb-4">Ajouter un utilisateur</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_admin"
                  checked={newUser.is_admin}
                  onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_admin" className="text-sm text-gray-300">
                  Administrateur
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded"
              >
                Ajouter
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-100">Configuration globale</h2>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                URL Prowlarr
              </label>
              <input
                type="url"
                value={globalConfig.prowlarr_url}
                onChange={(e) =>
                  setGlobalConfig({ ...globalConfig, prowlarr_url: e.target.value })
                }
                className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                placeholder="http://localhost:9696"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Clé API Prowlarr
              </label>
              <input
                type="password"
                value={globalConfig.prowlarr_api_key}
                onChange={(e) =>
                  setGlobalConfig({ ...globalConfig, prowlarr_api_key: e.target.value })
                }
                className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Token d'accès TMDB
              </label>
              <input
                type="password"
                value={globalConfig.tmdb_access_token}
                onChange={(e) =>
                  setGlobalConfig({ ...globalConfig, tmdb_access_token: e.target.value })
                }
                className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre minimum de seeds
              </label>
              <input
                type="number"
                value={globalConfig.min_seeds}
                onChange={(e) =>
                  setGlobalConfig({
                    ...globalConfig,
                    min_seeds: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                min="0"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded"
            >
              Enregistrer
            </button>
          </form>
        </div>
      )}

      {activeTab === 'rss' && currentUser && (
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Gestion des Flux RSS</h2>
          <AdminRssFeedManager user={currentUser} />
        </div>
      )}

      {selectedUser && (
        <UserSettingsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={handleUpdateUser}
          isAdmin={true}
        />
      )}
    </div>
  );
}