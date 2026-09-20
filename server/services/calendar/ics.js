/**
 * Helpers iCalendar purs (sans DB / TMDB).
 */

import { pad2 } from '../utils/helpers.js';

export function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Fold RFC 5545 : max 75 octets UTF-8 par ligne (sans couper un code point).
 * Lignes de suite = SPACE + ≤74 octets de contenu.
 */
export function foldIcsLine(line) {
  const str = String(line);
  if (Buffer.byteLength(str, 'utf8') <= 75) return str;

  const parts = [];
  let remaining = str;
  let first = true;

  while (remaining.length > 0) {
    const maxBytes = first ? 75 : 74;
    let takeChars = 0;
    let bytes = 0;
    for (const ch of remaining) {
      const chBytes = Buffer.byteLength(ch, 'utf8');
      if (bytes + chBytes > maxBytes) break;
      bytes += chBytes;
      takeChars += ch.length;
    }
    if (takeChars === 0) {
      const ch = [...remaining][0];
      takeChars = ch.length;
    }
    const chunk = remaining.slice(0, takeChars);
    remaining = remaining.slice(takeChars);
    parts.push(first ? chunk : ` ${chunk}`);
    first = false;
  }

  return parts.join('\r\n');
}

/**
 * Convertit les événements en flux iCalendar.
 */
export function eventsToIcs(events, { start, end } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Search-Torrent//Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Search-Torrent Séries',
  ];

  if (start) lines.push(`X-WR-CALDESC:Sorties ${start} → ${end || ''}`);

  for (const ev of events || []) {
    const air = String(ev.airDate || '').replace(/-/g, '');
    if (!/^\d{8}$/.test(air)) continue;
    // Organizr exige DTEND ; pour une journée entière iCal, DTEND = lendemain (exclusif)
    const endDate = new Date(`${String(ev.airDate).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(endDate.getTime())) continue;
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const dtEnd =
      `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`;
    const uid = `st-${ev.id}@search-torrent`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${air}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(ev.summary || ev.title)}`));
    const descParts = [
      ev.mediaType === 'anime' ? 'Anime' : 'Série',
      `S${pad2(ev.season)}E${pad2(ev.episode)}`,
      ev.episodeTitle || null,
    ].filter(Boolean);
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(descParts.join(' · '))}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
