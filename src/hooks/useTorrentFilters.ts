import { useState, useEffect, useMemo } from 'react';
import { Torrent, TorrentStatus } from '../types/qbittorrent';
import { isTorrentError } from '../utils/torrentUtils';

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
  categories: string[];
}

export const useTorrentFilters = ({ torrents }: UseTorrentFiltersProps): UseTorrentFiltersResult => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<TorrentStatus>('all');
  const [currentCategory, setCurrentCategory] = useState<string>('');

  // Extraire les catégories uniques des torrents
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    torrents.forEach(torrent => {
      if (torrent.category) {
        uniqueCategories.add(torrent.category);
      }
    });
    return Array.from(uniqueCategories).sort();
  }, [torrents]);

  // Filtrer les torrents en fonction des critères
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

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [torrents, searchQuery, currentStatus, currentCategory]);

  return {
    filteredTorrents,
    searchQuery,
    setSearchQuery,
    currentStatus,
    setCurrentStatus,
    currentCategory,
    setCurrentCategory,
    categories
  };
};
