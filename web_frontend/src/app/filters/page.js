'use client';

/**
 * Filters Page — Category → Commodity → Variety cascade selection.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Filter, Zap, Leaf, Trash2, ArrowRight } from 'lucide-react';
import { getFilters, getCommoditiesWithCompleteData, getCommoditiesWithOrganicData } from '../../services/supabaseApi';
import FilterDropdown from '../../components/FilterDropdown/FilterDropdown';
import { CATEGORY_COMMODITIES, COMMODITY_TO_CATEGORY } from '../../constants/staticFilters';
import PageTransition from '../../components/PageTransition/PageTransition';

export default function FiltersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [category, setCategory] = useState(searchParams.get('category') || '');
    const [commodity, setCommodity] = useState('');
    const [variety, setVariety] = useState('');
    const [district, setDistrict] = useState('');
    const [organic, setOrganic] = useState('');

    const [completeOnly, setCompleteOnly] = useState(false);
    const [organicOnly, setOrganicOnly] = useState(false);

    const [filterOptions, setFilterOptions] = useState({});
    const [completeCommodities, setCompleteCommodities] = useState(new Set());
    const [organicCommodities, setOrganicCommodities] = useState(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchFilters = async () => {
            setLoading(true);
            try {
                const filters = await getFilters({ category, commodity, variety, district, organic });
                setFilterOptions(filters);
            } catch (e) {
                console.error('Error fetching filters:', e);
            }
            setLoading(false);
        };
        fetchFilters();
    }, [category, commodity, variety, district, organic]);

    useEffect(() => {
        getCommoditiesWithCompleteData().then(setCompleteCommodities).catch(console.error);
    }, []);

    useEffect(() => {
        if (organicOnly) {
            getCommoditiesWithOrganicData().then(setOrganicCommodities).catch(console.error);
        }
    }, [organicOnly]);

    const handleFilterChange = (name, value) => {
        switch (name) {
            case 'category':
                setCategory(value);
                setCommodity('');
                setVariety('');
                setDistrict('');
                setOrganic('');
                setFilterOptions(prev => ({ ...prev, commodities: [], varieties: [] }));
                break;
            case 'commodity':
                setCommodity(value);
                setVariety('');
                setFilterOptions(prev => ({ ...prev, varieties: [] }));
                break;
            case 'variety':
                setVariety(value);
                break;
            case 'district':
                setDistrict(value);
                break;
            case 'organic':
                setOrganic(value);
                break;
        }
    };

    const clearFilters = () => {
        setCategory('');
        setCommodity('');
        setVariety('');
        setDistrict('');
        setOrganic('');
        setCompleteOnly(false);
        setOrganicOnly(false);
    };

    const handleViewDashboard = () => {
        if (!commodity) return;
        const params = new URLSearchParams();
        params.set('commodity', commodity);
        if (category) params.set('category', category);
        if (variety) params.set('variety', variety);
        if (district) params.set('district', district);
        if (organic) params.set('organic', organic);
        router.push(`/dashboard?${params.toString()}`);
    };

    let commodityOptions = filterOptions.commodities || [];
    if (category && CATEGORY_COMMODITIES[category]) {
        const categoryList = CATEGORY_COMMODITIES[category];
        commodityOptions = commodityOptions.filter(c => categoryList.includes(c));
    }
    if (completeOnly && completeCommodities.size > 0) {
        commodityOptions = commodityOptions.filter(c => completeCommodities.has(c));
    }
    if (organicOnly && organicCommodities.size > 0) {
        commodityOptions = commodityOptions.filter(c => organicCommodities.has(c));
    }

    const categories = Object.keys(CATEGORY_COMMODITIES || {}).sort();

    return (
        <PageTransition>
            <div className="min-h-[calc(100dvh-var(--header-height))] py-8 sm:py-12">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mb-8"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text-primary)] sm:text-3xl">
                                    <Filter size={24} className="text-[var(--color-accent)]" />
                                    Select Filters
                                </h1>
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Choose your crop, variety, and market to view price data.
                                </p>
                            </div>
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-error)]"
                            >
                                <Trash2 size={14} />
                                Clear All
                            </button>
                        </div>
                    </motion.div>

                    {/* Toggles */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.05 }}
                        className="mb-6 flex flex-wrap gap-3"
                    >
                        <label className="group flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm transition-all hover:shadow-[var(--shadow-card)]">
                            <input
                                type="checkbox"
                                checked={completeOnly}
                                onChange={(e) => setCompleteOnly(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="h-4 w-4 rounded border border-[var(--color-border)] transition-all peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)] flex items-center justify-center">
                                {completeOnly && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <Zap size={14} className="text-amber-500" />
                            <span className="text-[var(--color-text-secondary)]">Complete Data Only</span>
                        </label>
                        <label className="group flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm transition-all hover:shadow-[var(--shadow-card)]">
                            <input
                                type="checkbox"
                                checked={organicOnly}
                                onChange={(e) => setOrganicOnly(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="h-4 w-4 rounded border border-[var(--color-border)] transition-all peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)] flex items-center justify-center">
                                {organicOnly && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <Leaf size={14} className="text-emerald-500" />
                            <span className="text-[var(--color-text-secondary)]">Organic Only</span>
                        </label>
                    </motion.div>

                    {/* Filter Dropdowns */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        <FilterDropdown
                            label="Category"
                            options={categories}
                            value={category}
                            onChange={(v) => handleFilterChange('category', v)}
                            color="#818cf8"
                        />
                        <FilterDropdown
                            label="Commodity"
                            options={commodityOptions}
                            value={commodity}
                            onChange={(v) => handleFilterChange('commodity', v)}
                            color="var(--color-accent)"
                        />
                        <FilterDropdown
                            label="Variety"
                            options={filterOptions.varieties || []}
                            value={variety}
                            onChange={(v) => handleFilterChange('variety', v)}
                            color="#f59e0b"
                            disabled={!commodity}
                        />
                        <FilterDropdown
                            label="District"
                            options={filterOptions.districts || []}
                            value={district}
                            onChange={(v) => handleFilterChange('district', v)}
                            color="#06b6d4"
                        />
                    </motion.div>

                    {/* View Dashboard Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="mt-8"
                    >
                        <button
                            className={`group flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all duration-300
                                ${commodity
                                    ? 'bg-[var(--color-accent)] text-white shadow-md hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:-translate-y-0.5'
                                    : 'cursor-not-allowed bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
                                }`}
                            onClick={handleViewDashboard}
                            disabled={!commodity}
                        >
                            {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
                            View Price Dashboard
                            {commodity && (
                                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                            )}
                        </button>
                    </motion.div>
                </div>
            </div>
        </PageTransition>
    );
}
