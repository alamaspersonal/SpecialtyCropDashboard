import { fetchRangeEntries } from '../useWaterfallData';
import {
    getPricesByDateRange, countPricesByDateRange, getMonthlyPriceRollup,
} from '../../services/api';

jest.mock('../../services/api', () => ({
    getDateRange: jest.fn(),
    getPricesByDateRange: jest.fn(),
    countPricesByDateRange: jest.fn(),
    getMonthlyPriceRollup: jest.fn(),
}));

const filters = { commodity: 'Apples', district: undefined };
const rawRow = (date) => ({
    market_type: 'Terminal', report_date: `${date}T00:00:00+00:00`, package: '40 Lb Cartons',
    price_per_lb: 1, price_avg: 40, origin: 'Washington',
});

describe('fetchRangeEntries', () => {
    beforeEach(() => jest.clearAllMocks());

    it('uses raw rows when the range fits', async () => {
        countPricesByDateRange.mockResolvedValue(5000);
        getPricesByDateRange.mockResolvedValue([rawRow('2026-03-02')]);

        const result = await fetchRangeEntries(filters, '2026-01-15', '2026-06-10');

        expect(getPricesByDateRange).toHaveBeenCalledTimes(1);
        expect(getPricesByDateRange).toHaveBeenCalledWith(filters, '2026-01-15', '2026-06-10');
        expect(getMonthlyPriceRollup).not.toHaveBeenCalled();
        expect(result.usesMonthly).toBe(false);
        expect(result.entries[0]).toMatchObject({ date: '2026-03-02', origin: 'Washington' });
    });

    it('uses the monthly rollup for whole months and raw rows for the partial ends', async () => {
        countPricesByDateRange.mockResolvedValue(45000);
        getPricesByDateRange.mockImplementation(async (_f, from) => [rawRow(from)]);
        getMonthlyPriceRollup.mockResolvedValue([
            { month: '2026-03-01', market_type: 'Terminal', package: '40 Lb Cartons', price_basis: 'lb', price_sum: 30, price_count: 20, row_count: 20 },
        ]);

        const result = await fetchRangeEntries(filters, '2026-01-15', '2026-06-10');

        expect(getPricesByDateRange).toHaveBeenCalledWith(filters, '2026-01-15', '2026-01-31');
        expect(getPricesByDateRange).toHaveBeenCalledWith(filters, '2026-06-01', '2026-06-10');
        expect(getMonthlyPriceRollup).toHaveBeenCalledWith('Apples', { district: undefined }, '2026-02-01', '2026-06-01');
        expect(result.usesMonthly).toBe(true);
        expect(result.entries.map(e => e.date).sort()).toEqual(['2026-01-15', '2026-03-01', '2026-06-01']);
    });

    it('skips raw edges when the range is month-aligned', async () => {
        countPricesByDateRange.mockResolvedValue(45000);
        getMonthlyPriceRollup.mockResolvedValue([]);

        await fetchRangeEntries(filters, '2026-02-01', '2026-05-31');

        expect(getPricesByDateRange).not.toHaveBeenCalled();
        expect(getMonthlyPriceRollup).toHaveBeenCalledWith('Apples', { district: undefined }, '2026-02-01', '2026-06-01');
    });
});
