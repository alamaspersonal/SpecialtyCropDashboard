import { getFilters, getStats, getTimeSeriesWindow } from '../supabaseApi';
import { supabase } from '../supabase';

describe('supabaseApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getFilters', () => {
        it('returns static filters when no active filters', async () => {
            const result = await getFilters({});
            // Should return STATIC_FILTERS without hitting Supabase
            expect(result).toBeDefined();
            expect(result.categories).toBeDefined();
            expect(result.commodities).toBeDefined();
        });
    });

    describe('getStats', () => {
        it('calculates terminal and shipping averages from price_avg', async () => {
            const mockPrices = [
                { market_type: 'Terminal', price_avg: 20, report_date: '2024-01-10', package: '25 lb cartons', market_tone_comments: '' },
                { market_type: 'Terminal', price_avg: 30, report_date: '2024-01-10', package: '25 lb cartons', market_tone_comments: '' },
                { market_type: 'Shipping Point', price_avg: 10, report_date: '2024-01-10', package: '25 lb cartons', market_tone_comments: '' },
                { market_type: 'Terminal', price_avg: 18, report_date: '2024-01-01', package: '25 lb cartons', market_tone_comments: '' },
            ];

            supabase.from().then.mockImplementationOnce(onFulfilled =>
                Promise.resolve({ data: mockPrices, error: null }).then(onFulfilled)
            );

            const stats = await getStats('Apples');

            expect(stats).not.toBeNull();
            // Terminal avg from current week rows (2024-01-10): (20+30)/2 = 25
            expect(stats.terminal.avg).toBe(25);
            // Shipping avg from current week: 10
            expect(stats.shipping.avg).toBe(10);
            // Spread: 25 - 10 = 15
            expect(stats.spread).toBe(15);
        });

        it('returns null pct_change when no prior week data', async () => {
            const mockPrices = [
                { market_type: 'Terminal', price_avg: 20, report_date: '2024-01-10', package: null, market_tone_comments: '' },
            ];

            supabase.from().then.mockImplementationOnce(onFulfilled =>
                Promise.resolve({ data: mockPrices, error: null }).then(onFulfilled)
            );

            const stats = await getStats('Apples');
            expect(stats.terminal.pct_change).toBeNull();
        });

        it('anchors on the latest report even when it is older than two weeks', async () => {
            const mockPrices = [
                { market_type: 'Terminal', price_avg: 20, report_date: '2024-01-10T00:00:00+00:00', market_tone_comments: 'Steady' },
                { market_type: 'Terminal', price_avg: 99, report_date: '2023-11-01T00:00:00+00:00', market_tone_comments: '' },
            ];

            supabase.from().then.mockImplementationOnce(onFulfilled =>
                Promise.resolve({ data: mockPrices, error: null }).then(onFulfilled)
            );

            const stats = await getStats('Apples');
            expect(stats.error).toBeUndefined();
            expect(stats.market_note).toBe('Steady');
            // Rows outside the 14 days before the latest report are dropped.
            expect(stats.terminal.avg).toBe(20);
        });
    });

    describe('getTimeSeriesWindow', () => {
        const page = (count, date, startId) => Array.from({ length: count }, (_, i) => ({
            id: startId - i,
            report_date: date,
            price_avg: 1,
        }));

        it('pages newest-first by (report_date, id) cursor and returns ascending rows', async () => {
            const first = page(1000, '2026-11-03T00:00:00+00:00', 5000);
            const second = page(2, '2026-11-02T00:00:00+00:00', 3000);
            const query = supabase.from();
            query.then
                .mockImplementationOnce(onFulfilled => Promise.resolve({ data: first, error: null }).then(onFulfilled))
                .mockImplementationOnce(onFulfilled => Promise.resolve({ data: second, error: null }).then(onFulfilled));

            const rows = await getTimeSeriesWindow('Apples', {}, '2026-08-01');

            expect(rows).toHaveLength(1002);
            expect(rows[0].report_date).toBe('2026-11-02T00:00:00+00:00');
            expect(rows[rows.length - 1].report_date).toBe('2026-11-03T00:00:00+00:00');
            expect(query.order).toHaveBeenCalledWith('report_date', { ascending: false });
            expect(query.order).toHaveBeenCalledWith('id', { ascending: false });
            // Second page continues strictly after the last row of the first.
            expect(query.or).toHaveBeenCalledWith(
                'report_date.lt."2026-11-03T00:00:00+00:00",and(report_date.eq."2026-11-03T00:00:00+00:00",id.lt.4001)'
            );
        });
    });
});
