import React from 'react';
import { TorrentStatus } from '../../../types/qbittorrent';

interface StatusFilterProps {
  currentStatus: TorrentStatus;
  onStatusChange: (status: TorrentStatus) => void;
  className?: string;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  currentStatus,
  onStatusChange,
  className = ''
}) => {
  // Options pour les filtres
  const statusOptions: { value: TorrentStatus; label: string }[] = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'downloading', label: 'En téléchargement' },
    { value: 'metaDL', label: 'Téléchargement métadonnées' },
    { value: 'seeding', label: 'En partage' },
    { value: 'completed', label: 'Terminé' },
    { value: 'paused', label: 'En pause' },
    { value: 'checking', label: 'En vérification' },
    { value: 'queued', label: 'En file d\'attente' },
    { value: 'error', label: 'En erreur' }
  ];

  return (
    <div className={`relative ${className}`}>
      <select
        value={currentStatus}
        onChange={(e) => onStatusChange(e.target.value as TorrentStatus)}
        className="w-full appearance-none pl-10 pr-4 py-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      >
        {statusOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute left-3 top-0 h-full flex items-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
      </div>
    </div>
  );
};
