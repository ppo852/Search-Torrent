import React from 'react';
import { Filter } from 'lucide-react';
import { FilterSelect } from '../../ui/FilterSelect';
import { TorrentStatus } from '../../../types/qbittorrent';

interface StatusFilterProps {
  currentStatus: TorrentStatus;
  onStatusChange: (status: TorrentStatus) => void;
  className?: string;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  currentStatus,
  onStatusChange,
  className = '',
}) => {
  const statusOptions: { value: TorrentStatus; label: string }[] = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'downloading', label: 'En téléchargement' },
    { value: 'metaDL', label: 'Téléchargement métadonnées' },
    { value: 'seeding', label: 'En partage' },
    { value: 'completed', label: 'Terminé' },
    { value: 'paused', label: 'En pause' },
    { value: 'checking', label: 'En vérification' },
    { value: 'queued', label: "En file d'attente" },
    { value: 'error', label: 'En erreur' },
  ];

  return (
    <FilterSelect
      className={className}
      value={currentStatus}
      onChange={(v) => onStatusChange(v as TorrentStatus)}
      options={statusOptions}
      icon={<Filter className="h-4 w-4" />}
    />
  );
};
