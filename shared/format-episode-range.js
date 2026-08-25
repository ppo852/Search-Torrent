/**
 * Formate une liste d'épisodes présents : "Ép. 1", "Ép. 1 à 7", "3 ép."
 * @param {number[]} episodes
 * @returns {string | null}
 */
export function formatEpisodeRange(episodes) {
  if (!episodes?.length) return null;

  const sorted = [...episodes]
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;
  if (sorted.length === 1) return `Ép. ${sorted[0]}`;

  const contiguous = sorted.every(
    (ep, index) => index === 0 || ep === sorted[index - 1] + 1
  );

  if (contiguous) {
    return `Ép. ${sorted[0]} à ${sorted[sorted.length - 1]}`;
  }

  return `${sorted.length} ép.`;
}
