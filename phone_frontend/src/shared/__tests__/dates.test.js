import { toDateKey, addDaysToKey, formatReportDate, keyToLocalDate, localDateToKey } from '../dates';

describe('dates', () => {
    it('keys a midnight-UTC report_date to its calendar day', () => {
        expect(toDateKey('2026-11-03T00:00:00+00:00')).toBe('2026-11-03');
        expect(toDateKey('2026-11-03')).toBe('2026-11-03');
        expect(toDateKey(new Date(Date.UTC(2026, 10, 3)))).toBe('2026-11-03');
        expect(toDateKey(null)).toBeNull();
        expect(toDateKey('not a date')).toBeNull();
    });

    it('formats report dates without shifting to the previous day', () => {
        // Would read "Nov 2, 2026" in any US time zone if formatted locally.
        expect(formatReportDate('2026-11-03T00:00:00+00:00')).toBe('Nov 3, 2026');
        expect(formatReportDate('2026-11-03', { month: 'long', day: 'numeric', year: 'numeric' }))
            .toBe('November 3, 2026');
        expect(formatReportDate('')).toBe('');
    });

    it('shifts keys by whole days across month and DST boundaries', () => {
        expect(addDaysToKey('2026-11-03', -6)).toBe('2026-10-28');
        expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
        expect(addDaysToKey('2026-11-03', -90)).toBe('2026-08-05');
    });

    it('round-trips keys through local date-picker Dates', () => {
        const local = keyToLocalDate('2026-11-03');
        expect(local.getDate()).toBe(3);
        expect(localDateToKey(local)).toBe('2026-11-03');
    });
});
