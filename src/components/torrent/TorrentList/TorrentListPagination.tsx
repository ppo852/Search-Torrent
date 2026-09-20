import React from 'react';
import { FilterSelect } from '../../ui/FilterSelect';

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
  itemsPerPageOptions,
}) => {
  const pageOptions = itemsPerPageOptions.map((option) => ({
    value: String(option),
    label: String(option),
  }));

  const navBtn =
    'p-3 md:p-2 rounded-xl bg-transparent border border-blue-500/20 text-white min-h-[44px] min-w-[44px] flex items-center justify-center hover:border-blue-500/40 hover:bg-blue-600/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95';

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm text-blue-400/60 whitespace-nowrap">Éléments par page</span>
          <FilterSelect
            className="w-24"
            value={String(itemsPerPage)}
            onChange={(v) => onItemsPerPageChange(Number(v))}
            options={pageOptions}
          />
        </div>
        <span className="text-sm text-blue-400/60 md:ml-2">
          {totalItems} torrents au total
        </span>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-center">
        <button type="button" onClick={() => onPageChange(1)} disabled={currentPage === 1} className={navBtn}>
          ««
        </button>
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={navBtn}>
          «
        </button>
        <span className="px-4 py-2 rounded-xl bg-blue-600 text-white min-h-[44px] min-w-[44px] flex items-center justify-center font-bold">
          {currentPage}
        </span>
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={navBtn}>
          »
        </button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={navBtn}>
          »»
        </button>
      </div>
    </div>
  );
};
