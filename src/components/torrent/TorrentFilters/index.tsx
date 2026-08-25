import React from 'react';
import { StatusFilter } from './StatusFilter';
import { CategoryFilter } from './CategoryFilter';
import { SearchFilter } from './SearchFilter';
import { SortingFilter } from './SortingFilter';
import { TrackerFilter } from './TrackerFilter';
import { TorrentStatus, SortField } from '../../../types/qbittorrent';
import type { TrackerOption } from '../../../hooks/useTorrentFilters';

interface TorrentFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentStatus: TorrentStatus;
  onStatusChange: (status: TorrentStatus) => void;
  categories: string[];
  currentCategory: string;
  onCategoryChange: (category: string) => void;
  trackers: TrackerOption[];
  currentTracker: string;
  onTrackerChange: (tracker: string) => void;
  currentSortField: SortField;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: SortField) => void;
  onDirectionChange: () => void;
}

export const TorrentFilters: React.FC<TorrentFiltersProps> = ({
  searchQuery,
  onSearchChange,
  currentStatus,
  onStatusChange,
  categories,
  currentCategory,
  onCategoryChange,
  trackers,
  currentTracker,
  onTrackerChange,
  currentSortField,
  sortDirection,
  onSortChange,
  onDirectionChange
}) => {
  return (
    <div className="space-y-3">
      {/* Barre de recherche - pleine largeur sur tous les écrans */}
      <div className="w-full">
        <SearchFilter 
          searchQuery={searchQuery} 
          onSearchChange={onSearchChange} 
        />
      </div>
      
      {/* Filtres sur la même ligne sur desktop, empilés sur mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        <StatusFilter 
          currentStatus={currentStatus} 
          onStatusChange={onStatusChange} 
          className="w-full"
        />
        <CategoryFilter 
          categories={categories} 
          currentCategory={currentCategory} 
          onCategoryChange={onCategoryChange} 
          className="w-full"
        />
        <TrackerFilter
          trackers={trackers}
          currentTracker={currentTracker}
          onTrackerChange={onTrackerChange}
          className="w-full"
        />
        <SortingFilter 
          currentSortField={currentSortField}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          onDirectionChange={onDirectionChange}
          className="w-full"
        />
      </div>
    </div>
  );
};

export { StatusFilter, CategoryFilter, TrackerFilter, SearchFilter, SortingFilter };
