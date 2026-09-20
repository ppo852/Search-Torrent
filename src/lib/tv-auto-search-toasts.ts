import {
  getTvAutoSearchToastPayload,
  type TvAutoSearchResult,
} from './auto-search-toast-payloads';
import { notifyAutoSearchToastPayload } from './notify-auto-search-toast';

export type { TvAutoSearchResult } from './auto-search-toast-payloads';

type NotifyOptions = {
  episodeNumber?: number;
  seasonNumber?: number;
};

/**
 * Affiche le toast adapté au résultat d'un auto-scan TV (épisode ou saison).
 */
export function notifyTvAutoSearchResult(
  result: TvAutoSearchResult | null | undefined,
  options: NotifyOptions = {}
): void {
  notifyAutoSearchToastPayload(getTvAutoSearchToastPayload(result, options));
}
