import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { SortOption } from '../../types';

interface SortControlsProps {
  sortOption: SortOption;
  sortDirection: 'asc' | 'desc';
  onSort: (option: SortOption, direction?: 'asc' | 'desc') => void;
  className?: string;
}

export function SortControls({
  sortOption,
  sortDirection,
  onSort,
  className = 'mt-6',
}: SortControlsProps) {
  const sortButtons = [
    { value: 'name' as SortOption, label: 'Nom' },
    { value: 'size' as SortOption, label: 'Taille' },
    { value: 'seeds' as SortOption, label: 'Sources' },
    { value: 'date' as SortOption, label: 'Date' }
  ];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-sm text-blue-400/60 mr-2">Trier par</span>
      <div className="flex flex-wrap gap-2">
        {sortButtons.map((button) => (
          <button
            key={button.value}
            type="button"
            onClick={() => onSort(button.value, sortDirection === 'asc' ? 'desc' : 'asc')}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
              sortOption === button.value
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-transparent border-blue-500/20 text-white/80 hover:border-blue-500/40 hover:bg-blue-600/10'
            }`}
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSort(sortOption, sortDirection === 'asc' ? 'desc' : 'asc')}
          className="p-1.5 rounded-xl bg-transparent border border-blue-500/20 text-blue-400/70 hover:text-white hover:border-blue-500/40 hover:bg-blue-600/10 transition-colors"
          title={sortDirection === 'asc' ? 'Tri croissant' : 'Tri décroissant'}
        >
          <ArrowUpDown
            size={20}
            className={`transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </div>
  );
}
