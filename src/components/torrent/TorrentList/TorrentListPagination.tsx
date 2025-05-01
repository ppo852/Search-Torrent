import React from 'react';

interface TorrentListPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  itemsPerPageOptions: number[];
}

export const TorrentListPagination: React.FC<TorrentListPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions
}) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between mt-4 bg-gray-800 p-4 rounded-lg gap-4">
      <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm text-gray-400">Éléments par page:</span>
          <select
            className="bg-gray-700 text-sm rounded-lg p-2 border border-gray-600"
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          >
            {itemsPerPageOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-400 md:ml-4">
          {totalItems} torrents au total
        </span>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-center">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-3 md:p-2 rounded-lg bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
        >
          ««
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-3 md:p-2 rounded-lg bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
        >
          «
        </button>

        <span className="px-4 py-2 rounded-lg bg-blue-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
          {currentPage}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-3 md:p-2 rounded-lg bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
        >
          »
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-3 md:p-2 rounded-lg bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
        >
          »»
        </button>
      </div>
    </div>
  );
};
