'use client';

/**
 * Home Page — Landing page with search, watchlist, and favorites.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, Star, ArrowRight, Sparkles } from 'lucide-react';
import { getFavorites } from '../services/favorites';
import { getUserName } from '../services/userStorage';
import { STATIC_FILTERS, CATEGORY_COMMODITIES, COMMODITY_TO_CATEGORY } from '../constants/staticFilters';
import WatchlistCard from '../components/WatchlistCard/WatchlistCard';
import PageTransition from '../components/PageTransition/PageTransition';
import { SkeletonCard } from '../components/LoadingSkeleton/LoadingSkeleton';

export default function HomePage() {
    const router = useRouter();
    const [favorites, setFavorites] = useState([]);
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [userName, setUserNameState] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(() => {
        const favs = getFavorites();
        setFavorites(favs);
        const name = getUserName();
        if (name) setUserNameState(name);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
        setTimeout(() => setRefreshing(false), 600);
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const q = query.toLowerCase();
        const results = [];

        if (CATEGORY_COMMODITIES) {
            Object.keys(CATEGORY_COMMODITIES).forEach(cat => {
                if (cat.toLowerCase().includes(q)) {
                    results.push({ type: 'Category', value: cat });
                }
            });
        }

        if (COMMODITY_TO_CATEGORY) {
            Object.keys(COMMODITY_TO_CATEGORY).forEach(comm => {
                if (comm.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Commodity',
                        value: comm,
                        category: COMMODITY_TO_CATEGORY[comm],
                    });
                }
            });
        }

        setSearchResults(results.slice(0, 10));
        setShowResults(true);
    };

    const handleSelectResult = (result) => {
        setShowResults(false);
        setSearchQuery('');
        if (result.type === 'Category') {
            router.push(`/filters?category=${encodeURIComponent(result.value)}`);
        } else {
            router.push(
                `/dashboard?commodity=${encodeURIComponent(result.value)}&category=${encodeURIComponent(result.category || '')}`
            );
        }
    };

    const handleWatchlistDashboard = (item) => {
        router.push(
            `/dashboard?commodity=${encodeURIComponent(item.commodity)}&category=${encodeURIComponent(item.category || '')}&variety=${encodeURIComponent(item.variety || '')}`
        );
    };

    return (
        <PageTransition>
            <div className="min-h-[calc(100dvh-var(--header-height))]">
                {/* Hero Section */}
                <div className="relative bg-gradient-to-br from-emerald-50 via-white to-green-50 pb-8 pt-12 sm:pb-12 sm:pt-16 [html[data-theme='dark']_&]:from-slate-900 [html[data-theme='dark']_&]:via-slate-800 [html[data-theme='dark']_&]:to-emerald-950">
                    {/* Background decoration */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--color-accent)] opacity-5 blur-3xl" />
                        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-emerald-400 opacity-5 blur-3xl" />
                    </div>

                    <div className="relative mx-auto max-w-[var(--max-content)] px-4 sm:px-6 lg:px-8">
                        {/* Greeting */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
                                        {userName ? `Hey, ${userName}` : 'Market Intel'}
                                        <Sparkles className="ml-2 inline-block text-[var(--color-accent)]" size={24} />
                                    </h1>
                                    <p className="mt-1.5 text-base text-[var(--color-text-secondary)]">
                                        USDA Specialty Crop Prices
                                    </p>
                                </div>
                                <button
                                    onClick={handleRefresh}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:text-[var(--color-accent)]"
                                    aria-label="Refresh data"
                                >
                                    <motion.div
                                        animate={{ rotate: refreshing ? 360 : 0 }}
                                        transition={{ duration: 0.6, ease: 'linear' }}
                                    >
                                        <RefreshCw size={18} />
                                    </motion.div>
                                </button>
                            </div>
                        </motion.div>

                        {/* Search */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                            className="relative mt-6"
                        >
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={20} />
                                <input
                                    type="text"
                                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 pl-12 pr-4 text-base text-[var(--color-text-primary)] shadow-[var(--shadow-card)] transition-all duration-200 placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:shadow-[var(--shadow-card-hover)] focus:outline-none"
                                    placeholder="Search crops, categories..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                                />
                            </div>

                            <AnimatePresence>
                                {showResults && searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
                                    >
                                        {searchResults.map((result, i) => (
                                            <button
                                                key={`${result.type}-${result.value}-${i}`}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-elevated)]"
                                                onMouseDown={() => handleSelectResult(result)}
                                            >
                                                <span className="rounded-md bg-[var(--color-accent-light)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                                                    {result.type}
                                                </span>
                                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                                    {result.value}
                                                </span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* CTA */}
                        <motion.button
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            onClick={() => router.push('/filters')}
                            className="group mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[var(--color-accent-hover)] hover:shadow-md"
                        >
                            Browse All Crops
                            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </motion.button>
                    </div>
                </div>

                {/* Watchlist Section */}
                <div className="mx-auto max-w-[var(--max-content)] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                    <div className="flex items-center gap-2 mb-5">
                        <Star className="text-[var(--color-accent)]" size={18} />
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Your Watchlist</h2>
                    </div>

                    {loading ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                        </div>
                    ) : favorites.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center"
                        >
                            <Star className="mx-auto mb-3 text-[var(--color-text-muted)]" size={32} />
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                No favorites yet. Search for a crop or browse filters to add one.
                            </p>
                        </motion.div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {favorites.map((item, index) => (
                                <motion.div
                                    key={item.commodity}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                >
                                    <WatchlistCard
                                        item={item}
                                        expanded={expandedIndex === index}
                                        onToggle={() =>
                                            setExpandedIndex(expandedIndex === index ? null : index)
                                        }
                                        onPressDashboard={() => handleWatchlistDashboard(item)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
}
