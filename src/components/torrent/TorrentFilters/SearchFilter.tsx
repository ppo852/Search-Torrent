import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// [DEBUG ONLY] console.log('SearchFilter loaded');
export const SearchFilter: React.FC<SearchFilterProps> = ({
  searchQuery,
  onSearchChange
}) => {
  // [DEBUG ONLY] console.log('useState initialized with', searchQuery);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Synchroniser l'état local avec les props
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Gérer la soumission du formulaire
  // [DEBUG ONLY] console.log('handleSubmit called');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localQuery);
  };

  // Effacer la recherche
  // [DEBUG ONLY] console.log('clearSearch called');
  const clearSearch = () => {
    setLocalQuery('');
    onSearchChange('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full p-2 pl-9 pr-9 bg-gray-800 border-0 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
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
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
    </form>
  );
};
