import { getFilters, getPrices, getUnifiedPrices, getStats, getPriceSummary } from '../supabaseApi';

// The mock is defined in jest.setup.js
// We can access mockSupabaseQuery by importing it if we export it, 
// but since it's a jest mock we can use jest.requireMock or just trust the setup.
// Actually, it's easier to just mock specifically in the test if we need to change return values.

import { supabase } from '../supabase';

describe('supabaseApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getFilters', () => {
        it('fetches distinct filters correctly', async () => {
            const mockData = [
                { category: 'Fruit', commodity: 'Apple', variety: 'Gala', package: 'Carton', district: 'WA', organic: 'No' },
                { category: 'Fruit', commodity: 'Apple', variety: 'Fuji', package: 'Carton', district: 'WA', organic: 'No' },
            ];
            
            // Mocking the thenable query
            supabase.from().then.mockImplementationOnce(onFulfilled => 
                Promise.resolve({ data: mockData, error: null }).then(onFulfilled)
            );

            const result = await getFilters();

            expect(supabase.from).toHaveBeenCalledWith('CropPrice');
            expect(result.commodities).toContain('Apple');
            expect(result.varieties).toEqual(['Fuji', 'Gala']);
        });

        it('handles errors gracefully', async () => {
            const error = new Error('Database error');
            supabase.from().then.mockImplementationOnce(onFulfilled => 
                Promise.resolve({ data: null, error }).then(onFulfilled)
            );

            await expect(getFilters()).rejects.toThrow('Database error');
        });
    });

    describe('getPrices', () => {
        it('queries prices with filters and limit', async () => {
            const mockPrices = [{ commodity: 'Apple', low_price: 10, high_price: 15 }];
            
            supabase.from().then.mockImplementationOnce(onFulfilled => 
                Promise.resolve({ data: mockPrices, error: null }).then(onFulfilled)
            );

            const filters = { commodity: 'Apple' };
            const result = await getPrices(filters, 50);

            expect(supabase.from).toHaveBeenCalledWith('CropPrice');
            expect(supabase.from().limit).toHaveBeenCalledWith(50);
            expect(supabase.from().eq).toHaveBeenCalledWith('commodity', 'Apple');
            expect(result).toEqual(mockPrices);
        });
    });

    describe('getStats', () => {
        it('calculates averages correctly', async () => {
            const mockLatestDate = [{ report_date: '2024-01-01' }];
            const mockPrices = [
                { market_type: 'Terminal', price_retail: 20 },
                { market_type: 'Terminal', price_retail: 30 },
                { market_type: 'Shipping Point', price_retail: 10 },
            ];

            // Mock first call (latest date)
            supabase.from().then.mockImplementationOnce(onFulfilled => 
                Promise.resolve({ data: mockLatestDate, error: null }).then(onFulfilled)
            );
            
            // Mock second call (prices for that date)
            supabase.from().then.mockImplementationOnce(onFulfilled => 
                Promise.resolve({ data: mockPrices, error: null }).then(onFulfilled)
            );

            const stats = await getStats('Apple');

            expect(stats.current_terminal_avg).toBe(25);
            expect(stats.current_shipping_avg).toBe(10);
            expect(stats.spread).toBe(15);
        });
    });
});
