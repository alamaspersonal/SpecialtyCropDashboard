/**
 * usePriceTimeSeries — Custom Hook
 *
 * Fetches the full price history for a commodity from UnifiedCropPrice,
 * aggregates into monthly averages per market type (Retail, Terminal, Shipping),
 * and provides cascading sub-filter state for package, origin, and variety.
 *
 * Filter options are cascading: selecting a package narrows available origins
 * to only those that have data for that package, and vice versa.
 *
 * Returns chart-ready data series and time-range controls.
 *
 * @param {Object} filters       - { commodity, category, district, organic }
 * @param {Object} options       - { organicOnly, selectedVariety }
 * @returns {Object}
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTimeSeriesData } from '../services/api';

// ── Time range presets ──────────────────────────────────────────
const RANGE_PRESETS = [
    { key: '3M', label: '3M', days: 90 },
    { key: '6M', label: '6M', days: 180 },
    { key: '1Y', label: '1Y', days: 365 },
    { key: '2Y', label: '2Y', days: 730 },
    { key: 'All', label: 'All', days: Infinity },
];

// ── Helpers ─────────────────────────────────────────────────────

function getUnique(arr, field) {
    return [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();
}

/**
 * Aggregate raw rows into monthly averages per market type.
 * Each output item: { date: 'YYYY-MM', price: number }
 */
function aggregateMonthlyAverages(rows) {
    const byMonth = {};
    for (const row of rows) {
        if (!row.report_date || row.price_avg == null) continue;
        const dateKey = row.report_date.split('T')[0];
        const monthKey = dateKey.substring(0, 7); // 'YYYY-MM'
        if (!byMonth[monthKey]) byMonth[monthKey] = { sum: 0, count: 0 };
        byMonth[monthKey].sum += row.price_avg;
        byMonth[monthKey].count += 1;
    }
    return Object.entries(byMonth)
        .map(([date, { sum, count }]) => ({
            date,
            price: Math.round((sum / count) * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function classifyMarketType(mt) {
    if (!mt) return null;
    const lower = mt.toLowerCase();
    if (lower.includes('retail')) return 'retail';
    if (lower.includes('terminal')) return 'terminal';
    if (lower.includes('shipping')) return 'shipping';
    return null;
}

export default function usePriceTimeSeries(filters, options = {}) {
    const {
        organicOnly = false,
        selectedVariety = '',
    } = options;

    // ── Raw data ──
    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ── Sub-filter state ──
    const [selectedPackage, setSelectedPackage] = useState('');
    const [selectedOrigin, setSelectedOrigin] = useState('');

    // ── Time range ──
    const [selectedRange, setSelectedRange] = useState('3M');

    // ── Fetch all data for commodity ──
    useEffect(() => {
        const fetchData = async () => {
            if (!filters.commodity) {
                setRawData([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const data = await getTimeSeriesData(filters.commodity, {
                    district: filters.district || '',
                });
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

    // ── Reset sub-filters when raw data changes ──
    useEffect(() => {
        setSelectedPackage('');
        setSelectedOrigin('');
    }, [filters.commodity]);

    // ── Compute date span for conditional preset visibility ──
    // MUST be before timeFilteredData since it depends on dateSpan.max
    const dateSpan = useMemo(() => {
        if (!rawData.length) return { min: null, max: null, spanDays: 0 };
        const dates = rawData
            .map(d => d.report_date?.split('T')[0])
            .filter(Boolean)
            .sort();
        if (dates.length === 0) return { min: null, max: null, spanDays: 0 };
        const min = dates[0];
        const max = dates[dates.length - 1];
        const spanDays = Math.round(
            (new Date(max) - new Date(min)) / (1000 * 60 * 60 * 24)
        );
        return { min, max, spanDays };
    }, [rawData]);

    // ── Compute time-range-filtered base for filter options ──
    // This ensures filter options only show values that exist within the selected time window
    const timeFilteredData = useMemo(() => {
        if (!rawData.length) return [];

        let filtered = rawData;

        // Apply organic + variety (top-level filters)
        if (organicOnly) {
            filtered = filtered.filter(d => d.organic === 'yes');
        }
        if (selectedVariety) {
            filtered = filtered.filter(d => d.variety === selectedVariety);
        }

        // Apply time range cutoff
        if (selectedRange !== 'All' && dateSpan.max) {
            const preset = RANGE_PRESETS.find(p => p.key === selectedRange);
            if (preset && preset.days !== Infinity) {
                const cutoff = new Date(dateSpan.max);
                cutoff.setDate(cutoff.getDate() - preset.days);
                const cutoffStr = cutoff.toISOString().split('T')[0];
                filtered = filtered.filter(d => {
                    const dateKey = d.report_date?.split('T')[0];
                    return dateKey && dateKey >= cutoffStr;
                });
            }
        }

        return filtered;
    }, [rawData, organicOnly, selectedVariety, selectedRange, dateSpan.max]);

    // ── Full filter options (always from rawData — never disappear) ──
    const allOptions = useMemo(() => {
        if (!rawData.length) return { packages: [], origins: [], varieties: [] };
        return {
            packages: getUnique(rawData, 'package'),
            origins: getUnique(rawData, 'origin'),
            varieties: getUnique(rawData, 'variety'),
        };
    }, [rawData]);

    // ── Which options actually have chart data (time-range + cross-filter aware) ──
    const filterOptions = useMemo(() => {
        // Data available for packages: time-filtered + current origin
        const dataForPackages = selectedOrigin
            ? timeFilteredData.filter(d => d.origin === selectedOrigin)
            : timeFilteredData;

        // Data available for origins: time-filtered + current package
        const dataForOrigins = selectedPackage
            ? timeFilteredData.filter(d => d.package === selectedPackage)
            : timeFilteredData;

        return {
            // Full lists (always shown)
            packages: allOptions.packages,
            origins: allOptions.origins,
            varieties: allOptions.varieties,
            // Sets of options that have chart data (for enable/disable)
            packagesWithData: new Set(getUnique(dataForPackages, 'package')),
            originsWithData: new Set(getUnique(dataForOrigins, 'origin')),
        };
    }, [allOptions, timeFilteredData, selectedPackage, selectedOrigin]);

    // ── Auto-clear stale selections (only if option doesn't exist at all) ──
    useEffect(() => {
        if (selectedPackage && !allOptions.packages.includes(selectedPackage)) {
            setSelectedPackage('');
        }
    }, [allOptions.packages, selectedPackage]);

    useEffect(() => {
        if (selectedOrigin && !allOptions.origins.includes(selectedOrigin)) {
            setSelectedOrigin('');
        }
    }, [allOptions.origins, selectedOrigin]);

    // ── Available range presets (only those with enough data) ──
    const availableRanges = useMemo(() => {
        return RANGE_PRESETS.filter(
            preset => preset.key === 'All' || dateSpan.spanDays >= preset.days
        );
    }, [dateSpan.spanDays]);

    // ── If current selection is no longer valid, fall back ──
    useEffect(() => {
        const keys = availableRanges.map(r => r.key);
        if (!keys.includes(selectedRange)) {
            // Pick the first available, or 'All'
            setSelectedRange(keys[0] || 'All');
        }
    }, [availableRanges, selectedRange]);

    // ── Apply filters + time range and aggregate ──
    const series = useMemo(() => {
        if (!rawData.length) return { retail: [], terminal: [], shipping: [] };

        // Step 1: Apply sub-filters
        let filtered = rawData;
        if (organicOnly) {
            filtered = filtered.filter(d => d.organic === 'yes');
        }
        if (selectedVariety) {
            filtered = filtered.filter(d => d.variety === selectedVariety);
        }
        if (selectedPackage) {
            filtered = filtered.filter(d => d.package === selectedPackage);
        }
        if (selectedOrigin) {
            filtered = filtered.filter(d => d.origin === selectedOrigin);
        }

        // Step 2: Apply time range
        if (selectedRange !== 'All' && dateSpan.max) {
            const preset = RANGE_PRESETS.find(p => p.key === selectedRange);
            if (preset && preset.days !== Infinity) {
                const cutoff = new Date(dateSpan.max);
                cutoff.setDate(cutoff.getDate() - preset.days);
                const cutoffStr = cutoff.toISOString().split('T')[0];
                filtered = filtered.filter(d => {
                    const dateKey = d.report_date?.split('T')[0];
                    return dateKey && dateKey >= cutoffStr;
                });
            }
        }

        // Step 3: Partition by market type
        const retail = [];
        const terminal = [];
        const shipping = [];

        for (const row of filtered) {
            const type = classifyMarketType(row.market_type);
            if (type === 'retail') retail.push(row);
            else if (type === 'terminal') terminal.push(row);
            else if (type === 'shipping') shipping.push(row);
        }

        // Step 4: Aggregate into monthly averages
        return {
            retail: aggregateMonthlyAverages(retail),
            terminal: aggregateMonthlyAverages(terminal),
            shipping: aggregateMonthlyAverages(shipping),
        };
    }, [rawData, organicOnly, selectedVariety, selectedPackage, selectedOrigin, selectedRange, dateSpan.max]);

    // ── Actions ──
    const actions = {
        setSelectedPackage: useCallback((val) => setSelectedPackage(val), []),
        setSelectedOrigin: useCallback((val) => setSelectedOrigin(val), []),
        setSelectedRange: useCallback((val) => setSelectedRange(val), []),
    };

    return {
        series,
        loading,
        error,
        rawData,

        // Filter options & current selections
        filterOptions,
        selectedPackage,
        selectedOrigin,

        // Time range
        selectedRange,
        availableRanges,
        dateSpan,

        actions,
    };
}
