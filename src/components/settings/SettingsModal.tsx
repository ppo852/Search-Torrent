import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const user = useAuthStore((state) => state.user);
  const updateUserSettings = useAuthStore((state) => state.updateUserSettings);
  const [settings, setSettings] = useState({
    prowlarrUrl: user?.prowlarrUrl || '',
    prowlarrApiKey: user?.prowlarrApiKey || '',
  });

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserSettings({
      id: user.id,
      prowlarrUrl: settings.prowlarrUrl,
      prowlarrApiKey: settings.prowlarrApiKey,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Paramètres Prowlarr</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">URL Prowlarr</label>
                <input
                  type="url"
                  value={settings.prowlarrUrl}
                  onChange={(e) => setSettings(s => ({ ...s, prowlarrUrl: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="http://localhost:9696"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Clé API Prowlarr</label>
                <input
                  type="text"
                  value={settings.prowlarrApiKey}
                  onChange={(e) => setSettings(s => ({ ...s, prowlarrApiKey: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Votre clé API"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}