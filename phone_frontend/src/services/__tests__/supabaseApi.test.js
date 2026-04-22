import { getFilters, getPrices, getUnifiedPrices, getStats, getPriceSummary } from '../supabaseApi';
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

    describe('getPrices', () => {
        it('queries UnifiedCropPrice with commodity filter', async () => {
            const mockPrices = [
                { commodity: 'Apples', price_avg: 12.5, market_type: 'Terminal' },
            ];

            supabase.from().then.mockImplementationOnce(onFulfilled =>
                Promise.resolve({ data: mockPrices, error: null }).then(onFulfilled)
            );

            const result = await getPrices({ commodity: 'Apples' }, 50);
            expect(supabase.from).toHaveBeenCalledWith('UnifiedCropPrice');
            expect(result).toEqual(mockPrices);
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
    });
});
