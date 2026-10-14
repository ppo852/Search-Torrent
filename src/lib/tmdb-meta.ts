export type TmdbGenreRef = { id?: number; name?: string };

/** Date FR type 12/10/2026 */
export function formatTmdbDateFr(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR');
}

/** Année seule depuis YYYY-MM-DD (évite les décalages fuseau). */
export function formatTmdbYear(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const m = String(dateStr).match(/^(\d{4})/);
  return m ? m[1] : '';
}
