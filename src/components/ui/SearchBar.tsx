import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Film, Tv, Sparkles } from 'lucide-react';
import type { CategoryType, TmdbResult } from '../types';
import { tmdbAPI } from '../../services/tmdb/tmdb';
import { useNavigate } from 'react-router-dom';

interface SearchBarProps {
  onSearch: (query: string, category: CategoryType | null) => void;
}

const categories: { value: CategoryType; label: string }[] = [
  { value: 'movies', label: 'Films' },
  { value: 'tv', label: 'Séries TV' },
  { value: 'anime', label: 'Anime' },
  { value: 'music', label: 'Musique' },
  { value: 'software', label: 'Logiciels' },
  { value: 'books', label: 'Livres' },
  { value: 'all', label: 'Tout' },
];

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TmdbResult[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setIsSuggesting(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debounce
  useEffect(() => {
    const showSuggestions = category === null || category === 'all' || category === 'movies' || category === 'tv' || category === 'anime';
    if (query.trim().length < 2 || !showSuggestions) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const type = category === 'movies' ? 'movie' : (category === 'tv' || category === 'anime') ? 'tv' : 'multi';
        const results = await tmdbAPI.searchSuggestions(query, type as any);
        setSuggestions(results.slice(0, 6));
        setIsSuggesting(results.length > 0);
      } catch (err) {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (category === null) {
      if (suggestions.length > 0) setIsSuggesting(true);
      return;
    }
    onSearch(query.trim(), category);
    setIsSuggesting(false);
  };

  const handleSuggestionClick = (suggestion: TmdbResult) => {
    setIsSuggesting(false);
    setQuery('');
    navigate(`/media/${suggestion.type}/${suggestion.id}`);
  };

  const selectedLabel = category ? (categories.find(c => c.value === category)?.label || 'Catégorie') : 'Catégorie';

  return (
    <div className="w-full max-w-4xl mx-auto relative group">
      <form onSubmit={handleSubmit} className="relative z-50">
        <div className="glass-card p-1.5 flex flex-col md:flex-row gap-2 shadow-2xl transition-all duration-500 focus-within:shadow-blue-500/10 focus-within:scale-[1.01] border-white/5 focus-within:border-white/10">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setIsSuggesting(true)}
              placeholder="Que voulez-vous regarder ?"
              className="w-full h-14 px-5 pl-14 rounded-xl bg-transparent text-white text-lg placeholder-gray-500 focus:outline-none transition-all"
            />
            <Search 
              size={24} 
              className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap md:flex-nowrap gap-2 p-1 relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="h-12 flex-1 md:flex-none px-5 md:min-w-[140px] flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/5 text-gray-300 font-black text-xs uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all outline-none"
            >
              <span className={`truncate ${category === null ? 'text-gray-500' : ''}`}>{selectedLabel}</span>
              <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 right-0 md:w-64 mt-2 p-2 bg-gray-950 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-premium-fade">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory(null);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                      category === null
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>—</span>
                    {category === null && <Check size={14} />}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setCategory(cat.value);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                        category === cat.value 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {category === cat.value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <button
              type="submit"
              className="h-12 flex-1 md:flex-none px-8 premium-gradient text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              RECHERCHER
            </button>
          </div>
        </div>
      </form>

      {/* Suggestions Results Dropdown */}
      {isSuggesting && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-3 bg-gray-950 border border-white/10 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden z-40 animate-premium-fade backdrop-blur-xl"
        >
          <div className="p-4 bg-white/5 flex items-center gap-2 border-b border-white/5">
             <Sparkles size={14} className="text-blue-500" />
             <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">Suggestions Intelligentes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-2">
            {suggestions.map((s) => (
              <button
                key={`${s.type}-${s.id}`}
                onClick={() => handleSuggestionClick(s)}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
              >
                <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-gray-900 border border-white/5">
                  {s.posterPath ? (
                    <img src={s.posterPath} alt={s.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                       {s.type === 'movie' ? <Film size={16} /> : <Tv size={16} />}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-white uppercase tracking-tighter truncate group-hover:text-blue-400 transition-colors">{s.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{s.releaseDate?.split('-')[0]}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-white/5 text-gray-500 rounded uppercase font-black">{s.type === 'movie' ? 'Film' : 'Série'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}