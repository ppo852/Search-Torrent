/** Plateforme d’origine renvoyée par l’API TMDB (`originPlatforms`). */
export type TmdbOriginPlatform = {
  id: number;
  name: string;
  logoPath: string | null;
};

export function originPlatformLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return `https://image.tmdb.org/t/p/w154${logoPath}`;
}
