import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSearchStore } from '../stores/searchStore';
import { SearchBar } from '../components/ui/SearchBar';
import { ResultCard } from '../components/ui/ResultCard';
import { SortControls } from '../components/ui/SortControls';
import { RssFeedList } from '../components/rss/RssFeedList';
import { MediaGrid } from '../components/ui/MediaGrid';
import { Toast } from '../components/core/Toast';
import type { SearchResult, SortOption, CategoryType } from '../types';
import { tmdbAPI } from '../services/tmdb/tmdb';
import { globalSettings } from '../services/settings';
import { Search, Rss, ChevronRight, ChevronLeft } from 'lucide-react';
import { useInteractiveTorrentDownload } from '../hooks/useInteractiveTorrentDownload';

export function NewTorrentPage() {
  const [sortOption, setSortOption] = useState<SortOption>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const { results, isLoading, error, lastSearchCategory, tmdbResults, setResults, setIsLoading, setError, setLastSearchCategory, setTmdbResults, setLastSearchQuery } = useSearchStore();

  const { download, confirmModal } = useInteractiveTorrentDownload({
    onSuccess: (msg) => setToastMessage(msg),
    onError: (msg) => setToastMessage(msg),
  });

  useEffect(() => {
    const loadSettings = async () => {
      try { await globalSettings.load(); } catch (err) { setError('Échec de synchronisation'); }
    };
    loadSettings();
  }, []);

  const handleSearch = async (query: string, category: CategoryType | null) => {
    if (!category) return;

    setIsLoading(true);
    setError(null);
    setLastSearchCategory(category);
    setTmdbResults([]);
    setLastSearchQuery(query);
    setCurrentPage(1);
    try {
      if (category === 'movies') {
        const suggestions = await tmdbAPI.searchSuggestions(query, 'movie');
        setTmdbResults(suggestions);
        setResults([]);
        return;
      }
      if (category === 'tv' || category === 'anime') {
        const suggestions = await tmdbAPI.searchSuggestions(query, 'tv');
        setTmdbResults(suggestions);
        setResults([]);
        return;
      }
      const response = await api.searchGeneral(query, category);
      setResults(response?.results || []);
    } catch (err) {
      console.error('Recherche échouée:', err);
      setError(err instanceof Error ? err.message : 'Erreur de communication');
    }
    finally { setIsLoading(false); }
  };

  const handleDownload = async (result: SearchResult) => {
    let indexerTag: string | undefined;
    try {
      if (result.engine_url) {
        indexerTag = new URL(result.engine_url).hostname.replace('www.', '');
      }
    } catch (e) {}

    const mediaType =
      lastSearchCategory === 'movies' ? 'movie'
      : lastSearchCategory === 'tv' ? 'tv'
      : lastSearchCategory === 'anime' ? 'anime'
      : lastSearchCategory === 'music' ? 'music'
      : lastSearchCategory === 'books' ? 'books'
      : undefined;
    await download({
      url: result.link,
      name: result.name,
      itemCategory: result.category,
      categoryId: result.categoryId,
      mediaType: mediaType as 'movie' | 'tv' | 'anime' | 'music' | 'books' | undefined,
      searchContext: lastSearchCategory === 'software' ? 'software' : undefined,
      tags: indexerTag ? [indexerTag] : undefined,
    });
  };

  const sortResults = (results: SearchResult[]): SearchResult[] => {
    return [...results].sort((a, b) => {
      let cmp = 0;
      if (sortOption === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortOption === 'size') cmp = a.size - b.size;
      else if (sortOption === 'seeds') cmp = a.seeds - b.seeds;
      else if (sortOption === 'leech') cmp = a.leech - b.leech;
      else {
        const dA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const dB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        cmp = dA - dB;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  };

  const paginatedResults = (results: SearchResult[]) => {
    const sorted = sortResults(results);
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  };

  return (
    <div className="animate-premium-fade space-y-12 pb-20">
      <div className="glass-card p-6 border-white/5 shadow-2xl sticky top-4 z-40 backdrop-blur-3xl bg-gray-950/60">
        <SearchBar onSearch={handleSearch} />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-8 shadow-lg shadow-blue-600/10" />
          <p className="text-gray-500 font-black uppercase text-xs tracking-[0.4em] animate-pulse">Synchronisation...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-12 border-red-500/20 text-center space-y-4">
          <p className="text-red-400 font-black uppercase text-sm tracking-widest">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all">Réessayer</button>
        </div>
      ) : (lastSearchCategory === 'movies' || lastSearchCategory === 'tv' || lastSearchCategory === 'anime') ? (
        tmdbResults.length > 0 ? (
          <div className="space-y-10">
            <div className="flex items-center gap-6">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <h2 className="text-sm font-black text-gray-500 tracking-[0.4em] uppercase whitespace-nowrap">Suggestions TMDB</h2>
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>
            <MediaGrid items={tmdbResults} category={lastSearchCategory} />
          </div>
        ) : lastSearchCategory && (
          <div className="py-32 glass-card text-center opacity-30"><p className="text-gray-500 font-black uppercase text-xs tracking-widest">Aucun résultat TMDB</p></div>
        )
      ) : results.length > 0 ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-white/5 pb-8">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500"><Search size={24} /></div>
               <div><h2 className="text-xl font-black text-white tracking-tighter uppercase mb-1">Indexation Directe</h2><p className="text-gray-500 text-[9px] font-black uppercase tracking-widest">{results.length} Identifiés</p></div>
            </div>
            <SortControls sortOption={sortOption} sortDirection={sortDirection} onSort={(o) => { if (o === sortOption) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); else { setSortOption(o); setSortDirection('desc'); } }} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {paginatedResults(results).map((result) => (
              <ResultCard
                key={result.link}
                result={result}
                onDownload={handleDownload}
                searchContext={lastSearchCategory === 'software' ? 'software' : undefined}
                forcedCategory={
                lastSearchCategory === 'movies' ? 'movie'
                : lastSearchCategory === 'tv' ? 'tv'
                : lastSearchCategory === 'anime' ? 'anime'
                : lastSearchCategory === 'music' ? 'music'
                : lastSearchCategory === 'books' ? 'books'
                : undefined
              } />
            ))}
          </div>
          {results.length > itemsPerPage && (
            <div className="mt-16 flex justify-center items-center gap-8">
              <button onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 1} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-20 transition-all"><ChevronLeft size={20} /></button>
              <span className="text-white font-black text-xs uppercase tracking-widest">Page {currentPage} / {Math.ceil(results.length / itemsPerPage)}</span>
              <button onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === Math.ceil(results.length / itemsPerPage)} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-20 transition-all"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      ) : !lastSearchCategory ? (
        <div className="mt-20 space-y-10">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-orange-600/10 rounded-2xl border border-orange-600/20 text-orange-500"><Rss size={24} /></div>
            <div><h2 className="text-xl font-black text-white tracking-tighter uppercase mb-1">Réseaux RSS</h2><p className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Flux temps-réel</p></div>
          </div>
          <RssFeedList />
        </div>
      ) : (
        <div className="py-32 glass-card text-center opacity-30"><p className="text-gray-500 font-black uppercase text-xs tracking-widest">Aucun signal détecté</p></div>
      )}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      {confirmModal}
    </div>
  );
}