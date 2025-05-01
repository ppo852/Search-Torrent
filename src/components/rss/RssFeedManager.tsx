import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '../../services/database/db';

interface RssFeed {
  id: string;
  feed_name: string;
  feed_url: string;
}

interface RssFeedManagerProps {
  userId: string;
  onUpdate?: () => void;
}

export function RssFeedManager({ userId, onUpdate }: RssFeedManagerProps) {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [newFeed, setNewFeed] = useState({ feed_name: '', feed_url: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadFeeds();
  }, [userId]);

  const loadFeeds = async () => {
    try {
      const userFeeds = await db.getUserRssFeeds(userId);
      setFeeds(userFeeds || []);
    } catch (err) {
      setError('Erreur lors du chargement des flux RSS');
    }
  };

  const handleAddFeed = async () => {
    if (!newFeed.feed_name || !newFeed.feed_url) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      await db.addRssFeed(userId, newFeed.feed_name, newFeed.feed_url);
      setNewFeed({ feed_name: '', feed_url: '' });
      setSuccess('Flux RSS ajouté avec succès');
      loadFeeds();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError('Erreur lors de l\'ajout du flux RSS');
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    try {
      await db.deleteRssFeed(feedId);
      setSuccess('Flux RSS supprimé avec succès');
      loadFeeds();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError('Erreur lors de la suppression du flux RSS');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-2 rounded">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {feeds.map((feed) => (
          <div
            key={feed.id}
            className="flex items-center justify-between bg-gray-700/50 p-4 rounded"
          >
            <div>
              <h3 className="font-medium text-gray-200">{feed.feed_name}</h3>
              <p className="text-sm text-gray-400">{feed.feed_url}</p>
            </div>
            <button
              onClick={() => handleDeleteFeed(feed.id)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h3 className="font-medium text-gray-200 mb-4">Ajouter un flux RSS</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nom du flux
            </label>
            <input
              type="text"
              value={newFeed.feed_name}
              onChange={(e) => setNewFeed({ ...newFeed, feed_name: e.target.value })}
              className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
              placeholder="Ex: Films HD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              URL du flux RSS
            </label>
            <input
              type="url"
              value={newFeed.feed_url}
              onChange={(e) => setNewFeed({ ...newFeed, feed_url: e.target.value })}
              className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
              placeholder="https://exemple.com/rss"
            />
          </div>
          <button
            onClick={handleAddFeed}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
          >
            <Plus size={20} />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
