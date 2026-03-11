/**
 * priceBridge.test.js — Unit tests for the Price Bridge calculation engine.
 *
 * Tests the decomposition logic in isolation with hardcoded fixtures.
 * Does not import React or any platform code.
 */

import { computeBridge, computeAllBridges } from '../priceBridge';

// ─── Fixture helpers ────────────────────────────────────────────

function makeRow(overrides = {}) {
    return {
        price_avg: 10,
        market_type: 'Terminal',
        package: '25 lb cartons',
        origin: 'CALIFORNIA',
        district: 'Central',
        variety: 'FUJI',
        report_date: '2026-01-15',
        ...overrides,
    };
}

function makeRows(count, overrides = {}) {
    return Array.from({ length: count }, () => makeRow(overrides));
}

// ─── Test Suite ─────────────────────────────────────────────────

describe('computeBridge', () => {

    test('identical periods → all effects are zero', () => {
        const data = makeRows(5, { price_avg: 20 });
        const bridge = computeBridge(data, data);

        expect(bridge.period_a_avg).toBe(20);
        expect(bridge.period_b_avg).toBe(20);
        bridge.effects.forEach(e => {
            expect(e.value).toBe(0);
        });
    });

    test('pure price change (same segments) → only Price Level is non-zero', () => {
        const periodA = makeRows(5, { price_avg: 20, package: 'cartons', origin: 'CA' });
        const periodB = makeRows(5, { price_avg: 25, package: 'cartons', origin: 'CA' });

        const bridge = computeBridge(periodA, periodB);

        expect(bridge.period_a_avg).toBe(20);
        expect(bridge.period_b_avg).toBe(25);

        const priceLevel = bridge.effects.find(e => e.label === 'Price Level');
        expect(priceLevel.value).toBe(5);

        // Other effects should be zero (same composition)
        const pkgMix = bridge.effects.find(e => e.label === 'Package Mix');
        const origMix = bridge.effects.find(e => e.label === 'Origin Mix');
        expect(pkgMix.value).toBe(0);
        expect(origMix.value).toBe(0);
    });

    test('effects sum exactly to total delta (bridge identity)', () => {
        const periodA = [
            ...makeRows(3, { price_avg: 10, package: 'A', origin: 'X' }),
            ...makeRows(2, { price_avg: 20, package: 'B', origin: 'Y' }),
        ];
        const periodB = [
            ...makeRows(4, { price_avg: 12, package: 'A', origin: 'X' }),
            ...makeRows(1, { price_avg: 22, package: 'B', origin: 'Y' }),
            ...makeRows(2, { price_avg: 15, package: 'C', origin: 'Z' }),
        ];

        const bridge = computeBridge(periodA, periodB);
        const totalDelta = bridge.period_b_avg - bridge.period_a_avg;
        const effectsSum = bridge.effects.reduce((sum, e) => sum + e.value, 0);

        expect(Math.abs(effectsSum - totalDelta)).toBeLessThan(0.02);
    });

    test('empty Period A → New Data effect absorbs everything', () => {
        const periodB = makeRows(3, { price_avg: 15 });
        const bridge = computeBridge([], periodB);

        expect(bridge.period_a_avg).toBe(0);
        expect(bridge.period_b_avg).toBe(15);
        expect(bridge.effects[0].label).toBe('New Data');
        expect(bridge.effects[0].value).toBe(15);
    });

    test('empty Period B → Data Removed effect', () => {
        const periodA = makeRows(3, { price_avg: 15 });
        const bridge = computeBridge(periodA, []);

        expect(bridge.period_a_avg).toBe(15);
        expect(bridge.period_b_avg).toBe(0);
        expect(bridge.effects[0].label).toBe('Data Removed');
        expect(bridge.effects[0].value).toBe(-15);
    });

    test('both periods empty → zero bridge', () => {
        const bridge = computeBridge([], []);

        expect(bridge.period_a_avg).toBe(0);
        expect(bridge.period_b_avg).toBe(0);
        bridge.effects.forEach(e => {
            expect(e.value).toBe(0);
        });
    });

    test('date range metadata is extracted correctly', () => {
        const periodA = [
            makeRow({ report_date: '2026-01-10' }),
            makeRow({ report_date: '2026-01-15' }),
            makeRow({ report_date: '2026-01-12' }),
        ];
        const periodB = [
            makeRow({ report_date: '2026-02-01' }),
            makeRow({ report_date: '2026-02-07' }),
        ];

        const bridge = computeBridge(periodA, periodB);

        expect(bridge.period_a.start).toBe('2026-01-10');
        expect(bridge.period_a.end).toBe('2026-01-15');
        expect(bridge.period_a.reportCount).toBe(3);
        expect(bridge.period_b.start).toBe('2026-02-01');
        expect(bridge.period_b.end).toBe('2026-02-07');
        expect(bridge.period_b.reportCount).toBe(2);
    });

    test('segment appearing only in Period B → absorbed by mix/residual', () => {
        const periodA = makeRows(5, { price_avg: 10, package: 'A', origin: 'X' });
        const periodB = [
            ...makeRows(3, { price_avg: 10, package: 'A', origin: 'X' }),
            ...makeRows(2, { price_avg: 30, package: 'B', origin: 'Y' }),
        ];

        const bridge = computeBridge(periodA, periodB);
        const priceLevel = bridge.effects.find(e => e.label === 'Price Level');

        // Price Level should be 0 since the shared segment (A,X) has same price
        expect(priceLevel.value).toBe(0);

        // But the overall delta should be non-zero (new expensive segment)
        const totalDelta = bridge.period_b_avg - bridge.period_a_avg;
        expect(totalDelta).toBeGreaterThan(0);

        // And it should be captured by mix + residual
        const effectsSum = bridge.effects.reduce((sum, e) => sum + e.value, 0);
        expect(Math.abs(effectsSum - totalDelta)).toBeLessThan(0.02);
    });

    test('handles NaN price_avg gracefully', () => {
        const periodA = [
            makeRow({ price_avg: 10 }),
            makeRow({ price_avg: NaN }),
            makeRow({ price_avg: 20 }),
        ];
        const periodB = makeRows(3, { price_avg: 15 });

        const bridge = computeBridge(periodA, periodB);

        // Should skip NaN rows: avg of [10, 20] = 15
        expect(bridge.period_a_avg).toBe(15);
        expect(bridge.period_b_avg).toBe(15);
    });
});

describe('computeAllBridges', () => {

    test('partitions data by market_type and computes three bridges', () => {
        const periodA = [
            ...makeRows(3, { price_avg: 10, market_type: 'Terminal' }),
            ...makeRows(3, { price_avg: 20, market_type: 'Shipping Point' }),
            ...makeRows(3, { price_avg: 30, market_type: 'Retail - Specialty Crops' }),
        ];
        const periodB = [
            ...makeRows(3, { price_avg: 12, market_type: 'Terminal' }),
            ...makeRows(3, { price_avg: 22, market_type: 'Shipping Point' }),
            ...makeRows(3, { price_avg: 28, market_type: 'Retail - Specialty Crops' }),
        ];

        const result = computeAllBridges(periodA, periodB);

        expect(result.terminal.period_a_avg).toBe(10);
        expect(result.terminal.period_b_avg).toBe(12);

        expect(result.shipping.period_a_avg).toBe(20);
        expect(result.shipping.period_b_avg).toBe(22);

        expect(result.retail.period_a_avg).toBe(30);
        expect(result.retail.period_b_avg).toBe(28);

        // Summary deltas
        expect(result.summary.terminal_delta).toBe(2);
        expect(result.summary.shipping_delta).toBe(2);
        expect(result.summary.retail_delta).toBe(-2);

        // Summary percentages
        expect(result.summary.terminal_pct).toBe(20);
        expect(result.summary.shipping_pct).toBe(10);
        expect(result.summary.retail_pct).toBeCloseTo(-6.67, 1);
    });

    test('handles rows with null market_type (default to terminal)', () => {
        const periodA = makeRows(3, { price_avg: 10, market_type: null });
        const periodB = makeRows(3, { price_avg: 15, market_type: null });

        const result = computeAllBridges(periodA, periodB);

        // Null market_type should fall into terminal
        expect(result.terminal.period_a_avg).toBe(10);
        expect(result.terminal.period_b_avg).toBe(15);
        expect(result.shipping.period_a_avg).toBe(0);
        expect(result.retail.period_a_avg).toBe(0);
    });
});
