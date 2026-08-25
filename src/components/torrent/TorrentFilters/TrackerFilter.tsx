import React from 'react';

export interface TrackerOption {
  name: string;
  count: number;
}

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
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      <select
        className="w-full appearance-none pl-10 pr-4 py-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        value={currentTracker}
        onChange={(e) => onTrackerChange(e.target.value)}
      >
        <option value="">Tous les trackers</option>
        {trackers.map(({ name, count }) => (
          <option key={name} value={name}>
            {name} ({count})
          </option>
        ))}
      </select>
      <div className="absolute left-3 top-0 h-full flex items-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
    </div>
  );
};
