/**
 * Même règle que server/services/media-inventory/utils.js → normalizeTitleForDb
 */
export function normalizeTitleForMatch(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
