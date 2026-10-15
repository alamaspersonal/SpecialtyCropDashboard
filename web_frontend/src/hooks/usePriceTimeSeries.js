/**
 * usePriceTimeSeries — price history for the price-over-time chart.
 *
 * Data loads on demand, per range, and is cached by TanStack Query:
 *   3M / 6M        raw rows for just that window, averaged per day.
 *   1Y / 2Y / All  the monthly rollup (UnifiedCropPriceMonthly), fetched the
 *                  first time one of them is picked and shared by all three.
 * Ranges count back from the commodity's latest report, not from today.
 *
 * Price units are never mixed. Each row's basis is $/lb (price_per_lb), else
 * $/each (price_per_unit), else $/package (price_avg) — the same rule the
 * rollup uses. All three market lines plot one basis at a time (the one with
 * the most rows unless the user picks another), so they stay comparable.
 *
 * @param {Object} filters  - { commodity, variety, district }
 * @param {Object} options  - { organicOnly }
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTimeSeriesBounds, getTimeSeriesWindow, getMonthlyPriceRollup } from '../services/supabaseApi';
import { adjustToCurrent } from '../shared/cpiAdjust';

export const RANGE_PRESETS = [
    { key: '3M', days: 90, source: 'raw' },
    { key: '6M', days: 180, source: 'raw' },
    { key: '1Y', days: 365, source: 'monthly' },
    { key: '2Y', days: 730, source: 'monthly' },
    { key: 'All', days: Infinity, source: 'monthly' },
];

export const PRICE_UNITS = [
    { key: 'lb', label: '$/lb', title: 'Price / lb' },
    { key: 'unit', label: '$/each', title: 'Price / each' },
    { key: 'pkg', label: '$/package', title: 'Avg package price' },
];

const MARKET_TYPES = ['terminal', 'shipping', 'retail'];

function classifyMarketType(mt) {
    const s = String(mt || '').toLowerCase();
    if (s.includes('terminal')) return 'terminal';
    if (s.includes('shipping')) return 'shipping';
    if (s.includes('retail')) return 'retail';
    return null;
}

const isNum = (v) => v != null && !isNaN(v);

// Normalize a raw row to the same shape as a rollup row: one priced (or
// unpriced) observation in a daily bucket.
function rawEntry(row) {
    const market = classifyMarketType(row.market_type);
    if (!market) return null;
    let basis = 'none', price = 0;
    if (isNum(row.price_per_lb)) { basis = 'lb'; price = Number(row.price_per_lb); }
    else if (isNum(row.price_per_unit)) { basis = 'unit'; price = Number(row.price_per_unit); }
    else if (isNum(row.price_avg)) { basis = 'pkg'; price = Number(row.price_avg); }
    const priced = price > 0;
    return {
        date: String(row.report_date).substring(0, 10),
        market, basis,
        package: row.package || '',
        sum: priced ? price : 0,
        count: priced ? 1 : 0,
    };
}

function rollupEntry(row) {
    const market = classifyMarketType(row.market_type);
    if (!market) return null;
    return {
        date: row.month, // YYYY-MM-01
        market,
        basis: row.price_basis,
        package: row.package || '',
        sum: row.price_sum,
        count: row.price_count,
    };
}

// `days` before the latest report, as YYYY-MM-DD (UTC).
function cutoffDay(maxDate, days) {
    const d = new Date(maxDate);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().substring(0, 10);
}

// Basis with the most priced rows in a { lb, unit, pkg } tally.
function dominantUnit(tally) {
    return PRICE_UNITS.map(u => u.key)
        .filter(k => tally[k] > 0)
        .sort((a, b) => tally[b] - tally[a])[0] || null;
}

export default function usePriceTimeSeries(filters, options = {}) {
    const { organicOnly = false } = options;
    const commodity = filters?.commodity || '';
    const serverFilters = useMemo(() => ({
        district: filters?.district || undefined,
        variety: filters?.variety || undefined,
        organic: organicOnly ? 'yes' : undefined,
    }), [filters?.district, filters?.variety, organicOnly]);

    const [selectedRange, setSelectedRange] = useState('3M');
    const [selectedPackage, setSelectedPackage] = useState('');
    const [selectedUnit, setSelectedUnit] = useState(''); // '' = most common
    const [cpiAdjusted, setCpiAdjusted] = useState(false);

    // ── Date bounds: which ranges can be offered, and where they end ──
    const boundsQuery = useQuery({
        queryKey: ['ts-bounds', commodity, serverFilters],
        queryFn: () => getTimeSeriesBounds(commodity, serverFilters),
        enabled: !!commodity,
    });
    const { minDate = null, maxDate = null } = boundsQuery.data || {};

    const dateSpan = useMemo(() => {
        if (!minDate || !maxDate) return { min: null, max: null, spanDays: 0 };
        return { min: minDate, max: maxDate, spanDays: (new Date(maxDate) - new Date(minDate)) / 86400000 };
    }, [minDate, maxDate]);

    // Only offer ranges the data span can fill (always keep 3M and All).
    const availableRanges = useMemo(() => {
        const keys = RANGE_PRESETS
            .filter(r => r.days === Infinity || r.days <= dateSpan.spanDays)
            .map(r => r.key);
        if (!keys.includes('3M')) keys.unshift('3M');
        if (!keys.includes('All')) keys.push('All');
        return keys;
    }, [dateSpan.spanDays]);

    const range = availableRanges.includes(selectedRange) ? selectedRange : '3M';
    const preset = RANGE_PRESETS.find(r => r.key === range);
    const cutoff = maxDate && preset.days !== Infinity ? cutoffDay(maxDate, preset.days) : null;

    // ── Range data: only the active source is fetched ──
    const rawQuery = useQuery({
        queryKey: ['ts-raw', commodity, serverFilters, cutoff],
        queryFn: () => getTimeSeriesWindow(commodity, serverFilters, cutoff),
        enabled: !!commodity && preset.source === 'raw' && !!cutoff,
    });
    const monthlyQuery = useQuery({
        queryKey: ['ts-monthly', commodity, serverFilters],
        queryFn: () => getMonthlyPriceRollup(commodity, serverFilters),
        enabled: !!commodity && preset.source === 'monthly',
        staleTime: 30 * 60 * 1000, // rollup only changes once a day
    });
    const activeQuery = preset.source === 'raw' ? rawQuery : monthlyQuery;

    // Entries inside the selected range (rollup months must start after the cutoff).
    const rangeEntries = useMemo(() => {
        if (preset.source === 'raw') {
            return (rawQuery.data || []).map(rawEntry).filter(Boolean);
        }
        return (monthlyQuery.data || [])
            .map(rollupEntry)
            .filter(e => e && (!cutoff || e.date > cutoff));
    }, [preset.source, rawQuery.data, monthlyQuery.data, cutoff]);

    const packageOptions = useMemo(
        () => [...new Set(rangeEntries.map(e => e.package).filter(Boolean))].sort(),
        [rangeEntries],
    );
    const pkg = packageOptions.includes(selectedPackage) ? selectedPackage : '';

    // Priced-row tallies per unit, overall and per market, for the current
    // range + package. Drive the unit options, the default, and gap notes.
    const { unitTally, marketTally } = useMemo(() => {
        const overall = { lb: 0, unit: 0, pkg: 0 };
        const perMarket = Object.fromEntries(MARKET_TYPES.map(m => [m, { lb: 0, unit: 0, pkg: 0 }]));
        for (const e of rangeEntries) {
            if (pkg && e.package !== pkg) continue;
            if (!(e.basis in overall) || !e.count) continue;
            overall[e.basis] += e.count;
            perMarket[e.market][e.basis] += e.count;
        }
        return { unitTally: overall, marketTally: perMarket };
    }, [rangeEntries, pkg]);

    const unitOptions = PRICE_UNITS.filter(u => unitTally[u.key] > 0);
    const unit = unitTally[selectedUnit] > 0 ? selectedUnit : (dominantUnit(unitTally) || 'lb');

    // Markets with prices in this range, but none in the selected unit:
    // { retail: 'unit' } → "Retail has no $/lb prices — switch to $/each".
    const unitGaps = useMemo(() => {
        const gaps = {};
        for (const m of MARKET_TYPES) {
            const best = dominantUnit(marketTally[m]);
            if (best && !marketTally[m][unit]) gaps[m] = best;
        }
        return gaps;
    }, [marketTally, unit]);

    const series = useMemo(() => {
        const buckets = Object.fromEntries(MARKET_TYPES.map(m => [m, new Map()]));
        for (const e of rangeEntries) {
            if (e.basis !== unit || !e.count) continue;
            if (pkg && e.package !== pkg) continue;
            const b = buckets[e.market].get(e.date) || { sum: 0, count: 0 };
            b.sum += e.sum;
            b.count += e.count;
            buckets[e.market].set(e.date, b);
        }

        const out = {};
        for (const m of MARKET_TYPES) {
            const points = [...buckets[m].entries()]
                .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                .map(([date, b]) => ({ date, price: b.sum / b.count, count: b.count }));
            out[m] = cpiAdjusted
                ? points.map(p => ({ ...p, price: adjustToCurrent(p.price, p.date) }))
                : points;
        }
        return out;
    }, [rangeEntries, unit, pkg, cpiAdjusted]);

    return {
        series,
        loading: boundsQuery.isLoading || activeQuery.isLoading,
        error: boundsQuery.error || activeQuery.error || null,
        packageOptions,
        selectedPackage: pkg,
        unitOptions,
        unit,
        unitGaps,
        selectedRange: range,
        availableRanges,
        granularity: preset.source === 'raw' ? 'day' : 'month',
        cpiAdjusted,
        cpiActive: cpiAdjusted,
        dateSpan,
        actions: { setSelectedPackage, setSelectedRange, setSelectedUnit, setCpiAdjusted },
    };
}
