export interface GlobalStats {
    totalUploaded: number;
    totalDownloaded: number;
    globalRatio: number;
    freeSpace: number;
}

export interface Torrent {
    name: string;
    size: number;
    progress: number;
    state: string;
    hash: string;
    dlspeed: number;
    upspeed: number;
    ratio: number;
    added_on: number; // Timestamp Unix de l'ajout
    tracker: string;  // Tracker principal
    category?: string; // Catégorie du torrent (optionnelle)
}

export type TorrentStatus = 'all' | 'downloading' | 'seeding' | 'completed' | 'paused' | 'checking' | 'queued' | 'error' | 'metaDL';
export type SortField = 'name' | 'size' | 'ratio' | 'upspeed' | 'dlspeed' | 'progress' | 'tracker' | 'added_on';
export type SortDirection = 'asc' | 'desc';

export interface TorrentFilters {
  status: TorrentStatus;
  category: string;
  search: string;
  sortBy: SortField;
  sortDirection: SortDirection;
}
