import { useState } from 'react';
import { CalendarDays, Download, Users, BookmarkPlus, HardDrive } from 'lucide-react';
import type { CategoryType, SearchResult } from '../../types';
import { formatSize, formatDate } from '../../lib/formatters';
import { getCategoryLabel } from '../../lib/categories';

interface ResultCardProps {
  result: SearchResult;
  onDownload: (result: SearchResult) => void | Promise<void>;
  onTrack?: () => void | Promise<void>;
  isSearchResult?: boolean;
  poster?: string | null;
  forcedCategory?: string;
  searchContext?: CategoryType;
  validationError?: string | null;
}

export function ResultCard({ 
  result, 
  onDownload, 
  onTrack, 
  isSearchResult = false, 
  poster, 
  forcedCategory,
  searchContext,
  validationError 
}: ResultCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const translateCategory = (category?: string, name?: string, categoryId?: number): string => {
    return getCategoryLabel(categoryId, category, name, forcedCategory, searchContext);
  };

  const hostname = (() => {
    try {
      return result.engine_url ? new URL(result.engine_url).hostname : '';
    } catch {
      return result.engine_url || '';
    }
  })();

  const handleDownloadClick = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await Promise.resolve(onDownload(result));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`glass-card p-4 group transition-all duration-300 hover:scale-[1.01] hover:shadow-blue-500/5 ${
      validationError 
        ? 'border-red-500/20 bg-red-500/[0.02] opacity-60 hover:opacity-100 grayscale-[0.3] hover:grayscale-0' 
        : 'hover:bg-white/5 border-white/5'
    }`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex gap-4 flex-1 min-w-0">
          {!isSearchResult && poster && (
            <div className="shrink-0 w-16 h-24 rounded-lg overflow-hidden border border-white/5 shadow-lg group-hover:border-white/10 transition-colors">
              <img
                src={poster}
                alt="Poster"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="flex-1 font-bold text-white text-[13px] md:text-sm leading-tight break-all line-clamp-2 group-hover:text-blue-400 transition-colors">
                {result.name}
              </h3>
              {validationError && (
                <div className="hidden group-hover:block shrink-0 px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
                  {validationError}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-2 md:gap-x-3">
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-md text-[9px] md:text-[10px] font-black border border-amber-500/20">
                <HardDrive size={10} />
                {formatSize(result.size)}
              </div>

              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded-md text-[9px] md:text-[10px] font-black border border-green-500/20">
                <Users size={10} />
                {result.seeds} <span className="hidden sm:inline opacity-50 font-medium">seeds</span>
              </div>

              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded-md text-[9px] md:text-[10px] font-black border border-red-500/20">
                <Download size={10} />
                {result.leech} <span className="hidden sm:inline opacity-50 font-medium">leech</span>
              </div>

              <div className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <CalendarDays size={10} />
                {result.publishDate ? formatDate(result.publishDate) : '—'}
              </div>

              <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/5 px-2 py-0.5 rounded-md">
                <span className="w-1 h-1 rounded-full bg-blue-500" />
                {translateCategory(result.category, result.name, result.categoryId)}
              </div>

              {hostname && (
                <div className="text-[9px] md:text-[10px] text-gray-600 font-black uppercase tracking-tighter">
                  {hostname}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex md:flex-col gap-2 w-full md:w-auto">
          {onTrack && (
            <button
              onClick={() => onTrack()}
              className="flex-1 md:w-40 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-bold border border-white/5"
            >
              <BookmarkPlus size={18} className="text-blue-400" />
              <span>Suivre</span>
            </button>
          )}
          <button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className={`flex-1 md:w-40 flex items-center justify-center gap-2 px-4 py-2.5 ${
              validationError ? 'bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white' : 'premium-gradient text-white shadow-blue-600/20'
            } rounded-xl shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-all font-black uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={18} />
            )}
            <span>{isDownloading ? 'ENVOI...' : validationError ? 'FORCER' : 'TÉLÉCHARGER'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}