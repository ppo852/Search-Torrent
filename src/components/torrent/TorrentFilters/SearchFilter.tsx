import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const DEBOUNCE_MS = 250;

export const SearchFilter: React.FC<SearchFilterProps> = ({
  searchQuery,
  onSearchChange,
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localQuery !== searchQuery) {
        onSearchChangeRef.current(localQuery);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [localQuery, searchQuery]);

  const clearSearch = () => {
    setLocalQuery('');
    onSearchChange('');
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-blue-400/70" />
        </div>
        <input
          type="text"
          className="block w-full p-2.5 pl-9 pr-9 bg-transparent border border-blue-500/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-500/40 transition-colors"
          placeholder="Rechercher un torrent..."
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
        />
        {localQuery && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3"
            onClick={clearSearch}
            aria-label="Effacer la recherche"
          >
            <X className="w-4 h-4 text-white/50 hover:text-white" />
          </button>
        )}
      </div>
    </div>
  );
};
