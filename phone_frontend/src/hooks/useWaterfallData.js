/**
 * useWaterfallData — Custom Hook
 *
 * Encapsulates the entire data-fetching, partitioning, cascading sub-filter,
 * and stat calculation pipeline that was previously inline in DashboardScreen.
 *
 * Each instance of this hook runs independently — enabling dual-waterfall
 * comparison by calling it twice with different timeRange parameters.
 *
 * @param {Object} filters       - Top-level filters { commodity, category, ... }
 * @param {string} timeRange     - 'daily' | '7day' | '30day' | 'custom'
 * @param {Object} options       - { customStartDate, customEndDate, organicOnly, selectedVariety }
 * @returns {Object} - { stats, loading, priceData, packageOptions, ... actions }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getDateRange, getPricesByDateRange } from '../services/api';

// Package weight lookup
const PACKAGE_WEIGHTS = {
    "25 lb cartons": { weight_lbs: 25, units: null },
    "50 lb cartons": { weight_lbs: 50, units: null },
    "40 lb cartons": { weight_lbs: 40, units: null },
    "30 lb cartons": { weight_lbs: 30, units: null },
    "cartons": { weight_lbs: 25, units: null },
    "bushel cartons": { weight_lbs: 30, units: null },
    "1 1/9 bushel cartons": { weight_lbs: 30, units: null },
    "flats 12 1-pint baskets": { weight_lbs: 12, units: null },
    "flats 8 1-lb containers": { weight_lbs: 8, units: null },
    "cartons 2 layer": { weight_lbs: 25, units: null },
    "4 count mesh bags": { weight_lbs: null, units: 4 },
    "5 count mesh bags": { weight_lbs: null, units: 5 },
    "3 count mesh bags": { weight_lbs: null, units: 3 },
    "3 count filmbag": { weight_lbs: null, units: 3 },
    "6 ct trays filmwrapped": { weight_lbs: null, units: 6 },
    "each": { weight_lbs: null, units: 1 },
    "per each": { weight_lbs: null, units: 1 },
};

function lookupWeight(pkg) {
    if (!pkg) return null;
    if (PACKAGE_WEIGHTS[pkg]) return PACKAGE_WEIGHTS[pkg];
    for (const [key, val] of Object.entries(PACKAGE_WEIGHTS)) {
        if (pkg.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(pkg.toLowerCase())) {
            return val;
        }
    }
    const match = pkg.match(/(\d+)\s*(?:lb|lbs)/i);
    if (match) return { weight_lbs: parseInt(match[1]), units: null };
    return null;
}

function getUnique(arr, field) {
    return [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();
}

export default function useWaterfallData(filters, timeRange, options = {}) {
    const {
        customStartDate = null,
        customEndDate = null,
        organicOnly = false,
        selectedVariety = '',
    } = options;

    // ── Data State ──
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Partitioned data
    const [terminalData, setTerminalData] = useState([]);
    const [shippingData, setShippingData] = useState([]);
    const [retailData, setRetailData] = useState([]);

    // Variety options extracted from data
    const [varietyOptions, setVarietyOptions] = useState([]);
    const [hasOrganicData, setHasOrganicData] = useState(false);

    // Sub-filter state (per market type)
    const [packageOptions, setPackageOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedPackages, setSelectedPackages] = useState({ terminal: '', shipping: '', retail: '' });
    const [originOptions, setOriginOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedOrigins, setSelectedOrigins] = useState({ terminal: '', shipping: '', retail: '' });
    const [districtOptions, setDistrictOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedDistricts, setSelectedDistricts] = useState({ terminal: '', shipping: '', retail: '' });
    const [weightData, setWeightData] = useState({ terminal: null, shipping: null, retail: null });

    // Server-side date bounds
    const [serverDateBounds, setServerDateBounds] = useState({ min: null, max: null });

    // Market notes
    const [marketNotes, setMarketNotes] = useState('');

    // ── Fetch date bounds ──
    useEffect(() => {
        const fetchDateBounds = async () => {
            try {
                const apiFilters = { ...filters };
                delete apiFilters.date;
                delete apiFilters.package;
                delete apiFilters.variety;
                delete apiFilters.category;
                const bounds = await getDateRange(apiFilters);
                setServerDateBounds({
                    min: bounds.minDate ? new Date(bounds.minDate) : null,
                    max: bounds.maxDate ? new Date(bounds.maxDate) : null,
                });
            } catch (err) {
                console.error('useWaterfallData: Error fetching date bounds:', err);
            }
        };
        fetchDateBounds();
    }, [JSON.stringify(filters)]);

    // ── Fetch price data ──
    useEffect(() => {
        const fetchPrices = async () => {
            setLoading(true);
            setError(null);
            try {
                const apiFilters = { ...filters };
                delete apiFilters.date;
                delete apiFilters.package;
                delete apiFilters.variety;
                delete apiFilters.category;

                let data;

                if (timeRange === 'custom' && customStartDate && customEndDate) {
                    const startISO = customStartDate.toISOString().split('T')[0];
                    const endISO = customEndDate.toISOString().split('T')[0];
                    data = await getPricesByDateRange(apiFilters, startISO, endISO);
                } else {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 90);
                    const startISO = startDate.toISOString().split('T')[0];
                    const endISO = endDate.toISOString().split('T')[0];
                    data = await getPricesByDateRange(apiFilters, startISO, endISO);
                }

                setPriceData(data);

                // Partition by market type
                const tData = data.filter(d => d.market_type === 'Terminal' || !d.market_type);
                const sData = data.filter(d => d.market_type === 'Shipping' || d.market_type === 'Shipping Point');
                const rData = data.filter(d => d.market_type === 'Retail' || d.market_type === 'Retail - Specialty Crops');

                setTerminalData(tData);
                setShippingData(sData);
                setRetailData(rData);

                // Extract varieties
                const allVarieties = [...new Set(data.map(d => d.variety).filter(Boolean))].sort();
                setVarietyOptions(allVarieties);
                setHasOrganicData(false);

                // Extract initial package options
                setPackageOptions({
                    terminal: getUnique(tData, 'package'),
                    shipping: getUnique(sData, 'package'),
                    retail: getUnique(rData, 'package'),
                });

                setOriginOptions({
                    terminal: getUnique(tData, 'origin'),
                    shipping: getUnique(sData, 'origin'),
                    retail: getUnique(rData, 'origin'),
                });

                setDistrictOptions({
                    terminal: getUnique(tData, 'district'),
                    shipping: getUnique(sData, 'district'),
                    retail: getUnique(rData, 'district'),
                });

                // Preserve or default packages
                setSelectedPackages(prev => ({
                    terminal: getUnique(tData, 'package').includes(prev.terminal) ? prev.terminal : (getUnique(tData, 'package')[0] || ''),
                    shipping: getUnique(sData, 'package').includes(prev.shipping) ? prev.shipping : (getUnique(sData, 'package')[0] || ''),
                    retail: getUnique(rData, 'package').includes(prev.retail) ? prev.retail : (getUnique(rData, 'package')[0] || ''),
                }));

                if (data.length > 0 && data[0].market_tone_comments) {
                    setMarketNotes(data[0].market_tone_comments);
                } else {
                    setMarketNotes('');
                }
            } catch (err) {
                console.error('useWaterfallData: Error fetching prices:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        fetchPrices();
    }, [JSON.stringify(filters), timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()]);

    // ── Cascading filter logic ──
    useEffect(() => {
        if (!terminalData.length && !shippingData.length && !retailData.length) return;

        const getBaseData = (data) => {
            let filtered = data;
            if (organicOnly) {
                filtered = filtered.filter(d => d.organic === 'yes');
            }
            if (selectedVariety) {
                filtered = filtered.filter(d => d.variety === selectedVariety);
            }
            return filtered;
        };

        const tBase = getBaseData(terminalData);
        const sBase = getBaseData(shippingData);
        const rBase = getBaseData(retailData);

        const getOptionsForType = (baseData, currentPkg, currentOrg, currentDist) => {
            const pkgData = baseData.filter(d =>
                (!currentOrg || d.origin === currentOrg) &&
                (!currentDist || d.district === currentDist)
            );
            const orgData = baseData.filter(d =>
                (!currentPkg || d.package === currentPkg) &&
                (!currentDist || d.district === currentDist)
            );
            const distData = baseData.filter(d =>
                (!currentPkg || d.package === currentPkg) &&
                (!currentOrg || d.origin === currentOrg)
            );
            return {
                packages: getUnique(pkgData, 'package'),
                origins: getUnique(orgData, 'origin'),
                districts: getUnique(distData, 'district'),
            };
        };

        const tOpts = getOptionsForType(tBase, selectedPackages.terminal, selectedOrigins.terminal, selectedDistricts.terminal);
        const sOpts = getOptionsForType(sBase, selectedPackages.shipping, selectedOrigins.shipping, selectedDistricts.shipping);
        const rOpts = getOptionsForType(rBase, selectedPackages.retail, selectedOrigins.retail, selectedDistricts.retail);

        const newPkgOpts = { terminal: tOpts.packages, shipping: sOpts.packages, retail: rOpts.packages };
        setPackageOptions(prev => JSON.stringify(prev) === JSON.stringify(newPkgOpts) ? prev : newPkgOpts);

        const newOrgOpts = { terminal: tOpts.origins, shipping: sOpts.origins, retail: rOpts.origins };
        setOriginOptions(prev => JSON.stringify(prev) === JSON.stringify(newOrgOpts) ? prev : newOrgOpts);

        const newDistOpts = { terminal: tOpts.districts, shipping: sOpts.districts, retail: rOpts.districts };
        setDistrictOptions(prev => JSON.stringify(prev) === JSON.stringify(newDistOpts) ? prev : newDistOpts);

        const validate = (options, currentVal) => {
            if (options.length === 0) return '';
            if (options.length === 1) return options[0];
            if (options.includes(currentVal)) return currentVal;
            return '';
        };

        setSelectedPackages(prev => {
            const next = {
                terminal: validate(tOpts.packages, prev.terminal),
                shipping: validate(sOpts.packages, prev.shipping),
                retail: validate(rOpts.packages, prev.retail),
            };
            return (prev.terminal === next.terminal && prev.shipping === next.shipping && prev.retail === next.retail) ? prev : next;
        });

        setSelectedOrigins(prev => {
            const next = {
                terminal: validate(tOpts.origins, prev.terminal),
                shipping: validate(sOpts.origins, prev.shipping),
                retail: validate(rOpts.origins, prev.retail),
            };
            return (prev.terminal === next.terminal && prev.shipping === next.shipping && prev.retail === next.retail) ? prev : next;
        });

        setSelectedDistricts(prev => {
            const next = {
                terminal: validate(tOpts.districts, prev.terminal),
                shipping: validate(sOpts.districts, prev.shipping),
                retail: validate(rOpts.districts, prev.retail),
            };
            return (prev.terminal === next.terminal && prev.shipping === next.shipping && prev.retail === next.retail) ? prev : next;
        });
    }, [
        selectedVariety, organicOnly,
        terminalData, shippingData, retailData,
        selectedPackages, selectedOrigins, selectedDistricts,
    ]);

    // ── Update weight data ──
    useEffect(() => {
        setWeightData({
            terminal: lookupWeight(selectedPackages.terminal),
            shipping: lookupWeight(selectedPackages.shipping),
            retail: lookupWeight(selectedPackages.retail),
        });
    }, [selectedPackages]);

    // ── Calculate stats ──
    const calculateStats = useCallback(() => {
        if (!priceData.length) return null;

        const filterByTimeRange = (data) => {
            const dates = data.map(d => new Date(d.report_date)).filter(d => !isNaN(d));
            if (dates.length === 0) return data;
            const maxDate = new Date(Math.max(...dates));

            if (timeRange === 'custom') {
                const start = new Date(customStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return !isNaN(itemDate) && itemDate >= start && itemDate <= end;
                });
            } else if (timeRange === 'daily') {
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return itemDate.toDateString() === maxDate.toDateString();
                });
            } else {
                const days = timeRange === '7day' ? 7 : 30;
                const cutoff = new Date(maxDate);
                cutoff.setDate(cutoff.getDate() - days);
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return !isNaN(itemDate) && itemDate >= cutoff;
                });
            }
        };

        const filterByPriorTimeRange = (data) => {
            const dates = data.map(d => new Date(d.report_date)).filter(d => !isNaN(d));
            if (dates.length === 0) return [];
            const maxDate = new Date(Math.max(...dates));

            if (timeRange === 'custom') {
                return [];
            } else if (timeRange === 'daily') {
                const previousDates = dates.filter(d => d.toDateString() !== maxDate.toDateString());
                if (previousDates.length === 0) return [];
                const priorMaxDate = new Date(Math.max(...previousDates));
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return itemDate.toDateString() === priorMaxDate.toDateString();
                });
            } else {
                const days = timeRange === '7day' ? 7 : 30;
                let currentStart = new Date(maxDate);
                currentStart.setDate(currentStart.getDate() - days);
                currentStart.setHours(0,0,0,0);
                
                const previousDates = dates.filter(d => {
                    let itemDate = new Date(d);
                    itemDate.setHours(0,0,0,0);
                    return itemDate < currentStart;
                });
                
                if (previousDates.length === 0) return [];
                const priorMaxDate = new Date(Math.max(...previousDates));
                
                let priorStart = new Date(priorMaxDate);
                priorStart.setDate(priorStart.getDate() - days);
                priorStart.setHours(0,0,0,0);
                
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    if (isNaN(itemDate)) return false;
                    itemDate.setHours(0,0,0,0);
                    return itemDate >= priorStart && itemDate <= priorMaxDate;
                });
            }
        };

        let baseTerminal = terminalData;
        let baseShipping = shippingData;
        let baseRetail = retailData;

        if (organicOnly) {
            baseTerminal = baseTerminal.filter(d => d.organic === 'yes');
            baseShipping = baseShipping.filter(d => d.organic === 'yes');
            baseRetail = baseRetail.filter(d => d.organic === 'yes');
        }

        if (selectedVariety) {
            baseTerminal = baseTerminal.filter(d => d.variety === selectedVariety);
            baseShipping = baseShipping.filter(d => d.variety === selectedVariety);
            baseRetail = baseRetail.filter(d => d.variety === selectedVariety);
        }

        const filteredTerminal = filterByTimeRange(baseTerminal);
        const filteredShipping = filterByTimeRange(baseShipping);
        const filteredRetail = filterByTimeRange(baseRetail);

        const priorFilteredTerminal = filterByPriorTimeRange(baseTerminal);
        const priorFilteredShipping = filterByPriorTimeRange(baseShipping);
        const priorFilteredRetail = filterByPriorTimeRange(baseRetail);

        const filterData = (data, type) => {
            let filtered = data;
            if (selectedPackages[type]) filtered = filtered.filter(d => d.package === selectedPackages[type]);
            if (selectedOrigins[type]) filtered = filtered.filter(d => d.origin === selectedOrigins[type]);
            if (selectedDistricts[type]) filtered = filtered.filter(d => d.district === selectedDistricts[type]);
            return filtered;
        };

        const calcAvgPrice = (data) => {
            if (!data.length) return 0;
            const validValues = data.map(d => parseFloat(d.price_avg)).filter(v => v !== null && v !== undefined && !isNaN(v));
            if (validValues.length === 0) return 0;
            return validValues.reduce((a, b) => a + b, 0) / validValues.length;
        };

        const terminalFiltered = filterData(filteredTerminal, 'terminal');
        const shippingFiltered = filterData(filteredShipping, 'shipping');
        const retailFiltered = filterData(filteredRetail, 'retail');

        const priorTerminalFiltered = filterData(priorFilteredTerminal, 'terminal');
        const priorShippingFiltered = filterData(priorFilteredShipping, 'shipping');
        const priorRetailFiltered = filterData(priorFilteredRetail, 'retail');

        const getDateRangeFromData = (data) => {
            const dates = data.map(d => d.report_date).filter(Boolean).sort();
            if (dates.length === 0) return null;
            return { start: dates[0], end: dates[dates.length - 1] };
        };

        const dateRanges = {
            terminal: getDateRangeFromData(terminalFiltered),
            shipping: getDateRangeFromData(shippingFiltered),
            retail: getDateRangeFromData(retailFiltered),
        };
        const priorDateRanges = {
            terminal: getDateRangeFromData(priorTerminalFiltered),
            shipping: getDateRangeFromData(priorShippingFiltered),
            retail: getDateRangeFromData(priorRetailFiltered),
        };
        const reportCounts = {
            terminal: terminalFiltered.length,
            shipping: shippingFiltered.length,
            retail: retailFiltered.length,
        };

        const allDates = [...terminalFiltered, ...shippingFiltered, ...retailFiltered]
            .map(d => d.report_date).filter(Boolean).sort();
        const overallDateRange = allDates.length > 0
            ? { start: allDates[0], end: allDates[allDates.length - 1] }
            : null;

        return {
            terminal_avg: calcAvgPrice(terminalFiltered),
            shipping_avg: calcAvgPrice(shippingFiltered),
            retail_avg: calcAvgPrice(retailFiltered),
            prior_terminal_avg: calcAvgPrice(priorTerminalFiltered),
            prior_shipping_avg: calcAvgPrice(priorShippingFiltered),
            prior_retail_avg: calcAvgPrice(priorRetailFiltered),
            is_shipping_estimated: false,
            is_retail_estimated: false,
            timeRange,
            dateRanges,
            priorDateRanges,
            reportCounts,
            overallDateRange,
        };
    }, [
        priceData, terminalData, shippingData, retailData,
        timeRange, customStartDate, customEndDate,
        organicOnly, selectedVariety,
        selectedPackages, selectedOrigins, selectedDistricts,
    ]);

    const stats = calculateStats();

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

    return {
        // Data
        stats,
        loading,
        error,
        priceData,
        marketNotes,

        // Partitioned data (for AI insights)
        terminalData,
        shippingData,
        retailData,

        // Sub-filter options & selections
        packageOptions,
        selectedPackages,
        originOptions,
        selectedOrigins,
        districtOptions,
        selectedDistricts,
        weightData,

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
        },
    };
}
