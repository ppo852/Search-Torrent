import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { MediaSection } from '../components/ui/MediaSection';
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
  const { data: newestMedia = [], isLoading } = useQuery({
    queryKey: ['tmdb', 'newest'],
    queryFn: fetchNewestMedia,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000
  });

  const trendingMovies = newestMedia.filter((m) => m.type === 'movie');
  const trendingShows = newestMedia.filter((m) => m.type === 'tv');

  const handleMediaClick = (media: TmdbResult) => {
    navigate(`/media/${media.type}/${media.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Chargement des nouveautés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black">
      {/* Hero Section */}
      {newestMedia.length > 0 && (
        <div className="relative h-96 md:h-[500px] overflow-hidden">
          <img
            src={newestMedia[0]?.posterPath?.replace('/w185/', '/w500/') || ''}
            alt={newestMedia[0]?.title || ''}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent">
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                {newestMedia[0]?.title || 'Nouveautés'}
              </h1>
              <p className="text-lg md:text-xl text-white/90 mb-6 max-w-3xl line-clamp-3">
                {newestMedia[0]?.overview || 'Découvrez les derniers films et séries'}
              </p>
              <div className="flex items-center gap-4 text-sm text-white/70">
                <span>{formatYear(newestMedia[0]?.releaseDate || '')}</span>
                {newestMedia[0]?.voteAverage > 0 && (
                  <>
                    <span>•</span>
                    <span>⭐ {newestMedia[0].voteAverage.toFixed(1)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
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

        <MediaSection
          title="Derniers Ajouts"
          items={newestMedia.slice(0, 80)}
          onMediaClick={handleMediaClick}
        />
      </div>

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
