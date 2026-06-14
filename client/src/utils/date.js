/** SQLite datetime('now') is UTC without timezone suffix */
export function parseServerDate(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr.replace(' ', 'T')}Z`;
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? null : ts;
}
