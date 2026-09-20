import {
  getMovieAutoSearchToastPayload,
  type MovieAutoSearchResult,
} from './auto-search-toast-payloads';
import { notifyAutoSearchToastPayload } from './notify-auto-search-toast';

export type { MovieAutoSearchResult } from './auto-search-toast-payloads';

export function notifyMovieAutoSearchResult(result: MovieAutoSearchResult | null | undefined): void {
  notifyAutoSearchToastPayload(getMovieAutoSearchToastPayload(result));
}
