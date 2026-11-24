/**
 * usePriceTimeSeries — price history for the phone price-over-time chart.
 *
 * Data loads per range, counting back from the commodity's latest report:
 *   3M / 6M   raw rows, one point per day. Widening 3M → 6M only fetches the
 *             missing older months.
 *   1Y / 2Y   the monthly rollup (UnifiedCropPriceMonthly), one point per
 *             month — a few thousand rows instead of up to ~86k raw rows, and
 *             the same source the web chart uses. The rollup has no origin, so
 *             the Origin filter only applies to 3M / 6M.
 *
 * Units are never mixed (see shared/priceEntries). All three lines plot one
 * unit at a time — $/lb, $/each or $/package; the most common unless the user
 * picks another. In $/lb, "All" packages average together. $/each and
 * $/package prices can't be compared across packages, so in those units each
 * line shows a single package: the user's pick, else its most-reported one.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDateRange, getTimeSeriesWindow, getMonthlyPriceRollup } from '../services/api';
import { adjustToCurrent } from '../shared/cpiAdjust';
import { addDaysToKey, toDateKey } from '../shared/dates';
import { PRICE_UNITS, entryFromRow, entryFromRollup } from '../shared/priceEntries';

export const RANGE_PRESETS = [
    { key: '3M', label: '3M', days: 90, source: 'raw' },
    { key: '6M', label: '6M', days: 180, source: 'raw' },
    { key: '1Y', label: '1Y', days: 365, source: 'monthly' },
    { key: '2Y', label: '2Y', days: 730, source: 'monthly' },
];
const LONGEST_DAYS = 730;

const MARKET_TYPES = ['retail', 'terminal', 'shipping'];
const EMPTY_TYPE_STATE = { retail: '', terminal: '', shipping: '' };

// ── Helpers ─────────────────────────────────────────────────────

function getUnique(arr, field) {
    return [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();
}

// Package with the most priced observations (ties: alphabetical).
function mostReportedPackage(entries) {
    const counts = new Map();
    for (const e of entries) counts.set(e.package, (counts.get(e.package) || 0) + e.count);
    let best = '';
    let bestCount = 0;
    for (const [pkg, count] of counts) {
        if (count > bestCount || (count === bestCount && pkg < best)) {
            best = pkg;
            bestCount = count;
        }
    }
    return best;
}

/** One point per date (day or month): the average price in the chosen unit. */
function aggregatePoints(entries) {
    const byDate = new Map();
    for (const e of entries) {
        let p = byDate.get(e.date);
        if (!p) {
            p = { sum: 0, count: 0, packages: {}, origins: {}, varieties: {} };
            byDate.set(e.date, p);
        }
        p.sum += e.sum;
        p.count += e.count;
        p.packages[e.package || 'Unknown'] = (p.packages[e.package || 'Unknown'] || 0) + e.count;
        p.varieties[e.variety || 'Unknown'] = (p.varieties[e.variety || 'Unknown'] || 0) + e.count;
        if (e.origin !== null) p.origins[e.origin || 'Unknown'] = (p.origins[e.origin || 'Unknown'] || 0) + e.count;
    }
    return [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, p]) => ({
            date,
            price: Math.round((p.sum / p.count) * 100) / 100,
            pointCount: p.count,
            packagesCount: p.packages,
            originsCount: p.origins,
            varietiesCount: p.varieties,
        }));
}

// ── Hook ────────────────────────────────────────────────────────

export default function usePriceTimeSeries(filters, options = {}) {
    const { organicOnly = false, cpiAdjusted = false } = options;
    const commodity = filters.commodity || '';
    const district = filters.district || '';

    const [bounds, setBounds] = useState({ minKey: null, maxKey: null, resolved: false });
    // Raw entries from fromKey through the latest report, and monthly entries
    // for the last 2 years — each fetched the first time a range needs it.
    const [rawData, setRawData] = useState({ fromKey: null, entries: [] });
    const [monthlyData, setMonthlyData] = useState({ loaded: false, entries: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Per-market-type sub-filter state ('' = All / automatic)
    const [selectedVarieties, setSelectedVarieties] = useState(EMPTY_TYPE_STATE);
    const [selectedPackages,  setSelectedPackages]  = useState(EMPTY_TYPE_STATE);
    const [selectedOrigins,   setSelectedOrigins]   = useState(EMPTY_TYPE_STATE);
    const [selectedUnit, setSelectedUnit] = useState(''); // '' = most common
    const [selectedRange, setSelectedRange] = useState('3M');

    // ── Date bounds; everything resets on commodity/district change ──
    useEffect(() => {
        let cancelled = false;
        setBounds({ minKey: null, maxKey: null, resolved: false });
        setRawData({ fromKey: null, entries: [] });
        setMonthlyData({ loaded: false, entries: [] });
        setSelectedVarieties(EMPTY_TYPE_STATE);
        setSelectedPackages(EMPTY_TYPE_STATE);
        setSelectedOrigins(EMPTY_TYPE_STATE);
        setSelectedUnit('');
        setError(null);
        if (!commodity) { setLoading(false); return undefined; }
        setLoading(true);
        getDateRange({ commodity, district })
            .then(b => {
                if (cancelled) return;
                setBounds({ minKey: toDateKey(b.minDate), maxKey: toDateKey(b.maxDate), resolved: true });
            })
            .catch(err => {
                if (cancelled) return;
                console.error('usePriceTimeSeries: bounds error', err);
                setError(err);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [commodity, district]);

    // ── Date span & ranges ──
    const dateSpan = useMemo(() => {
        if (!bounds.minKey || !bounds.maxKey) return { min: null, max: null, spanDays: 0 };
        const spanDays = Math.round((new Date(bounds.maxKey) - new Date(bounds.minKey)) / 86400000);
        return { min: bounds.minKey, max: bounds.maxKey, spanDays };
    }, [bounds.minKey, bounds.maxKey]);

    // Only offer ranges the data can fill (always keep 3M).
    const availableRanges = useMemo(() => {
        const ranges = RANGE_PRESETS.filter(p => p.days <= dateSpan.spanDays);
        return ranges.length ? ranges : [RANGE_PRESETS[0]];
    }, [dateSpan.spanDays]);

    const preset = availableRanges.find(p => p.key === selectedRange) || availableRanges[0];
    const cutoff = bounds.maxKey ? addDaysToKey(bounds.maxKey, -preset.days) : null;
    const isMonthly = preset.source === 'monthly';

    // ── Fetch whatever the active range is missing ──
    useEffect(() => {
        if (!bounds.resolved) return undefined;
        if (!bounds.maxKey) { setLoading(false); return undefined; }
        const haveRaw = rawData.fromKey && rawData.fromKey <= cutoff;
        if ((isMonthly && monthlyData.loaded) || (!isMonthly && haveRaw)) {
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                if (isMonthly) {
                    const fromMonth = `${addDaysToKey(bounds.maxKey, -LONGEST_DAYS).slice(0, 7)}-01`;
                    const rows = await getMonthlyPriceRollup(commodity, { district }, fromMonth);
                    if (cancelled) return;
                    setMonthlyData({ loaded: true, entries: rows.map(r => entryFromRollup(r)).filter(Boolean) });
                } else {
                    // Only the days older than what's already loaded
                    const rows = await getTimeSeriesWindow(commodity, { district }, cutoff, rawData.fromKey);
                    if (cancelled) return;
                    const older = rows.map(entryFromRow).filter(Boolean);
                    setRawData(prev => ({ fromKey: cutoff, entries: [...older, ...prev.entries] }));
                }
                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error('usePriceTimeSeries: fetch error', err);
                setError(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [commodity, district, bounds.resolved, bounds.maxKey, isMonthly, cutoff, rawData.fromKey, monthlyData.loaded]);

    // ── Entries in the selected range, per market (organic applied) ──
    const byMarket = useMemo(() => {
        const out = { retail: [], terminal: [], shipping: [] };
        if (!cutoff) return out;
        // Months count only if they start after the cutoff, so a 1Y range is
        // 12 whole months (the latest one may be partial).
        const source = isMonthly
            ? monthlyData.entries.filter(e => e.date > cutoff)
            : rawData.entries.filter(e => e.date >= cutoff);
        for (const e of source) {
            if (organicOnly && e.organic !== 'yes') continue;
            out[e.market].push(e);
        }
        return out;
    }, [isMonthly, monthlyData.entries, rawData.entries, cutoff, organicOnly]);

    // Origins only exist on raw rows; a user's origin pick is kept for when
    // they return to 3M / 6M.
    const origins = isMonthly ? EMPTY_TYPE_STATE : selectedOrigins;

    // Entries matching each market's variety + origin picks (not package)
    const matchingByMarket = useMemo(() => {
        const out = {};
        for (const m of MARKET_TYPES) {
            out[m] = byMarket[m].filter(e =>
                (!selectedVarieties[m] || e.variety === selectedVarieties[m]) &&
                (!origins[m] || e.origin === origins[m]));
        }
        return out;
    }, [byMarket, selectedVarieties, origins]);

    // ── Unit: the user's pick if it has data, else the most common ──
    const unitTally = useMemo(() => {
        const tally = { lb: 0, unit: 0, pkg: 0 };
        for (const m of MARKET_TYPES) {
            for (const e of matchingByMarket[m]) if (e.count && e.basis in tally) tally[e.basis] += e.count;
        }
        return tally;
    }, [matchingByMarket]);
    const unitOptions = PRICE_UNITS.filter(u => unitTally[u.key] > 0);
    const unit = unitTally[selectedUnit] > 0
        ? selectedUnit
        : (unitOptions.slice().sort((a, b) => unitTally[b.key] - unitTally[a.key])[0]?.key || 'lb');

    // ── Package per market: "All" only in $/lb; otherwise one package ──
    const effectivePackages = useMemo(() => {
        const out = {};
        for (const m of MARKET_TYPES) {
            const inUnit = matchingByMarket[m].filter(e => e.basis === unit && e.count);
            const pick = selectedPackages[m];
            if (pick && inUnit.some(e => e.package === pick)) out[m] = pick;
            else out[m] = unit === 'lb' ? '' : mostReportedPackage(inUnit);
        }
        return out;
    }, [matchingByMarket, unit, selectedPackages]);

    // ── Per-type filter options (cascading within each market type) ──
    const filterOptions = useMemo(() => {
        const opts = {};
        for (const m of MARKET_TYPES) {
            const typeData = byMarket[m];
            const pkg  = effectivePackages[m];
            const org  = origins[m];
            const vrty = selectedVarieties[m];
            const inUnit = typeData.filter(d => d.basis === unit && d.count);

            // For each dimension, filter by the OTHER selections to determine
            // which values would still yield data (used to grey out unavailable options)
            const forVarieties = typeData.filter(d => (!pkg || d.package === pkg) && (!org || d.origin === org));
            const forPackages = inUnit.filter(d => (!vrty || d.variety === vrty) && (!org || d.origin === org));
            const forOrigins = typeData.filter(d => (!vrty || d.variety === vrty) && (!pkg || d.package === pkg));

            opts[m] = {
                varieties: getUnique(typeData, 'variety'),
                packages:  getUnique(inUnit, 'package'),
                origins:   isMonthly ? [] : getUnique(typeData, 'origin'),
                varietiesWithData: new Set(getUnique(forVarieties, 'variety')),
                packagesWithData:  new Set(getUnique(forPackages,  'package')),
                originsWithData:   new Set(getUnique(forOrigins,   'origin')),
                // $/each and $/package prices differ per package, so those
                // units always show one package rather than "All".
                allowAllPackages: unit === 'lb',
            };
        }
        return opts;
    }, [byMarket, effectivePackages, origins, selectedVarieties, unit, isMonthly]);

    // ── Series ──
    const cpiActive = cpiAdjusted && isMonthly;
    const series = useMemo(() => {
        const out = {};
        for (const m of MARKET_TYPES) {
            const pkg = effectivePackages[m];
            const points = aggregatePoints(matchingByMarket[m].filter(e =>
                e.basis === unit && e.count && (!pkg || e.package === pkg)));
            out[m] = cpiActive
                ? points.map(p => ({ ...p, price: adjustToCurrent(p.price, p.date) }))
                : points;
        }
        return out;
    }, [matchingByMarket, effectivePackages, unit, cpiActive]);

    // ── Actions ──
    const actions = {
        setSelectedVariety: useCallback(
            (type, val) => setSelectedVarieties(prev => ({ ...prev, [type]: val })), []),
        setSelectedPackage: useCallback(
            (type, val) => setSelectedPackages(prev => ({ ...prev, [type]: val })), []),
        setSelectedOrigin: useCallback(
            (type, val) => setSelectedOrigins(prev => ({ ...prev, [type]: val })), []),
        setSelectedRange: useCallback((val) => setSelectedRange(val), []),
        setSelectedUnit: useCallback((val) => setSelectedUnit(val), []),
    };

    return {
        series,
        cpiActive,
        unit,              // 'lb' | 'unit' | 'pkg' — shared by all three lines
        unitOptions,       // PRICE_UNITS entries that have data
        granularity: isMonthly ? 'month' : 'day',
        loading,
        error,

        filterOptions,     // { retail, terminal, shipping } each with varieties/packages/origins/…WithData
        selectedVarieties,
        selectedPackages,  // the user's picks ('' = none)
        effectivePackages, // what each line actually shows
        selectedOrigins: origins,

        selectedRange: preset.key,
        availableRanges,
        dateSpan,

        actions,
    };
}
