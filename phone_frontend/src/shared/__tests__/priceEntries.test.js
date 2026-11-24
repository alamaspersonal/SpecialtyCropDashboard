import {
    entryFromRow, entryFromRollup, groupPrices, monthEndKey, nextMonthStartKey, rowBasis,
} from '../priceEntries';

const row = (pkg, prices, extra = {}) => ({
    market_type: 'Terminal',
    report_date: '2026-11-03T00:00:00+00:00',
    package: pkg,
    ...prices,
    ...extra,
});

describe('priceEntries', () => {
    it('picks the price basis the same way as the monthly rollup', () => {
        expect(rowBasis({ price_per_lb: 1.5, price_per_unit: 2, price_avg: 30 })).toEqual({ basis: 'lb', price: 1.5 });
        expect(rowBasis({ price_per_unit: 2, price_avg: 8 })).toEqual({ basis: 'unit', price: 2 });
        expect(rowBasis({ price_avg: 30 })).toEqual({ basis: 'pkg', price: 30 });
        expect(rowBasis({}).basis).toBe('none');
    });

    it('averages every $/lb package together but keeps $/each and $/package separate', () => {
        const entries = [
            row('25 Lb Cartons', { price_per_lb: 1.0, price_avg: 25 }),
            row('40 Lb Cartons', { price_per_lb: 2.0, price_avg: 80 }),
            row('3 Count Bags', { price_per_unit: 0.5, price_avg: 1.5 }),
            row('3 Count Bags', { price_per_unit: 0.7, price_avg: 2.1 }),
            row('Cartons', { price_avg: 20 }),
            row('Each', { price_per_unit: 1.25, price_avg: 1.25 }),
        ].map(entryFromRow);

        const groups = groupPrices(entries);
        expect(groups.map(g => g.key)).toEqual(['lb', 'unit:3 Count Bags', 'pkg:Cartons', 'unit:Each']);

        const [lb, bags, cartons, each] = groups;
        expect(lb.avg).toBeCloseTo(1.5);
        expect(lb.packages).toEqual(['25 Lb Cartons', '40 Lb Cartons']);
        expect(bags.avg).toBeCloseTo(0.6);
        expect(cartons.avg).toBe(20);
        expect(each.avg).toBe(1.25);
    });

    it('reports the package price only when every price in the group has one', () => {
        const [single] = groupPrices([row('25 Lb Cartons', { price_per_lb: 1.2, price_avg: 30 })].map(entryFromRow));
        expect(single.packageAvg).toBe(30);

        const monthly = entryFromRollup({
            month: '2026-10-01', market_type: 'Terminal', package: '25 Lb Cartons',
            price_basis: 'lb', price_sum: 12, price_count: 10, row_count: 10,
        });
        const [mixed] = groupPrices([entryFromRow(row('25 Lb Cartons', { price_per_lb: 1.2, price_avg: 30 })), monthly]);
        expect(mixed.avg).toBeCloseTo(13.2 / 11);
        expect(mixed.packageAvg).toBeNull();
    });

    it('applies a per-entry factor (CPI) to the averages', () => {
        const entries = [row('Each', { price_per_unit: 2 }), row('Each', { price_per_unit: 4 })].map(entryFromRow);
        const [g] = groupPrices(entries, () => 1.5);
        expect(g.avg).toBeCloseTo(4.5);
    });

    it('spans rollup months, clipped to the requested range', () => {
        const e = entryFromRollup({ month: '2026-02-01', market_type: 'Retail - Specialty Crops', price_basis: 'pkg', price_sum: 5, price_count: 1, row_count: 2 });
        expect(e).toMatchObject({ market: 'retail', start: '2026-02-01', end: '2026-02-28', origin: null, rows: 2 });
        expect(entryFromRollup({ month: '2026-02-01', market_type: 'Terminal', price_basis: 'lb' }, { from: '2026-02-10' }).start)
            .toBe('2026-02-10');
        expect(monthEndKey('2024-02-15')).toBe('2024-02-29');
        expect(nextMonthStartKey('2026-12-31')).toBe('2027-01-01');
    });
});
