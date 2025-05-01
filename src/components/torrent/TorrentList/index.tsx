import React from 'react';
import { Torrent } from '../../../types/qbittorrent';
import { TorrentItem } from './TorrentItem';

interface TorrentListProps {
  torrents: Torrent[];
  selectedTorrents: Set<string>;
  toggleTorrentSelection: (hash: string) => void;
  handleSingleDelete: (hash: string) => void;
  fetchTorrents: () => void;
  api: {
    pauseTorrent: (hash: string) => Promise<any>;
    resumeTorrent: (hash: string) => Promise<any>;
  };
}

export const TorrentList: React.FC<TorrentListProps> = ({
  torrents,
  selectedTorrents,
  toggleTorrentSelection,
  handleSingleDelete,
  fetchTorrents,
  api
}) => {
  return (
    <div className="space-y-4">
      {torrents.map(torrent => (
        <TorrentItem
          key={torrent.hash}
          torrent={torrent}
          isSelected={selectedTorrents.has(torrent.hash)}
          onSelect={toggleTorrentSelection}
          onPause={(hash) => api.pauseTorrent(hash).then(fetchTorrents)}
          onResume={(hash) => api.resumeTorrent(hash).then(fetchTorrents)}
          onDelete={handleSingleDelete}
          fetchTorrents={fetchTorrents}
        />
      ))}
      
      {torrents.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">Aucun torrent ne correspond aux critères de recherche.</p>
        </div>
      )}
    </div>
  );
};
