import { useState, useMemo } from 'react';
import { Torrent, TorrentStatus } from '../types/qbittorrent';
import { isTorrentError, getTrackerName } from '../utils/torrentUtils';

export interface TrackerOption {
  name: string;
  count: number;
}

interface UseTorrentFiltersProps {
  torrents: Torrent[];
}

interface UseTorrentFiltersResult {
  filteredTorrents: Torrent[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentStatus: TorrentStatus;
  setCurrentStatus: (status: TorrentStatus) => void;
  currentCategory: string;
  setCurrentCategory: (category: string) => void;
  currentTracker: string;
  setCurrentTracker: (tracker: string) => void;
  trackers: TrackerOption[];
  categories: string[];
}

export const useTorrentFilters = ({ torrents }: UseTorrentFiltersProps): UseTorrentFiltersResult => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<TorrentStatus>('all');
  const [currentCategory, setCurrentCategory] = useState<string>('');
  const [currentTracker, setCurrentTracker] = useState<string>('');

  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    torrents.forEach(torrent => {
      if (torrent.category) {
        uniqueCategories.add(torrent.category);
      }
    });
    return Array.from(uniqueCategories).sort();
  }, [torrents]);

  const trackers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const torrent of torrents) {
      if (!torrent.tracker) continue;
      const name = getTrackerName(torrent.tracker);
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [torrents]);

  const filteredTorrents = useMemo(() => {
    return torrents.filter(torrent => {
      // Filtre par recherche
      const matchesSearch = searchQuery === '' || 
        torrent.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtre par statut
      let matchesStatus = true;
      if (currentStatus !== 'all') {
        if (currentStatus === 'downloading') {
          matchesStatus = torrent.state === 'downloading' || torrent.state === 'stalledDL' || torrent.state === 'metaDL';
        } else if (currentStatus === 'seeding') {
          matchesStatus = torrent.state === 'uploading' || torrent.state === 'stalledUP' || torrent.state === 'forcedUP';
        } else if (currentStatus === 'completed') {
          matchesStatus = torrent.progress === 1 && !['error', 'missingFiles'].includes(torrent.state);
        } else if (currentStatus === 'paused') {
          matchesStatus = torrent.state === 'pausedUP' || torrent.state === 'pausedDL';
        } else if (currentStatus === 'checking') {
          matchesStatus = torrent.state.includes('check');
        } else if (currentStatus === 'queued') {
          matchesStatus = torrent.state.includes('queued');
        } else if (currentStatus === 'error') {
          matchesStatus = isTorrentError(torrent);
        } else if (currentStatus === 'metaDL') {
          matchesStatus = torrent.state === 'metaDL';
        }
      }

      // Filtre par catégorie
      const matchesCategory = currentCategory === '' || torrent.category === currentCategory;

      const matchesTracker = currentTracker === ''
        || (torrent.tracker && getTrackerName(torrent.tracker) === currentTracker);

      return matchesSearch && matchesStatus && matchesCategory && matchesTracker;
    });
  }, [torrents, searchQuery, currentStatus, currentCategory, currentTracker]);

  return {
    filteredTorrents,
    searchQuery,
    setSearchQuery,
    currentStatus,
    setCurrentStatus,
    currentCategory,
    setCurrentCategory,
    currentTracker,
    setCurrentTracker,
    trackers,
    categories
  };
};
