import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SortField } from '../../../types/qbittorrent';

interface SortingFilterProps {
  currentSortField: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField) => void;
  onDirectionChange: () => void;
  className?: string;
}

export const SortingFilter: React.FC<SortingFilterProps> = ({
  currentSortField,
  sortDirection,
  onSortChange,
  onDirectionChange,
  className = ''
}) => {
  const sortOptions = [
    { value: 'name', label: 'Nom' },
    { value: 'size', label: 'Taille' },
    { value: 'progress', label: 'Progression' },
    { value: 'dlspeed', label: 'Vitesse DL' },
    { value: 'upspeed', label: 'Vitesse UP' },
    { value: 'eta', label: 'Temps restant' },
    { value: 'ratio', label: 'Ratio' },
    { value: 'added_on', label: 'Date d\'ajout' }
  ];

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        <select
          value={currentSortField}
          onChange={(e) => onSortChange(e.target.value as SortField)}
          className="w-full appearance-none pl-10 pr-10 py-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <button
          onClick={onDirectionChange}
          className="absolute right-2 top-0 h-full flex items-center text-gray-400 hover:text-white"
          title={sortDirection === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
        >
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </button>
      </div>
      
      <div className="absolute left-3 top-0 h-full flex items-center text-gray-400">
        <ArrowUpDown className="h-4 w-4" />
      </div>
    </div>
  );
};
