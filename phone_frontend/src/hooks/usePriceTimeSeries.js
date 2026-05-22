import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTimeSeriesData, getPricesByDateRange } from '../services/api';
import { adjustToCurrent } from '../shared/cpiAdjust';

// ── Time range presets ──────────────────────────────────────────
const RANGE_PRESETS = [
    { key: '3M', label: '3M', days: 90 },
    { key: '6M', label: '6M', days: 180 },
    { key: '1Y', label: '1Y', days: 365 },
    { key: '2Y', label: '2Y', days: 730 },
    { key: 'All', label: 'All', days: Infinity },
];

const MARKET_TYPES = ['retail', 'terminal', 'shipping'];
const EMPTY_TYPE_STATE = { retail: '', terminal: '', shipping: '' };

// ── Helpers ─────────────────────────────────────────────────────

function getUnique(arr, field) {
    return [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();
}

const PACKAGE_WEIGHTS = {
    '25 lb cartons': { weight_lbs: 25, units: null },
    '50 lb cartons': { weight_lbs: 50, units: null },
    '40 lb cartons': { weight_lbs: 40, units: null },
    '30 lb cartons': { weight_lbs: 30, units: null },
    'cartons': { weight_lbs: 25, units: null },
    'bushel cartons': { weight_lbs: 30, units: null },
    '1 1/9 bushel cartons': { weight_lbs: 30, units: null },
    'flats 12 1-pint baskets': { weight_lbs: 12, units: null },
    'flats 8 1-lb containers': { weight_lbs: 8, units: null },
    'cartons 2 layer': { weight_lbs: 25, units: null },
    '4 count mesh bags': { weight_lbs: null, units: 4 },
    '5 count mesh bags': { weight_lbs: null, units: 5 },
    '3 count mesh bags': { weight_lbs: null, units: 3 },
    '3 count filmbag': { weight_lbs: null, units: 3 },
    '6 ct trays filmwrapped': { weight_lbs: null, units: 6 },
    'each': { weight_lbs: null, units: 1 },
    'per each': { weight_lbs: null, units: 1 },
    'per lb': { weight_lbs: 1, units: null },
};

function lookupWeight(pkg) {
    if (!pkg) return null;
    const lower = pkg.toLowerCase().trim();
    for (const [key, val] of Object.entries(PACKAGE_WEIGHTS)) {
        if (lower === key || lower.includes(key)) return val;
    }
    const match = pkg.match(/(\d+)\s*(?:lb|lbs)/i);
    if (match) return { weight_lbs: parseInt(match[1]), units: null };
    return null;
}

function classifyMarketType(mt) {
    if (!mt) return null;
    const lower = mt.toLowerCase();
    if (lower.includes('retail')) return 'retail';
    if (lower.includes('terminal')) return 'terminal';
    if (lower.includes('shipping')) return 'shipping';
    return null;
}

/**
 * Aggregate rows into daily averages, normalizing each row to price/lb or
 * price/unit where the package weight is known.
 */
function aggregateDailyAverages(rows) {
    const byDay = {};
    let totalLb = 0, totalUnit = 0;

    for (const row of rows) {
        if (!row.report_date || row.price_avg == null) continue;
        const dayKey = row.report_date.split('T')[0];
        if (!byDay[dayKey]) {
            byDay[dayKey] = { sum: 0, count: 0, packages: {}, origins: {}, varieties: {} };
        }

        const weight = lookupWeight(row.package);
        let normalizedPrice;
        if (weight?.weight_lbs > 0) {
            normalizedPrice = row.price_avg / weight.weight_lbs;
            totalLb++;
        } else if (weight?.units > 0) {
            normalizedPrice = row.price_avg / weight.units;
            totalUnit++;
        } else {
            normalizedPrice = row.price_avg;
        }

        byDay[dayKey].sum += normalizedPrice;
        byDay[dayKey].count += 1;

        const pkg = row.package || 'Unknown';
        const org = row.origin || 'Unknown';
        const v   = row.variety || 'Unknown';
        byDay[dayKey].packages[pkg] = (byDay[dayKey].packages[pkg] || 0) + 1;
        byDay[dayKey].origins[org]  = (byDay[dayKey].origins[org]  || 0) + 1;
        byDay[dayKey].varieties[v]  = (byDay[dayKey].varieties[v]  || 0) + 1;
    }

    let seriesUnit = 'package';
    if (totalLb > 0 && totalLb >= totalUnit) seriesUnit = 'lb';
    else if (totalUnit > 0) seriesUnit = 'unit';

    const points = Object.entries(byDay)
        .map(([date, data]) => ({
            date,
            price: Math.round((data.sum / data.count) * 100) / 100,
            pointCount: data.count,
            packagesCount: data.packages,
            originsCount: data.origins,
            varietiesCount: data.varieties,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return { points, seriesUnit };
}

// ── Hook ────────────────────────────────────────────────────────

export default function usePriceTimeSeries(filters, options = {}) {
    const {
        organicOnly = false,
        selectedVariety = '',
        cpiAdjusted = false,
    } = options;

    const [rawData, setRawData] = useState([]);
    const [filterData, setFilterData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Per-market-type sub-filter state
    const [selectedVarieties, setSelectedVarieties] = useState(EMPTY_TYPE_STATE);
    const [selectedPackages,  setSelectedPackages]  = useState(EMPTY_TYPE_STATE);
    const [selectedOrigins,   setSelectedOrigins]   = useState(EMPTY_TYPE_STATE);

    const [selectedRange, setSelectedRange] = useState('3M');

    // ── Fetch ──
    useEffect(() => {
        const fetchData = async () => {
            if (!filters.commodity) { setRawData([]); setLoading(false); return; }
            setLoading(true);
            setError(null);
            try {
                const data = await getTimeSeriesData(filters.commodity, { district: filters.district || '' });
                setRawData(data);
            } catch (err) {
                console.error('usePriceTimeSeries: fetch error', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters.commodity, filters.district]);

    // ── Fetch recent data for filter options (same source as waterfall) ──
    useEffect(() => {
        const fetchFilterData = async () => {
            if (!filters.commodity) { setFilterData([]); return; }
            try {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 90);
                const data = await getPricesByDateRange(
                    { commodity: filters.commodity, district: filters.district || '' },
                    start.toISOString().split('T')[0],
                    end.toISOString().split('T')[0],
                );
                setFilterData(data);
            } catch (err) {
                console.error('usePriceTimeSeries: error fetching filter data', err);
            }
        };
        fetchFilterData();
    }, [filters.commodity, filters.district]);

    // Reset per-type filters on commodity change
    useEffect(() => {
        setSelectedVarieties(EMPTY_TYPE_STATE);
        setSelectedPackages(EMPTY_TYPE_STATE);
        setSelectedOrigins(EMPTY_TYPE_STATE);
    }, [filters.commodity]);

    // ── Date span ──
    const dateSpan = useMemo(() => {
        if (!rawData.length) return { min: null, max: null, spanDays: 0 };
        const dates = rawData.map(d => d.report_date?.split('T')[0]).filter(Boolean).sort();
        if (!dates.length) return { min: null, max: null, spanDays: 0 };
        const min = dates[0], max = dates[dates.length - 1];
        const spanDays = Math.round((new Date(max) - new Date(min)) / (1000 * 60 * 60 * 24));
        return { min, max, spanDays };
    }, [rawData]);

    // ── Base data: organic + variety + time range applied, then partitioned ──
    const timePartitioned = useMemo(() => {
        const result = { retail: [], terminal: [], shipping: [] };
        if (!rawData.length) return result;

        let filtered = rawData;
        if (organicOnly) filtered = filtered.filter(d => d.organic === 'yes');

        if (selectedRange !== 'All' && dateSpan.max) {
            const preset = RANGE_PRESETS.find(p => p.key === selectedRange);
            if (preset?.days !== Infinity) {
                const cutoff = new Date(dateSpan.max);
                cutoff.setDate(cutoff.getDate() - preset.days);
                const cutoffStr = cutoff.toISOString().split('T')[0];
                filtered = filtered.filter(d => {
                    const dk = d.report_date?.split('T')[0];
                    return dk && dk >= cutoffStr;
                });
            }
        }

        for (const row of filtered) {
            const type = classifyMarketType(row.market_type);
            if (type) result[type].push(row);
        }
        return result;
    }, [rawData, organicOnly, selectedRange, dateSpan.max]);

    // ── Partition recent data for filter options ──
    const filterPartitioned = useMemo(() => {
        const result = { retail: [], terminal: [], shipping: [] };
        let data = filterData;
        if (organicOnly) data = data.filter(d => d.organic === 'yes');
        for (const row of data) {
            const type = classifyMarketType(row.market_type);
            if (type) result[type].push(row);
        }
        return result;
    }, [filterData, organicOnly]);

    // ── Per-type filter options (cascading within each market type) ──
    const filterOptions = useMemo(() => {
        const opts = {};
        for (const type of MARKET_TYPES) {
            const typeData = filterPartitioned[type];
            const pkg  = selectedPackages[type];
            const org  = selectedOrigins[type];
            const vrty = selectedVarieties[type];

            // For each dimension, filter by the OTHER two selections to determine
            // which values would still yield data (used to grey out unavailable options)
            const forVarieties = typeData.filter(d =>
                (!pkg  || d.package === pkg) &&
                (!org  || d.origin  === org)
            );
            const forPackages = typeData.filter(d =>
                (!vrty || d.variety === vrty) &&
                (!org  || d.origin  === org)
            );
            const forOrigins = typeData.filter(d =>
                (!vrty || d.variety === vrty) &&
                (!pkg  || d.package === pkg)
            );

            opts[type] = {
                varieties: getUnique(typeData, 'variety'),
                packages:  getUnique(typeData, 'package'),
                origins:   getUnique(typeData, 'origin'),
                varietiesWithData: new Set(getUnique(forVarieties, 'variety')),
                packagesWithData:  new Set(getUnique(forPackages,  'package')),
                originsWithData:   new Set(getUnique(forOrigins,   'origin')),
            };
        }
        return opts;
    }, [filterPartitioned, selectedVarieties, selectedPackages, selectedOrigins]);

    // ── Available range presets ──
    const availableRanges = useMemo(() =>
        RANGE_PRESETS.filter(p => p.key === 'All' || dateSpan.spanDays >= p.days),
    [dateSpan.spanDays]);

    useEffect(() => {
        const keys = availableRanges.map(r => r.key);
        if (!keys.includes(selectedRange)) setSelectedRange(keys[0] || 'All');
    }, [availableRanges]); // intentionally omit selectedRange — only reset when available ranges change

    // ── Series: apply per-type package/origin filters after partitioning ──
    const series = useMemo(() => {
        const longRange = selectedRange === '1Y' || selectedRange === '2Y' || selectedRange === 'All';
        const shouldApplyCpi = cpiAdjusted && longRange;

        const applyCpi = (points) => shouldApplyCpi
            ? points.map(p => ({ ...p, price: adjustToCurrent(p.price, p.date) }))
            : points;

        const filterType = (rows, type) => rows
            .filter(d => !selectedVarieties[type] || d.variety === selectedVarieties[type])
            .filter(d => !selectedPackages[type]  || d.package === selectedPackages[type])
            .filter(d => !selectedOrigins[type]   || d.origin  === selectedOrigins[type]);

        const retailResult   = aggregateDailyAverages(filterType(timePartitioned.retail,   'retail'));
        const terminalResult = aggregateDailyAverages(filterType(timePartitioned.terminal, 'terminal'));
        const shippingResult = aggregateDailyAverages(filterType(timePartitioned.shipping, 'shipping'));

        return {
            retail:   applyCpi(retailResult.points),
            terminal: applyCpi(terminalResult.points),
            shipping: applyCpi(shippingResult.points),
            _cpiActive: shouldApplyCpi,
            _units: {
                retail:   retailResult.seriesUnit,
                terminal: terminalResult.seriesUnit,
                shipping: shippingResult.seriesUnit,
            },
        };
    }, [timePartitioned, selectedVarieties, selectedPackages, selectedOrigins, selectedRange, cpiAdjusted]);

    // ── Actions ──
    const actions = {
        setSelectedVariety: useCallback(
            (type, val) => setSelectedVarieties(prev => ({ ...prev, [type]: val })), []),
        setSelectedPackage: useCallback(
            (type, val) => setSelectedPackages(prev => ({ ...prev, [type]: val })), []),
        setSelectedOrigin: useCallback(
            (type, val) => setSelectedOrigins(prev => ({ ...prev, [type]: val })), []),
        setSelectedRange: useCallback((val) => setSelectedRange(val), []),
    };

    return {
        series,
        cpiActive: series._cpiActive ?? false,
        seriesUnit: series._units ?? { retail: 'package', terminal: 'package', shipping: 'package' },
        loading,
        error,
        rawData,

        filterOptions,     // { retail, terminal, shipping } each with varieties/packages/origins/…WithData
        selectedVarieties,
        selectedPackages,
        selectedOrigins,

        selectedRange,
        availableRanges,
        dateSpan,

        actions,
    };
}
