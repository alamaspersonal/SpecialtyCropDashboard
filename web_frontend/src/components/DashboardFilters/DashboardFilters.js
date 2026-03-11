'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Zap, Leaf, Check, X } from 'lucide-react';
import { getFilters, getCommoditiesWithCompleteData, getCommoditiesWithOrganicData } from '../../services/supabaseApi';
import FilterDropdown from '../FilterDropdown/FilterDropdown';
import { CATEGORY_COMMODITIES } from '../../constants/staticFilters';

export default function DashboardFilters({ currentFilters, isOpen, onClose }) {
    const router = useRouter();

    const [category, setCategory] = useState(currentFilters.category || '');
    const [commodity, setCommodity] = useState(currentFilters.commodity || '');
    const [variety, setVariety] = useState(currentFilters.variety || '');
    const [district, setDistrict] = useState(currentFilters.district || '');
    const [organic, setOrganic] = useState(currentFilters.organic || '');

    const [completeOnly, setCompleteOnly] = useState(false);
    const [organicOnly, setOrganicOnly] = useState(false);

    const [filterOptions, setFilterOptions] = useState({});
    const [completeCommodities, setCompleteCommodities] = useState(new Set());
    const [organicCommodities, setOrganicCommodities] = useState(new Set());
    const [loading, setLoading] = useState(false);

    // Initial load
    useEffect(() => {
        getCommoditiesWithCompleteData().then(setCompleteCommodities).catch(console.error);
    }, []);

    useEffect(() => {
        if (organicOnly) {
            getCommoditiesWithOrganicData().then(setOrganicCommodities).catch(console.error);
        }
    }, [organicOnly]);

    // Fetch filters when selections change
    useEffect(() => {
        if (!isOpen) return;
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
    }, [category, commodity, variety, district, organic, isOpen]);

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

    const handleApply = () => {
        if (!commodity) return;
        const params = new URLSearchParams();
        params.set('commodity', commodity);
        if (category) params.set('category', category);
        if (variety) params.set('variety', variety);
        if (district) params.set('district', district);
        if (organic) params.set('organic', organic);
        
        // This will navigate and cause Dashboard page to re-render with new params
        router.push(`/dashboard?${params.toString()}`);
        onClose(); // Auto-close panel after apply
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
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0, marginBottom: 0, overflow: 'hidden' }}
                    animate={{ 
                        height: 'auto', 
                        opacity: 1, 
                        marginBottom: 24,
                        transitionEnd: { overflow: 'visible' }
                    }}
                    exit={{ height: 0, opacity: 0, marginBottom: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.3 }}
                    className="relative z-20"
                >
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                                <Filter size={16} className="text-[var(--color-accent)]" />
                                Edit Filters
                            </h3>
                            <button 
                                onClick={onClose}
                                className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
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
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex flex-wrap gap-3">
                                <label className="group flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs transition-all hover:border-[var(--color-text-muted)]">
                                    <input
                                        type="checkbox"
                                        checked={completeOnly}
                                        onChange={(e) => setCompleteOnly(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded border border-[var(--color-border)] transition-all peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)]">
                                        {completeOnly && <span className="text-[8px] text-white">✓</span>}
                                    </div>
                                    <Zap size={12} className="text-amber-500" />
                                    <span className="text-[var(--color-text-secondary)]">Complete Data Only</span>
                                </label>
                                <label className="group flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs transition-all hover:border-[var(--color-text-muted)]">
                                    <input
                                        type="checkbox"
                                        checked={organicOnly}
                                        onChange={(e) => setOrganicOnly(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded border border-[var(--color-border)] transition-all peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)]">
                                        {organicOnly && <span className="text-[8px] text-white">✓</span>}
                                    </div>
                                    <Leaf size={12} className="text-emerald-500" />
                                    <span className="text-[var(--color-text-secondary)]">Organic Only</span>
                                </label>
                            </div>
                            
                            <button
                                onClick={handleApply}
                                disabled={!commodity || (commodity === currentFilters.commodity && variety === currentFilters.variety && district === currentFilters.district && organic === currentFilters.organic)}
                                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200
                                    ${commodity && (commodity !== currentFilters.commodity || variety !== currentFilters.variety || district !== currentFilters.district || organic !== currentFilters.organic)
                                        ? 'bg-[var(--color-accent)] text-white shadow-md hover:bg-[var(--color-accent-hover)] hover:-translate-y-0.5'
                                        : 'cursor-not-allowed bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
                                    }`}
                            >
                                {loading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                                Apply Filters
                                <Check size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
