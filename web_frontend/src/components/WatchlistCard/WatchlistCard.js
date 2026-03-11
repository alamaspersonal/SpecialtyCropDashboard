'use client';

/**
 * WatchlistCard — Glass card for favorite crops with expand/collapse.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BarChart3, TrendingUp } from 'lucide-react';

export default function WatchlistCard({ item, expanded, onToggle, onPressDashboard }) {
    return (
        <div
            className="group cursor-pointer rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5"
            onClick={onToggle}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {item.commodity}
                    </h3>
                    {item.variety && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                            {item.variety}
                        </p>
                    )}
                </div>
                <motion.div
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors group-hover:bg-[var(--color-surface-elevated)]"
                >
                    <ChevronDown size={16} />
                </motion.div>
            </div>

            {/* Category Badge */}
            {item.category && (
                <div className="px-4 pb-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent-light)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                        <TrendingUp size={10} />
                        {item.category}
                    </span>
                </div>
            )}

            {/* Expandable Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-[var(--color-border)] p-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPressDashboard();
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--color-accent-hover)] hover:shadow-md"
                            >
                                <BarChart3 size={16} />
                                View Dashboard
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
