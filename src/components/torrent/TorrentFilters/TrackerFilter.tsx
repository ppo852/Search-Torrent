import React from 'react';
import { Globe } from 'lucide-react';
import { FilterSelect } from '../../ui/FilterSelect';
import type { TrackerOption } from '../../../hooks/useTorrentFilters';

interface TrackerFilterProps {
  trackers: TrackerOption[];
  currentTracker: string;
  onTrackerChange: (tracker: string) => void;
  className?: string;
}

export const TrackerFilter: React.FC<TrackerFilterProps> = ({
  trackers,
  currentTracker,
  onTrackerChange,
  className = '',
}) => {
  const options = [
    { value: '', label: 'Tous les trackers' },
    ...trackers.map(({ name, count }) => ({
      value: name,
      label: `${name} (${count})`,
    })),
  ];

  return (
    <FilterSelect
      className={className}
      value={currentTracker}
      onChange={onTrackerChange}
      options={options}
      icon={<Globe className="h-4 w-4" />}
    />
  );
};
