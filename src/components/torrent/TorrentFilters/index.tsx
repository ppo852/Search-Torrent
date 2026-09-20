import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount =
    (currentStatus !== 'all' ? 1 : 0) +
    (currentCategory ? 1 : 0) +
    (currentTracker ? 1 : 0);

  const renderFiltersPanel = () => (
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
  );

  return (
    <div className="space-y-3">
      <div className="w-full">
        <SearchFilter
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      </div>

      <div className="lg:hidden space-y-3">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-transparent border border-blue-500/20 text-white hover:border-blue-500/40 transition-all"
          aria-expanded={mobileFiltersOpen}
        >
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <SlidersHorizontal size={14} />
            Filtres
            {activeFilterCount > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-300 ${mobileFiltersOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {mobileFiltersOpen && renderFiltersPanel()}
      </div>

      <div className="hidden lg:block">{renderFiltersPanel()}</div>
    </div>
  );
};

export { StatusFilter, CategoryFilter, TrackerFilter, SearchFilter, SortingFilter };
