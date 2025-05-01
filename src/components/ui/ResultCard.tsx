import { useState } from 'react';
import { CalendarDays, Download, HardDrive, Tag, Users } from 'lucide-react';
import { SearchResult } from '../../types';
import { translateCategory } from '../../utils/category';
import { useNavigate } from 'react-router-dom';
import { formatSize, formatDate } from '../../lib/formatters';

interface ResultCardProps {
  result: SearchResult;
  onDownload: (result: SearchResult) => void;
  isSearchResult?: boolean;
  poster?: string | null;
}

export function ResultCard({ result, onDownload, isSearchResult = false, poster }: ResultCardProps) {
  const [tmdbError, setTmdbError] = useState<string | null>(null);

  // Fonction pour traduire les catégories en français
  const translateCategory = (category?: string): string => {
    if (!category) return 'Autres';
    
    // Utiliser le même ordre de catégories que dans RssFeedList
    if (/movie|film/i.test(category)) return 'Films';
    if (/tv|série|serie|show/i.test(category)) return 'Séries TV';
    if (/music|musique/i.test(category)) return 'Musique';
    if (/game|jeu/i.test(category)) return 'Jeux';
    if (/software|logiciel/i.test(category)) return 'Logiciels';
    if (/book|livre/i.test(category)) return 'Livres';
    if (/anime/i.test(category)) return 'Anime';
    
    return 'Autres'; // Catégorie non reconnue, utiliser 'Autres' par défaut
  };

  // Fonction conservée mais non utilisée actuellement
  // Pourrait être utilisée pour ajouter un bouton d'info TMDB dans le futur
  const _handleTmdbSearch = async () => {
    setTmdbError(null);

    try {
      const tmdbResult = await tmdbAPI.searchTitle(result.name);
      if (tmdbResult) {
        window.open(tmdbAPI.getTmdbUrl(tmdbResult.id, tmdbResult.type), '_blank');
      } else {
        setTmdbError("Aucun résultat trouvé sur TMDB");
      }
    } catch (error) {
      setTmdbError(error instanceof Error ? error.message : "Erreur lors de la recherche TMDB");
    }
  };

  return (
    <div className="bg-gray-800 rounded p-3 hover:bg-gray-700/70 transition-all duration-200">
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <div className="flex gap-2 flex-1">
          {!isSearchResult && poster && (
            <div className="flex-shrink-0">
              <img
                src={poster}
                alt="Poster"
                className="w-12 h-20 sm:w-16 sm:h-24 object-cover rounded max-w-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-medium text-gray-100 mb-1 line-clamp-1">
              {result.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mt-2">
              {/* Taille avec icône */}
              <span className="text-orange-400">💾 {formatSize(result.size)}</span>
              
              {/* Date avec icône (seulement si disponible) */}
              {result.publishDate && (
                <span className="text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3 inline mr-1" />
                  {formatDate(result.publishDate)}
                </span>
              )}
              
              {/* Sources (seeders) avec icône */}
              <span className="text-green-500">
                <Users className="h-3 w-3 inline mr-1" />
                {result.seeds}
              </span>
              
              {/* Leechers avec icône */}
              <span className="text-red-500">
                <Download className="h-3 w-3 inline mr-1" />
                {result.leech}
              </span>
              
              {/* Catégorie avec icône */}
              <span className="text-purple-400">📁 {translateCategory(result.category)}</span>
            </div>
            {tmdbError && (
              <div className="mt-1 text-sm text-red-400">
                {tmdbError}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end md:justify-start mt-2 md:mt-0">
          <button
            onClick={() => onDownload(result)}
            className="flex items-center gap-1 px-3 py-2 md:px-2 md:py-1 bg-blue-500 hover:bg-blue-600 rounded transition-colors shrink-0"
            title="Télécharger le torrent"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm">Télécharger</span>
          </button>
        </div>
      </div>
    </div>
  );
}