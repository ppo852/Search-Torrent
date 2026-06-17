import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { ResultCard } from './ui/ResultCard';
import { SearchResult } from '../types';

interface ManualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  results: SearchResult[];
  isLoading: boolean;
  onDownload: (result: SearchResult) => void;
  error?: string | null;
  onForceDownload?: () => void;
}

const ManualSearchModal: React.FC<ManualSearchModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  results,
  isLoading,
  onDownload,
  error,
  onForceDownload
}) => {
  const [sortField, setSortField] = useState<'size' | 'date'>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      if (sortField === 'size') {
        return sortDirection === 'asc' ? a.size - b.size : b.size - a.size;
      } else {
        const dateA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const dateB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
  }, [results, sortField, sortDirection]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="glass-card relative w-full max-w-5xl max-h-[90vh] flex flex-col border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">{title}</h2>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 bg-black/20 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setSortField('size'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortField === 'size' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
            >
              Taille {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => { setSortField('date'); setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc'); }} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortField === 'date' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
            >
              Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          
          {error && (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{error}</span>
              {onForceDownload && (
                <button onClick={onForceDownload} className="px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg">
                  Forcer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Requête en cours...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 opacity-30">
              <p className="text-gray-500 font-bold uppercase text-sm">Aucun résultat</p>
            </div>
          ) : (
            sortedResults.map((r) => (
              <ResultCard
                key={r.link || `${r.engine_url}-${r.name}`}
                result={r as any}
                onDownload={() => onDownload(r as any)}
                isSearchResult={true}
                validationError={r.incompatible_reason}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualSearchModal;
