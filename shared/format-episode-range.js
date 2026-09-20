/**
 * Formate une liste d'épisodes présents :
 * "Ép. 1" | "Ép. 1 à 7" | "Ép. 161 à 170, 173 à 179"
 * @param {number[]} episodes
 * @returns {string | null}
 */
export function formatEpisodeRange(episodes) {
  if (!episodes?.length) return null;

  const sorted = [...new Set(
    [...episodes]
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0)
  )].sort((a, b) => a - b);

  if (!sorted.length) return null;
  if (sorted.length === 1) return `Ép. ${sorted[0]}`;

  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const ep = sorted[i];
    if (ep === prev + 1) {
      prev = ep;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start} à ${prev}`);
    start = ep;
    prev = ep;
  }
  ranges.push(start === prev ? `${start}` : `${start} à ${prev}`);

  return `Ép. ${ranges.join(', ')}`;
}
