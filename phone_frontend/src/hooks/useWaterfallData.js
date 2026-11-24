/**
 * useWaterfallData — Custom Hook
 *
 * Data fetching, per-market-type cascading sub-filters, and price stats for
 * the DashboardScreen waterfall.
 *
 * Daily / 7 Days / 30 Days use the raw rows from the 90 days ending on the
 * commodity's latest report. A custom range uses raw rows too, unless it is
 * too large for them; then whole months come from the monthly rollup (no
 * origin column, so the Origin filter is unavailable) and only the partial
 * months at either end are fetched raw.
 *
 * Prices never mix units (see shared/priceEntries): each bar shows one $/lb
 * average across every package with a known weight, plus a separate price for
 * each package sold per each or per package.
 *
 * Each instance of this hook runs independently.
 *
 * @param {Object} filters       - Top-level filters { commodity, district, ... }
 * @param {string} timeRange     - 'daily' | '7day' | '30day' | 'custom'
 * @param {Object} options       - { customStartDate, customEndDate, organicOnly, selectedVariety, cpiAdjusted }
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDateRange, getPricesByDateRange, countPricesByDateRange, getMonthlyPriceRollup } from '../services/api';
import { adjustToCurrent } from '../shared/cpiAdjust';
import { addDaysToKey, keyToLocalDate, localDateToKey, toDateKey } from '../shared/dates';
import { entryFromRow, entryFromRollup, groupPrices, nextMonthStartKey } from '../shared/priceEntries';

const MARKET_TYPES = ['terminal', 'shipping', 'retail'];
const EMPTY_BY_TYPE = { terminal: '', shipping: '', retail: '' };

// Days of history fetched for the Daily / 7 Days / 30 Days presets. 30 Days
// compares against the 30 days before it, so this needs to cover at least 60.
const PRESET_WINDOW_DAYS = 90;

// A custom range with more raw rows than this is built from the monthly
// rollup instead (raw paging past ~20k rows is slow on a phone).
const RAW_ROW_LIMIT = 20000;

function getUnique(arr, field) {
    return [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();
}

const rowsToEntries = (rows) => rows.map(entryFromRow).filter(Boolean);

/**
 * Price entries for [startKey, endKey]: raw rows when they fit under
 * RAW_ROW_LIMIT, otherwise the monthly rollup for every whole month in the
 * range plus raw rows for the partial months at either end (so the average
 * still covers exactly the chosen days).
 *
 * @returns {{ entries: Array, rows: Array, usesMonthly: boolean }} rows = the raw rows fetched, newest first
 */
export async function fetchRangeEntries(apiFilters, startKey, endKey) {
    const firstWholeMonth = startKey.endsWith('-01') ? startKey : nextMonthStartKey(startKey);
    const dayAfterEnd = addDaysToKey(endKey, 1);
    const afterWholeMonths = dayAfterEnd.endsWith('-01') ? dayAfterEnd : `${endKey.slice(0, 7)}-01`;

    const total = await countPricesByDateRange(apiFilters, startKey, endKey);
    if (total <= RAW_ROW_LIMIT || firstWholeMonth >= afterWholeMonths) {
        const rows = await getPricesByDateRange(apiFilters, startKey, endKey);
        return { rows, entries: rowsToEntries(rows), usesMonthly: false };
    }

    const [head, tail, monthly] = await Promise.all([
        firstWholeMonth > startKey
            ? getPricesByDateRange(apiFilters, startKey, addDaysToKey(firstWholeMonth, -1))
            : [],
        afterWholeMonths <= endKey
            ? getPricesByDateRange(apiFilters, afterWholeMonths, endKey)
            : [],
        getMonthlyPriceRollup(apiFilters.commodity, { district: apiFilters.district }, firstWholeMonth, afterWholeMonths),
    ]);
    const rows = [...tail, ...head];
    const monthEntries = monthly.map(r => entryFromRollup(r)).filter(Boolean);
    return { rows, entries: [...rowsToEntries(rows), ...monthEntries], usesMonthly: true };
}

// Keep a selection while it matches data; otherwise "All". Never auto-pick a
// lone option: rows with a blank value (e.g. no district) aren't listed as an
// option, so selecting the only named value silently hid them — Cucumbers'
// Terminal card showed 4 of Nov 3's 9 reports with "Baja District" auto-picked.
function validate(options, current) {
    return current && options.includes(current) ? current : '';
}

// Earliest start / latest end across entries, as 'YYYY-MM-DD'. startIsMonth /
// endIsMonth flag an edge that comes from a monthly rollup: its day is only the
// month boundary, not a real report date, so it should be shown as a month.
function spanOf(entries) {
    if (!entries.length) return null;
    let { start, end } = entries[0];
    let startIsMonth = entries[0].isMonth;
    let endIsMonth = entries[0].isMonth;
    for (const e of entries) {
        if (e.start < start) { start = e.start; startIsMonth = e.isMonth; }
        if (e.end > end) { end = e.end; endIsMonth = e.isMonth; }
    }
    return { start, end, startIsMonth, endIsMonth };
}

export default function useWaterfallData(filters, timeRange, options = {}) {
    const {
        customStartDate = null,
        customEndDate = null,
        organicOnly = false,
        selectedVariety = '',
        cpiAdjusted = false,
    } = options;

    // ── Data State ──
    const [entries, setEntries] = useState([]);
    const [usesMonthly, setUsesMonthly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [marketNotes, setMarketNotes] = useState('');

    // Sub-filter selections (per market type). '' = All.
    const [selectedPackages, setSelectedPackages] = useState(EMPTY_BY_TYPE);
    const [selectedOrigins, setSelectedOrigins] = useState(EMPTY_BY_TYPE);
    const [selectedDistricts, setSelectedDistricts] = useState(EMPTY_BY_TYPE);
    const [selectedVarieties, setSelectedVarieties] = useState(EMPTY_BY_TYPE);

    // Server-side date bounds. min/max are local-midnight Dates of the
    // calendar day (for the date picker); minKey/maxKey are 'YYYY-MM-DD'.
    const [serverDateBounds, setServerDateBounds] = useState({ min: null, max: null, minKey: null, maxKey: null });

    const isCustom = timeRange === 'custom';
    const customStartKey = customStartDate ? localDateToKey(customStartDate) : null;
    const customEndKey = customEndDate ? localDateToKey(customEndDate) : null;
    // Only the custom range's dates affect the query, and only in custom mode —
    // switching Daily / 7 Days / 30 Days reuses the same fetched window.
    const fetchRangeKey = isCustom ? `${customStartKey}|${customEndKey}` : 'preset';

    // ── Fetch date bounds ──
    useEffect(() => {
        // Clear stale bounds immediately so the price-fetch effect below (which
        // waits on serverDateBounds.resolved) doesn't fire a query window anchored
        // on the *previous* commodity's max date while this one is in flight.
        setServerDateBounds({ min: null, max: null, minKey: null, maxKey: null, resolved: false });
        let cancelled = false;
        const fetchDateBounds = async () => {
            try {
                const bounds = await getDateRange({ commodity: filters.commodity, district: filters.district });
                if (cancelled) return;
                const minKey = toDateKey(bounds.minDate);
                const maxKey = toDateKey(bounds.maxDate);
                setServerDateBounds({
                    min: minKey ? keyToLocalDate(minKey) : null,
                    max: maxKey ? keyToLocalDate(maxKey) : null,
                    minKey,
                    maxKey,
                    resolved: true,
                });
            } catch (err) {
                console.error('useWaterfallData: Error fetching date bounds:', err);
                if (cancelled) return;
                // Fall back to the device's current date so the price-fetch effect
                // below isn't blocked forever waiting on bounds that failed to
                // load (a transient network/timeout error here must not leave the
                // dashboard spinner stuck indefinitely with no error shown).
                const today = new Date();
                setServerDateBounds({ min: null, max: today, minKey: null, maxKey: localDateToKey(today), resolved: true });
            }
        };
        fetchDateBounds();
        return () => { cancelled = true; };
    }, [filters.commodity, filters.district]);

    // ── Fetch price data ──
    useEffect(() => {
        // For the presets, anchor the lookback on the commodity's latest report
        // rather than the device's date — many commodities report infrequently.
        // Wait for serverDateBounds to resolve (cleared above on every
        // commodity/district change) so we never query a stale prior
        // commodity's window. `resolved` (not `max`) also lets a commodity with
        // zero rows fetch and land on "No data available" instead of spinning.
        if (!isCustom && !serverDateBounds.resolved) return;
        let cancelled = false;

        const fetchPrices = async () => {
            setLoading(true);
            setError(null);
            try {
                const apiFilters = { commodity: filters.commodity, district: filters.district };
                let result;
                if (isCustom && customStartKey && customEndKey) {
                    result = await fetchRangeEntries(apiFilters, customStartKey, customEndKey);
                } else {
                    // maxKey is null when bounds resolved but found zero rows —
                    // fall back to today so the query runs (and returns empty).
                    const endKey = serverDateBounds.maxKey || localDateToKey(new Date());
                    const startKey = addDaysToKey(endKey, -PRESET_WINDOW_DAYS);
                    const rows = await getPricesByDateRange(apiFilters, startKey, endKey);
                    result = { rows, entries: rowsToEntries(rows), usesMonthly: false };
                }
                // A newer range/commodity was requested while this one was in
                // flight — don't let the slower, stale response overwrite it.
                if (cancelled) return;

                setEntries(result.entries);
                setUsesMonthly(result.usesMonthly);
                const latestNote = result.rows.find(d => d.market_tone_comments && d.market_tone_comments.trim());
                setMarketNotes(latestNote ? latestNote.market_tone_comments : '');
            } catch (err) {
                if (cancelled) return;
                console.error('useWaterfallData: Error fetching prices:', err);
                setError(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchPrices();
        return () => { cancelled = true; };
    }, [filters.commodity, filters.district, fetchRangeKey, serverDateBounds.resolved]);

    // ── Entries per market type, then organic / top-level variety applied ──
    const baseByMarket = useMemo(() => {
        const out = { terminal: [], shipping: [], retail: [] };
        for (const e of entries) {
            if (organicOnly && e.organic !== 'yes') continue;
            if (selectedVariety && e.variety !== selectedVariety) continue;
            out[e.market].push(e);
        }
        return out;
    }, [entries, organicOnly, selectedVariety]);

    // ── Cascading sub-filter options ──
    // Each dimension's options come from rows matching the *other* selections.
    const subFilterOptions = useMemo(() => {
        const out = {};
        for (const m of MARKET_TYPES) {
            const base = baseByMarket[m];
            const pkg = selectedPackages[m];
            const org = selectedOrigins[m];
            const dist = selectedDistricts[m];
            const vrty = selectedVarieties[m];
            const matching = (skip) => base.filter(d =>
                (skip === 'package' || !pkg || d.package === pkg) &&
                (skip === 'origin' || !org || d.origin === org) &&
                (skip === 'district' || !dist || d.district === dist) &&
                (skip === 'variety' || !vrty || d.variety === vrty));
            out[m] = {
                packages: getUnique(matching('package'), 'package'),
                // The monthly rollup has no origin, so neither does a range built from it.
                origins: usesMonthly ? [] : getUnique(matching('origin'), 'origin'),
                districts: getUnique(matching('district'), 'district'),
                varieties: getUnique(matching('variety'), 'variety'),
            };
        }
        return out;
    }, [baseByMarket, usesMonthly, selectedPackages, selectedOrigins, selectedDistricts, selectedVarieties]);

    // Drop selections that no longer match any data. Packages default to "All".
    useEffect(() => {
        const sync = (setter, key) => setter(prev => {
            const next = {};
            for (const m of MARKET_TYPES) next[m] = validate(subFilterOptions[m][key], prev[m]);
            return MARKET_TYPES.every(m => next[m] === prev[m]) ? prev : next;
        });
        sync(setSelectedPackages, 'packages');
        sync(setSelectedOrigins, 'origins');
        sync(setSelectedDistricts, 'districts');
        sync(setSelectedVarieties, 'varieties');
    }, [subFilterOptions]);

    // ── Stats ──
    const stats = useMemo(() => {
        if (!entries.length) return null;

        // Current vs prior period. All comparisons use 'YYYY-MM-DD' keys.
        const partition = (data) => {
            if (!data.length) return { current: [], prior: [] };
            // The fetch already covers exactly the chosen custom range, so
            // average all of it. (There is no prior period to compare against.)
            if (timeRange === 'custom') return { current: data, prior: [] };

            const between = (from, to) => data.filter(e => e.date >= from && e.date <= to);
            const uniqueDates = [...new Set(data.map(e => e.date))].sort().reverse();

            if (timeRange === 'daily') {
                // Most recent report day vs the report day before it
                const [currentDay, priorDay] = uniqueDates;
                return {
                    current: between(currentDay, currentDay),
                    prior: priorDay ? between(priorDay, priorDay) : [],
                };
            }

            // 7day/30day: the N days ending on the latest report day, vs the
            // N days ending on the last report day before that period.
            const daysOffset = (timeRange === '7day' ? 7 : 30) - 1;
            const maxKey = uniqueDates[0];
            const currentStartKey = addDaysToKey(maxKey, -daysOffset);
            const current = between(currentStartKey, maxKey);
            const priorMaxKey = uniqueDates.find(k => k < currentStartKey);
            if (!priorMaxKey) return { current, prior: [] };
            return { current, prior: between(addDaysToKey(priorMaxKey, -daysOffset), priorMaxKey) };
        };

        // CPI-adjust each price to current dollars (custom ranges only)
        const factorFor = cpiAdjusted ? (e => adjustToCurrent(1, e.date)) : null;

        const markets = {};
        const allCurrent = [];
        for (const m of MARKET_TYPES) {
            const filtered = baseByMarket[m].filter(d =>
                (!selectedPackages[m] || d.package === selectedPackages[m]) &&
                (!selectedOrigins[m] || d.origin === selectedOrigins[m]) &&
                (!selectedDistricts[m] || d.district === selectedDistricts[m]) &&
                (!selectedVarieties[m] || d.variety === selectedVarieties[m]));
            const { current, prior } = partition(filtered);
            const priorByKey = new Map(groupPrices(prior, factorFor).map(g => [g.key, g]));
            markets[m] = {
                // Each price compares with the same unit (and package, for
                // $/each and $/package) in the prior period.
                groups: groupPrices(current, factorFor).map(g => ({
                    ...g,
                    priorAvg: priorByKey.get(g.key)?.avg ?? null,
                })),
                dateRange: spanOf(current),
                priorDateRange: spanOf(prior),
                reportCount: current.reduce((s, e) => s + e.rows, 0),
            };
            allCurrent.push(...current);
        }

        return {
            timeRange,
            markets,
            usesMonthly,
            overallDateRange: spanOf(allCurrent),
        };
    }, [
        entries, baseByMarket, usesMonthly, timeRange, cpiAdjusted,
        selectedPackages, selectedOrigins, selectedDistricts, selectedVarieties,
    ]);

    const varietyOptions = useMemo(() => getUnique(entries, 'variety'), [entries]);
    const hasOrganicData = useMemo(() => entries.some(e => e.organic === 'yes'), [entries]);
    const optionsFor = (key) => ({
        terminal: subFilterOptions.terminal[key],
        shipping: subFilterOptions.shipping[key],
        retail: subFilterOptions.retail[key],
    });

    // ── Actions (stable references for prop passing) ──
    const setPackage = useCallback((type, val) => {
        setSelectedPackages(prev => ({ ...prev, [type]: val }));
    }, []);
    const setOrigin = useCallback((type, val) => {
        setSelectedOrigins(prev => ({ ...prev, [type]: val }));
    }, []);
    const setDistrict = useCallback((type, val) => {
        setSelectedDistricts(prev => ({ ...prev, [type]: val }));
    }, []);
    const setVariety = useCallback((type, val) => {
        setSelectedVarieties(prev => ({ ...prev, [type]: val }));
    }, []);

    return {
        // Data
        stats,
        loading,
        error,
        entries,
        marketNotes,
        usesMonthly,

        // Sub-filter options & selections
        packageOptions: optionsFor('packages'),
        selectedPackages,
        originOptions: optionsFor('origins'),
        selectedOrigins,
        districtOptions: optionsFor('districts'),
        selectedDistricts,
        marketVarietyOptions: optionsFor('varieties'),
        selectedVarieties,

        // Top-level filter options
        varietyOptions,
        hasOrganicData,

        // Server date bounds (for custom date picker)
        serverDateBounds,

        // Actions
        actions: {
            selectedPackages,
            setPackage,
            selectedOrigins,
            setOrigin,
            selectedDistricts,
            setDistrict,
            selectedVarieties,
            setVariety,
        },
    };
}
