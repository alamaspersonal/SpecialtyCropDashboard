/**
 * usePriceTimeSeries — price history for the price-over-time chart.
 *
 * Fetches a commodity's full history once, then derives (client-side, memoized)
 * the three market-type series (terminal/shipping/retail) for the selected time
 * range, package, and CPI setting.
 *
 * Price basis: the backend-computed `price_per_lb` (else `price_per_unit`, else
 * `price_avg`) — no client-side weight math. Granularity is adaptive: daily for
 * short ranges, monthly averages for long ranges.
 *
 * @param {Object} filters  - { commodity, variety, district }
 * @param {Object} options  - { organicOnly }
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTimeSeriesData } from '../services/supabaseApi';
import { adjustToCurrent } from '../shared/cpiAdjust';

// Range presets. `days` is the lookback from the latest data point; `granularity`
// switches daily↔monthly so long ranges stay readable and light.
export const RANGE_PRESETS = [
    { key: '3M', days: 90, granularity: 'day' },
    { key: '6M', days: 180, granularity: 'day' },
    { key: '1Y', days: 365, granularity: 'month' },
    { key: '2Y', days: 730, granularity: 'month' },
    { key: 'All', days: Infinity, granularity: 'month' },
];

const MARKET_TYPES = ['terminal', 'shipping', 'retail'];

function classifyMarketType(mt) {
    const s = String(mt || '').toLowerCase();
    if (s.includes('terminal')) return 'terminal';
    if (s.includes('shipping')) return 'shipping';
    if (s.includes('retail')) return 'retail';
    return null;
}

// Per-row price basis: prefer normalized $/lb, then $/unit, else the package price.
function rowPrice(row) {
    if (row.price_per_lb != null && !isNaN(row.price_per_lb)) return { value: Number(row.price_per_lb), unit: 'lb' };
    if (row.price_per_unit != null && !isNaN(row.price_per_unit)) return { value: Number(row.price_per_unit), unit: 'unit' };
    if (row.price_avg != null && !isNaN(row.price_avg)) return { value: Number(row.price_avg), unit: 'pkg' };
    return null;
}

// Bucket rows by day (YYYY-MM-DD) or month (YYYY-MM) and average the basis price.
function aggregateBuckets(rows, granularity) {
    const buckets = new Map();
    const tally = { lb: 0, unit: 0, pkg: 0 };

    for (const row of rows) {
        const p = rowPrice(row);
        if (!p || !(p.value > 0)) continue;
        const day = String(row.report_date).substring(0, 10);
        const key = granularity === 'month' ? day.substring(0, 7) : day;
        let b = buckets.get(key);
        if (!b) { b = { sum: 0, count: 0 }; buckets.set(key, b); }
        b.sum += p.value;
        b.count += 1;
        tally[p.unit] += 1;
    }

    const points = [...buckets.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([key, b]) => ({
            // Month buckets are anchored to the 1st so recharts can place them on a time axis.
            date: granularity === 'month' ? `${key}-01` : key,
            price: b.sum / b.count,
            count: b.count,
        }));

    const seriesUnit = tally.lb >= tally.unit && tally.lb >= tally.pkg
        ? 'lb'
        : tally.unit >= tally.pkg ? 'unit' : 'pkg';

    return { points, seriesUnit };
}

export default function usePriceTimeSeries(filters, options = {}) {
    const { organicOnly = false } = options;
    const commodity = filters?.commodity || '';
    const district = filters?.district || '';
    const variety = filters?.variety || '';

    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedRange, setSelectedRange] = useState('6M');
    const [selectedPackage, setSelectedPackage] = useState('');
    const [cpiAdjusted, setCpiAdjusted] = useState(false);

    // ── Fetch raw history (server-side inputs only) ──
    const fetchData = useCallback(async () => {
        if (!commodity) { setRawData([]); return; }
        setLoading(true);
        setError(null);
        try {
            const data = await getTimeSeriesData(commodity, {
                district: district || undefined,
                organic: organicOnly ? 'yes' : undefined,
            });
            setRawData(data);
        } catch (err) {
            console.error('[usePriceTimeSeries] Error:', err);
            setError(err);
            setRawData([]);
        } finally {
            setLoading(false);
        }
    }, [commodity, district, organicOnly]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Variety is applied client-side (kept off the server query for cache reuse).
    const baseData = useMemo(
        () => (variety ? rawData.filter(d => d.variety === variety) : rawData),
        [rawData, variety],
    );

    const dateSpan = useMemo(() => {
        if (baseData.length === 0) return { min: null, max: null, spanDays: 0 };
        const min = baseData[0].report_date;
        const max = baseData[baseData.length - 1].report_date; // query is ordered ascending
        const spanDays = (new Date(max) - new Date(min)) / 86400000;
        return { min, max, spanDays };
    }, [baseData]);

    // Only offer ranges the data span can fill (always keep 3M and All).
    const availableRanges = useMemo(() => {
        const span = dateSpan.spanDays || 0;
        const keys = RANGE_PRESETS
            .filter(r => r.days === Infinity || r.days <= span)
            .map(r => r.key);
        if (!keys.includes('3M')) keys.unshift('3M');
        if (!keys.includes('All')) keys.push('All');
        return keys;
    }, [dateSpan]);

    // Keep the selected range valid as data changes.
    useEffect(() => {
        if (availableRanges.length && !availableRanges.includes(selectedRange)) {
            setSelectedRange(availableRanges[availableRanges.length - 1]);
        }
    }, [availableRanges, selectedRange]);

    const packageOptions = useMemo(
        () => [...new Set(baseData.map(d => d.package).filter(Boolean))].sort(),
        [baseData],
    );

    useEffect(() => {
        if (selectedPackage && !packageOptions.includes(selectedPackage)) setSelectedPackage('');
    }, [packageOptions, selectedPackage]);

    const granularity = useMemo(
        () => RANGE_PRESETS.find(r => r.key === selectedRange)?.granularity || 'day',
        [selectedRange],
    );

    const series = useMemo(() => {
        const empty = { terminal: [], shipping: [], retail: [], _units: {} };
        if (baseData.length === 0) return empty;

        const preset = RANGE_PRESETS.find(r => r.key === selectedRange) || RANGE_PRESETS[0];
        let cutoff = null;
        if (preset.days !== Infinity && dateSpan.max) {
            cutoff = new Date(dateSpan.max);
            cutoff.setDate(cutoff.getDate() - preset.days);
        }

        const buckets = { terminal: [], shipping: [], retail: [] };
        for (const row of baseData) {
            if (selectedPackage && row.package !== selectedPackage) continue;
            if (cutoff && new Date(row.report_date) < cutoff) continue;
            const t = classifyMarketType(row.market_type);
            if (t) buckets[t].push(row);
        }

        const applyCpi = (pts) => (cpiAdjusted
            ? pts.map(p => ({ ...p, price: adjustToCurrent(p.price, p.date) }))
            : pts);

        const out = { _units: {} };
        for (const t of MARKET_TYPES) {
            const { points, seriesUnit } = aggregateBuckets(buckets[t], preset.granularity);
            out[t] = applyCpi(points);
            out._units[t] = seriesUnit;
        }
        return out;
    }, [baseData, selectedRange, selectedPackage, cpiAdjusted, dateSpan.max]);

    return {
        series,
        loading,
        error,
        packageOptions,
        selectedPackage,
        selectedRange,
        availableRanges,
        granularity,
        cpiAdjusted,
        cpiActive: cpiAdjusted,
        dateSpan,
        actions: { setSelectedPackage, setSelectedRange, setCpiAdjusted },
    };
}
