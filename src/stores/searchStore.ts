import { create } from 'zustand';
import type { SearchResult, CategoryType, TmdbResult } from '../types';

interface SearchStore {
  results: SearchResult[];
  isLoading: boolean; // [DEBUG ONLY] console.log('isLoading:', isLoading);
  error: string | null;
  lastSearchCategory: CategoryType | null;
  lastSearchQuery: string | null;
  tmdbResults: TmdbResult[];
  setResults: (results: SearchResult[]) => void;
  setIsLoading: (isLoading: boolean) => { /* [DEBUG ONLY] console.log('setIsLoading:', isLoading); */ set({ isLoading }); };
  setError: (error: string | null) => void;
  setLastSearchCategory: (category: CategoryType | null) => void;
  setLastSearchQuery: (query: string | null) => void;
  setTmdbResults: (results: TmdbResult[]) => void;
  resetSearch: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  results: [],
  isLoading: false,
  error: null,
  lastSearchCategory: null,
  lastSearchQuery: null,
  tmdbResults: [],
  setResults: (results) => set({ results }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setLastSearchCategory: (lastSearchCategory) => set({ lastSearchCategory }),
  setLastSearchQuery: (lastSearchQuery) => set({ lastSearchQuery }),
  setTmdbResults: (tmdbResults) => set({ tmdbResults }),
  resetSearch: () => set({
    results: [],
    lastSearchCategory: null,
    lastSearchQuery: null,
    tmdbResults: [],
    error: null
  })
}));
