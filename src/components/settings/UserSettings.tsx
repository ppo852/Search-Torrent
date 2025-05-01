import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { X } from 'lucide-react';
import { db } from '../../services/database';

interface UserSettingsProps {
  userId: string;
  onClose: () => void;
}

export function UserSettings({ userId, onClose }: UserSettingsProps) {
  const [activeTab, setActiveTab] = useState('qbittorrent');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const user = useAuthStore((state) => state.user);
  
  const [settings, setSettings] = useState({
    qbitUrl: user?.qbitUrl || '',
    qbitUsername: user?.qbitUsername || '',
    qbitPassword: user?.qbitPassword || '',
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await db.updateUser(userId, {
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
    if (!user) return;

    if (passwords.new !== passwords.confirm) {
      setError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    try {
      await db.changePassword(userId, passwords.current, passwords.new);
      setSuccess('Mot de passe modifié avec succès');
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(onClose, 1500);
    } catch (err) {
      setError('Erreur lors du changement de mot de passe');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100">Paramètres utilisateur</h2>
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
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-400">
              {success}
            </div>
          )}

          {activeTab === 'qbittorrent' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200">URL qBittorrent</label>
                  <input
                    type="url"
                    value={settings.qbitUrl}
                    onChange={(e) => setSettings(s => ({ ...s, qbitUrl: e.target.value }))}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100"
                    placeholder="http://localhost:8080"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200">Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={settings.qbitUsername}
                    onChange={(e) => setSettings(s => ({ ...s, qbitUsername: e.target.value }))}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200">Mot de passe</label>
                  <input
                    type="password"
                    value={settings.qbitPassword}
                    onChange={(e) => setSettings(s => ({ ...s, qbitPassword: e.target.value }))}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200">
                    Mot de passe actuel
                  </label>
                  <input
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  Changer le mot de passe
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}