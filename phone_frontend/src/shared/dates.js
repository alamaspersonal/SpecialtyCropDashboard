/**
 * Calendar-date helpers for report dates.
 *
 * UnifiedCropPrice.report_date is a timestamptz stored at midnight UTC, so
 * "2026-11-03T00:00:00+00:00" means the calendar day Nov 3. Formatting that
 * instant in device-local time shows Nov 2 anywhere west of UTC, and mixing
 * local and UTC arithmetic shifts window edges by a day. Work with
 * 'YYYY-MM-DD' keys instead, and only format them in UTC.
 *
 * Date pickers are the exception: they work in device-local time, so convert
 * at that boundary with keyToLocalDate / localDateToKey.
 */

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' key for a report_date string or Date; null if unparseable. */
export function toDateKey(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

/** Shift a 'YYYY-MM-DD' key by a whole number of days. */
export function addDaysToKey(key, days) {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Format a report date as its calendar day, with no time-zone shift. */
export function formatReportDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    const key = toDateKey(value);
    if (!key) return value ? String(value) : '';
    return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/** Local-midnight Date for a key, for date pickers and local display. */
export function keyToLocalDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Key for the calendar day a date picker shows (device-local). */
export function localDateToKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
