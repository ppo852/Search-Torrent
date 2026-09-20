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
    <div className="flex flex-col gap-3">
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
    </div>
  );
};
