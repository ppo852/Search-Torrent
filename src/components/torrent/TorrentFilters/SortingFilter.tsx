import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { FilterSelect } from '../../ui/FilterSelect';
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
  className = '',
}) => {
  const sortOptions = [
    { value: 'name', label: 'Nom' },
    { value: 'size', label: 'Taille' },
    { value: 'progress', label: 'Progression' },
    { value: 'dlspeed', label: 'Vitesse DL' },
    { value: 'upspeed', label: 'Vitesse UP' },
    { value: 'eta', label: 'Temps restant' },
    { value: 'ratio', label: 'Ratio' },
    { value: 'added_on', label: "Date d'ajout" },
    { value: 'tracker', label: 'Indexeur (Tracker)' },
  ];

  return (
    <FilterSelect
      className={className}
      value={currentSortField}
      onChange={(v) => onSortChange(v as SortField)}
      options={sortOptions}
      icon={<ArrowUpDown className="h-4 w-4" />}
      endAdornment={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDirectionChange();
          }}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-blue-600/20 transition-colors"
          title={sortDirection === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
        >
          {sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </button>
      }
    />
  );
};
