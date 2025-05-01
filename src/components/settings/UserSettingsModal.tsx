import React, { useState } from 'react';
import { X } from 'lucide-react';
import { db } from '../../services/database/db';
import { AdminRssFeedManager } from '../rss/AdminRssFeedManager';

interface User {
  id: string;
  username: string;
  is_admin: boolean;
  qbit_url?: string;
  qbit_username?: string;
  qbit_password?: string;
}

interface UserSettingsModalProps {
  user: User;
  onClose: () => void;
  onSave: (userId: string, settings: Partial<User>) => void;
  isAdmin: boolean;
}

export function UserSettingsModal({ user, onClose, onSave, isAdmin }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState('qbittorrent');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [settings, setSettings] = useState({
    qbitUrl: user.qbit_url || '',
    qbitUsername: user.qbit_username || '',
    qbitPassword: user.qbit_password || '',
  });

  const [passwords, setPasswords] = useState({
    new: '',
    confirm: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSave(user.id, {
        qbit_url: settings.qbitUrl,
        qbit_username: settings.qbitUsername,
        qbit_password: settings.qbitPassword,
      });
      setSuccess('Paramètres mis à jour avec succès');
      setTimeout(onClose, 1500);
    } catch (err) {
      setError('Erreur lors de la mise à jour des paramètres');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwords.new !== passwords.confirm) {
      setError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    try {
      await db.updateUser(user.id, { password: passwords.new });
      setSuccess('Mot de passe modifié avec succès');
      setPasswords({ new: '', confirm: '' });
      setTimeout(onClose, 1500);
    } catch (err) {
      setError('Erreur lors du changement de mot de passe');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100">Paramètres de {user.username}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex border-b border-gray-700 mb-6">
            <button
              className={`px-4 py-2 -mb-px ${
                activeTab === 'qbittorrent'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400'
              }`}
              onClick={() => setActiveTab('qbittorrent')}
            >
              qBittorrent
            </button>
            <button
              className={`px-4 py-2 -mb-px ${
                activeTab === 'password'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400'
              }`}
              onClick={() => setActiveTab('password')}
            >
              Mot de passe
            </button>
            {isAdmin && (
              <button
                className={`px-4 py-2 -mb-px ${
                  activeTab === 'rss'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400'
                }`}
                onClick={() => setActiveTab('rss')}
              >
                Flux RSS
              </button>
            )}
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

          {activeTab === 'qbittorrent' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  URL qBittorrent
                </label>
                <input
                  type="url"
                  value={settings.qbitUrl}
                  onChange={(e) => setSettings({ ...settings, qbitUrl: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                  placeholder="http://localhost:8080"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nom d'utilisateur qBittorrent
                </label>
                <input
                  type="text"
                  value={settings.qbitUsername}
                  onChange={(e) => setSettings({ ...settings, qbitUsername: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mot de passe qBittorrent
                </label>
                <input
                  type="password"
                  value={settings.qbitPassword}
                  onChange={(e) => setSettings({ ...settings, qbitPassword: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded"
              >
                Enregistrer
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded"
              >
                Changer le mot de passe
              </button>
            </form>
          )}

          {activeTab === 'rss' && isAdmin && (
            <AdminRssFeedManager user={user} />
          )}
        </div>
      </div>
    </div>
  );
}