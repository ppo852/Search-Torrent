import React from 'react';
import { StatusFilter } from './StatusFilter';
import { CategoryFilter } from './CategoryFilter';
import { SearchFilter } from './SearchFilter';
import { SortingFilter } from './SortingFilter';
import { TorrentStatus, SortField } from '../../../types/qbittorrent';

interface TorrentFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentStatus: TorrentStatus;
  onStatusChange: (status: TorrentStatus) => void;
  categories: string[];
  currentCategory: string;
  onCategoryChange: (category: string) => void;
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
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <StatusFilter 
          currentStatus={currentStatus} 
          onStatusChange={onStatusChange} 
          className="w-full sm:w-1/3"
        />
        <CategoryFilter 
          categories={categories} 
          currentCategory={currentCategory} 
          onCategoryChange={onCategoryChange} 
          className="w-full sm:w-1/3"
        />
        <SortingFilter 
          currentSortField={currentSortField}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          onDirectionChange={onDirectionChange}
          className="w-full sm:w-1/3"
        />
      </div>
    </div>
  );
};

export { StatusFilter, CategoryFilter, SearchFilter, SortingFilter };
