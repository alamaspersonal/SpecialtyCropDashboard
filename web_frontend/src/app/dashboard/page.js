'use client';

/**
 * Dashboard Page — Core analytics view.
 * Displays: price waterfall, bar charts, AI insights, time-range selector,
 * cascading sub-filters, favorites toggle, and cost calculations.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Sparkles, Clock, BarChart3, GitCompare, Filter } from 'lucide-react';
import { getDateRange, getPricesByDateRange } from '../../services/supabaseApi';
import { saveFavorite, removeFavorite, checkIsFavorite } from '../../services/favorites';
import PriceWaterfall from '../../components/PriceWaterfall/PriceWaterfall';
import PriceBarChart from '../../components/PriceBarChart/PriceBarChart';
import ComparisonContainer from '../../components/ComparisonContainer/ComparisonContainer';
import DashboardFilters from '../../components/DashboardFilters/DashboardFilters';
import ExportDropdown from '../../components/ExportDropdown/ExportDropdown';
import PageTransition from '../../components/PageTransition/PageTransition';
import { SkeletonChart, SkeletonText } from '../../components/LoadingSkeleton/LoadingSkeleton';

// Package weight lookup
const PACKAGE_WEIGHTS = {
    "25 lb cartons": { weight_lbs: 25, units: null },
    "50 lb cartons": { weight_lbs: 50, units: null },
    "40 lb cartons": { weight_lbs: 40, units: null },
    "10 lb cartons": { weight_lbs: 10, units: null },
    "20 lb cartons": { weight_lbs: 20, units: null },
    "55 lb sacks": { weight_lbs: 55, units: null },
    "1 1/9 bushel cartons": { weight_lbs: null, units: null },
    "1 lb containers": { weight_lbs: 1, units: null },
    "6 oz containers": { weight_lbs: 0.375, units: null },
    "12 1-pint containers with lids": { weight_lbs: null, units: 12 },
    "1 pint containers": { weight_lbs: null, units: 1 },
    "3 count filmbag": { weight_lbs: null, units: 3 },
    "6 ct trays filmwrapped": { weight_lbs: null, units: 6 },
    "each": { weight_lbs: null, units: 1 },
    "per each": { weight_lbs: null, units: 1 },
};

const TIME_RANGES = [
    { label: 'Last Day', days: 1 },
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
    { label: 'Custom', days: 'custom' },
];

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const commodity = searchParams.get('commodity') || '';
    const category = searchParams.get('category') || '';
    const variety = searchParams.get('variety') || '';
    const district = searchParams.get('district') || '';

    // State
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(30);
    const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
    const [isFavorite, setIsFavorite] = useState(false);

    // Sub-filter state per market type
    const [terminalPkg, setTerminalPkg] = useState('');
    const [shippingPkg, setShippingPkg] = useState('');
    const [retailPkg, setRetailPkg] = useState('');
    const [terminalOrg, setTerminalOrg] = useState('');
    const [shippingOrg, setShippingOrg] = useState('');
    const [retailOrg, setRetailOrg] = useState('');
    const [terminalDist, setTerminalDist] = useState('');
    const [shippingDist, setShippingDist] = useState('');
    const [retailDist, setRetailDist] = useState('');

    // UI State
    const [compareMode, setCompareMode] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Date bounds
    const [dateBounds, setDateBounds] = useState({ minDate: null, maxDate: null });

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!commodity) return;

        // If 'custom' is selected but both dates aren't filled, don't fetch yet
        if (timeRange === 'custom') {
            if (!customDateRange.start || !customDateRange.end) {
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        try {
            const bounds = await getDateRange({ commodity, category, variety });
            setDateBounds(bounds);

            let fetchStart, fetchEnd;

            if (timeRange === 'custom' && customDateRange.start && customDateRange.end) {
                fetchStart = customDateRange.start;
                fetchEnd = customDateRange.end;
                
                // Fetch directly with explicit bounds
                const data = await getPricesByDateRange(
                    { commodity, category, variety },
                    fetchStart,
                    fetchEnd
                );
                setPriceData(data || []);
            } else if (bounds.maxDate) {
                const endDate = new Date(bounds.maxDate);
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - timeRange);

                fetchStart = startDate.toISOString().split('T')[0];
                fetchEnd = endDate.toISOString().split('T')[0];

                const data = await getPricesByDateRange(
                    { commodity, category, variety },
                    fetchStart,
                    fetchEnd
                );
                setPriceData(data || []);
            }
        } catch (e) {
            console.error('Error fetching data:', e);
        }
        setLoading(false);
    }, [commodity, category, variety, timeRange, customDateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Check favorite status
    useEffect(() => {
        if (commodity) {
            setIsFavorite(checkIsFavorite(commodity));
        }
    }, [commodity]);

    // Toggle favorite
    const toggleFavorite = () => {
        if (isFavorite) {
            removeFavorite(commodity);
            setIsFavorite(false);
        } else {
            saveFavorite({ commodity, category, variety });
            setIsFavorite(true);
        }
    };

    // Helper functions
    const getBaseData = (type) => {
        return priceData.filter(d => {
            const mt = (d.market_type || '').toLowerCase();
            if (type === 'terminal') return mt.includes('terminal');
            if (type === 'shipping') return mt.includes('shipping');
            if (type === 'retail') return mt.includes('retail');
            return false;
        });
    };

    const getUnique = (arr, field) => [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();

    const filterData = (data, type) => {
        let filtered = data;
        const pkg = type === 'terminal' ? terminalPkg : type === 'shipping' ? shippingPkg : retailPkg;
        const org = type === 'terminal' ? terminalOrg : type === 'shipping' ? shippingOrg : retailOrg;
        const dist = type === 'terminal' ? terminalDist : type === 'shipping' ? shippingDist : retailDist;

        if (pkg) filtered = filtered.filter(d => d.package === pkg);
        if (org) filtered = filtered.filter(d => d.origin === org);
        if (dist) filtered = filtered.filter(d => d.district === dist);
        return filtered;
    };

    const calcAvgPrice = (data) => {
        const validPrices = data
            .map(d => d.price_avg ?? ((d.low_price || 0) + (d.high_price || 0)) / 2)
            .filter(p => p > 0);
        if (validPrices.length === 0) return null;
        return validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
    };

    const getDateRangeFromData = (data) => {
        if (!data || data.length === 0) return null;
        const dates = data.map(d => d.report_date).filter(Boolean).sort();
        return { start: dates[0], end: dates[dates.length - 1] };
    };

    const lookupWeight = (pkg) => {
        if (!pkg) return { weight_lbs: null, units: null };
        const normalized = pkg.toLowerCase().trim();
        return PACKAGE_WEIGHTS[normalized] || { weight_lbs: null, units: null };
    };

    // Calculate stats for each market type
    const marketTypes = ['terminal', 'shipping', 'retail'];
    const stats = {};
    const packageData = {};
    const originData = {};
    const districtData = {};
    const weightData = {};
    const dateRanges = {};
    const reportCounts = {};
    const filteredDataByType = { terminal: [], shipping: [], retail: [] };

    marketTypes.forEach(type => {
        const base = getBaseData(type);
        const filtered = filterData(base, type);
        filteredDataByType[type] = filtered;

        stats[type] = calcAvgPrice(filtered);
        packageData[type] = {
            options: getUnique(base, 'package'),
            selected: type === 'terminal' ? terminalPkg : type === 'shipping' ? shippingPkg : retailPkg,
        };
        originData[type] = {
            options: getUnique(base, 'origin'),
            selected: type === 'terminal' ? terminalOrg : type === 'shipping' ? shippingOrg : retailOrg,
        };
        districtData[type] = {
            options: getUnique(base, 'district'),
            selected: type === 'terminal' ? terminalDist : type === 'shipping' ? shippingDist : retailDist,
        };

        const selectedPkg = packageData[type].selected;
        weightData[type] = lookupWeight(selectedPkg);
        dateRanges[type] = getDateRangeFromData(filtered);
        reportCounts[type] = filtered.length;
    });

    const actions = {
        setPackage: (type, val) => {
            if (type === 'terminal') setTerminalPkg(val);
            else if (type === 'shipping') setShippingPkg(val);
            else setRetailPkg(val);
        },
        setOrigin: (type, val) => {
            if (type === 'terminal') setTerminalOrg(val);
            else if (type === 'shipping') setShippingOrg(val);
            else setRetailOrg(val);
        },
        setDistrict: (type, val) => {
            if (type === 'terminal') setTerminalDist(val);
            else if (type === 'shipping') setShippingDist(val);
            else setRetailDist(val);
        },
    };

    if (!commodity) {
        return (
            <PageTransition>
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
                    <BarChart3 size={48} className="text-[var(--color-text-muted)]" />
                    <p className="text-[var(--color-text-secondary)]">No commodity selected.</p>
                    <button
                        className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-md"
                        onClick={() => router.push('/filters')}
                    >
                        Go to Filters →
                    </button>
                </div>
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            <div className="pb-12 pt-6">
                <div className="mx-auto max-w-[var(--max-content)] px-4 sm:px-6 lg:px-8">
                    {/* Dashboard Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div>
                            <button
                                onClick={() => router.back()}
                                className="mb-2 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] sm:text-3xl">{commodity}</h1>
                            {variety && <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{variety}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200
                                    ${showFilters
                                        ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border border-[var(--color-text-muted)]'
                                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                                    }`}
                            >
                                <Filter size={14} />
                                Filters
                            </button>
                            <button
                                onClick={() => setCompareMode(!compareMode)}
                                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200
                                    ${compareMode
                                        ? 'bg-[var(--color-accent)] text-white shadow-md'
                                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                                    }`}
                            >
                                <GitCompare size={14} />
                                Compare
                            </button>
                            <ExportDropdown
                                combinedData={[...filteredDataByType.terminal, ...filteredDataByType.shipping, ...filteredDataByType.retail]}
                                terminalData={filteredDataByType.terminal}
                                shippingData={filteredDataByType.shipping}
                                retailData={filteredDataByType.retail}
                                commodityName={commodity}
                                filters={{
                                    terminal: { pkg: terminalPkg, org: terminalOrg, dist: terminalDist },
                                    shipping: { pkg: shippingPkg, org: shippingOrg, dist: shippingDist },
                                    retail: { pkg: retailPkg, org: retailOrg, dist: retailDist }
                                }}
                            />
                            <motion.button
                                onClick={toggleFavorite}
                                whileTap={{ scale: 0.9 }}
                                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200
                                    ${isFavorite
                                        ? 'bg-red-50 text-red-500 shadow-sm [html[data-theme="dark"]_&]:bg-red-950/30'
                                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-red-400'
                                    }`}
                            >
                                <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* Dashboard Inline Filters */}
                    <DashboardFilters 
                        currentFilters={{ commodity, category, variety, district, organic: searchParams.get('organic') || '' }} 
                        isOpen={showFilters} 
                        onClose={() => setShowFilters(false)} 
                    />

                    {/* Time Range Selector */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.05 }}
                        className="mb-6 flex flex-wrap items-center gap-3"
                    >
                        <Clock size={14} className="text-[var(--color-text-muted)]" />
                        <div className="flex gap-1 rounded-xl bg-[var(--color-surface-elevated)] p-1">
                            {TIME_RANGES.map(t => (
                                <button
                                    key={t.days}
                                    className={`relative rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200
                                        ${timeRange === t.days
                                            ? 'text-[var(--color-text-primary)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                        }`}
                                    onClick={() => setTimeRange(t.days)}
                                >
                                    {timeRange === t.days && (
                                        <motion.div
                                            layoutId="time-indicator"
                                            className="absolute inset-0 rounded-lg bg-[var(--color-surface)] shadow-sm"
                                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10">{t.label}</span>
                                </button>
                            ))}
                        </div>
                        
                        {/* Custom Date Inputs */}
                        <AnimatePresence>
                            {timeRange === 'custom' && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, width: 0, overflow: 'hidden' }}
                                    className="flex items-center gap-2"
                                >
                                    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-sm shadow-sm transition-colors focus-within:border-[var(--color-accent)]">
                                        <input 
                                            type="date" 
                                            className="bg-transparent text-[var(--color-text-primary)] outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                                            value={customDateRange.start}
                                            min={dateBounds.minDate ? new Date(dateBounds.minDate).toISOString().split('T')[0] : undefined}
                                            max={customDateRange.end || (dateBounds.maxDate ? new Date(dateBounds.maxDate).toISOString().split('T')[0] : undefined)}
                                            onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        />
                                        <span className="text-[var(--color-text-muted)]">to</span>
                                        <input 
                                            type="date" 
                                            className="bg-transparent text-[var(--color-text-primary)] outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                                            value={customDateRange.end}
                                            min={customDateRange.start || (dateBounds.minDate ? new Date(dateBounds.minDate).toISOString().split('T')[0] : undefined)}
                                            max={dateBounds.maxDate ? new Date(dateBounds.maxDate).toISOString().split('T')[0] : undefined}
                                            onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {loading ? (
                        <div className="space-y-6">
                            <SkeletonChart />
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                        >
                            {/* Main Content */}
                            <div className="space-y-6">
                                    <AnimatePresence mode="wait">
                                        {compareMode ? (
                                            <motion.section
                                                key="compare"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ duration: 0.25 }}
                                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
                                            >
                                                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                                                        <GitCompare size={16} className="text-[var(--color-accent)]" />
                                                        Price Bridge Comparison
                                                    </h2>
                                                    {dateBounds.minDate && (
                                                        <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-3 py-1.5 rounded-lg border border-[var(--color-border)] inline-flex items-center justify-center">
                                                            Data: {new Date(dateBounds.minDate).toLocaleDateString()} — {new Date(dateBounds.maxDate).toLocaleDateString()}
                                                            <span className="ml-1.5 font-semibold text-[var(--color-text-secondary)]">· {priceData.length} records</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <ComparisonContainer
                                                    filters={{ commodity, category, variety }}
                                                />
                                            </motion.section>
                                        ) : (
                                            <motion.section
                                                key="overview"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.25 }}
                                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
                                            >
                                                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                                                        <BarChart3 size={16} className="text-[var(--color-accent)]" />
                                                        Price Overview
                                                    </h2>
                                                    {dateBounds.minDate && (
                                                        <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-3 py-1.5 rounded-lg border border-[var(--color-border)] inline-flex items-center justify-center">
                                                            Data: {new Date(dateBounds.minDate).toLocaleDateString()} — {new Date(dateBounds.maxDate).toLocaleDateString()}
                                                            <span className="ml-1.5 font-semibold text-[var(--color-text-secondary)]">· {priceData.length} records</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <PriceWaterfall
                                                    stats={stats}
                                                    packageData={packageData}
                                                    actions={actions}
                                                    weightData={weightData}
                                                    originData={originData}
                                                    districtData={districtData}
                                                    dateRanges={dateRanges}
                                                    reportCounts={reportCounts}
                                                />
                                            </motion.section>
                                        )}
                                    </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <div className="spinner" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
