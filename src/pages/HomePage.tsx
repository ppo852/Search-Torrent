import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { MediaSection } from '../components/ui/MediaSection';
import { RssTrackerHome } from '../components/home/RssRecentRow';
import { formatYear } from '../utils/formatters';
import type { TmdbResult } from '../types';

async function fetchNewestMedia(): Promise<TmdbResult[]> {
  const token = useAuthStore.getState().token;
  const response = await fetch('/api/tmdb/newest?limit=80', {
    headers: {
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Erreur lors du chargement des nouveautés');
  }

  return response.json();
}

export function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const { data: newestMedia = [], isLoading: isTmdbLoading } = useQuery({
    queryKey: ['tmdb', 'newest'],
    queryFn: fetchNewestMedia,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000
  });

  const trendingMovies = newestMedia.filter((m: any) => m.type === 'movie');
  const trendingShows = newestMedia.filter((m: any) => m.type === 'tv');

  // Prendre les 10 premiers médias avec backdrop pour le carrousel
  const heroMedias = newestMedia.filter((m: any) => m.backdropPath).slice(0, 10);

  // Carrousel automatique toutes les 8 secondes
  useEffect(() => {
    if (heroMedias.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroMedias.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [heroMedias.length]);

  const handleMediaClick = (media: TmdbResult) => {
    navigate(`/media/${media.type}/${media.id}`);
  };

  const currentMedia = heroMedias[currentSlide];

  return (
    <div className="min-h-screen bg-gray-950">
      {isTmdbLoading && !currentMedia && (
        <div className="relative h-[400px] md:h-[600px] -mt-8 -mx-8 mb-12 flex items-center justify-center bg-gray-900/50">
          <div className="text-gray-400">Chargement des nouveautés...</div>
        </div>
      )}

      {/* Hero Carousel Section */}
      {currentMedia && (
        <div className="relative h-[400px] md:h-[600px] -mt-8 -mx-8 mb-12 overflow-hidden shadow-2xl">
          {/* Images avec transition */}
          {heroMedias.map((media: any, index: number) => (
            <div
              key={media.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
              }`}
              style={{ transition: 'opacity 1000ms ease-in-out, transform 10000ms linear' }}
            >
              <img
                src={media.backdropPath || media.posterPath?.replace('/w185/', '/original/') || ''}
                alt={media.title || ''}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          
          {/* Overlay dégradé complexe */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/40 to-transparent">
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 animate-premium-fade">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-widest">Nouveauté</span>
                <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
                  <span>{formatYear(currentMedia.releaseDate || '')}</span>
                  {currentMedia.voteAverage > 0 && (
                    <>
                      <span className="w-1 h-1 bg-gray-500 rounded-full" />
                      <span className="text-yellow-400 font-bold">⭐ {currentMedia.voteAverage.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </div>

              <h1 className="text-3xl md:text-6xl font-black text-white mb-6 leading-tight max-w-4xl tracking-tight">
                {currentMedia.title || 'Découvrez'}
              </h1>
              
              <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl line-clamp-3 leading-relaxed font-medium">
                {currentMedia.overview}
              </p>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleMediaClick(currentMedia)}
                  className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-blue-500 hover:text-white transition-all duration-300 flex items-center gap-2 shadow-xl hover:shadow-blue-500/40"
                >
                  Détails & Recherche
                </button>
                
                {/* Indicateurs de slides intégrés */}
                <div className="flex gap-2 ml-8">
                  {heroMedias.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        index === currentSlide ? 'w-12 bg-blue-500' : 'w-4 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Sections */}
      <div className="space-y-16 animate-premium-fade delay-200">
        {isTmdbLoading ? (
          <div className="px-4 text-gray-500 text-sm">Chargement des tendances...</div>
        ) : (
          <>
            <MediaSection
              title="Films Tendance"
              items={trendingMovies}
              onMediaClick={handleMediaClick}
            />

            <MediaSection
              title="Séries Tendance"
              items={trendingShows}
              onMediaClick={handleMediaClick}
            />
          </>
        )}

        <RssTrackerHome />
      </div>
    </div>
  );
}
