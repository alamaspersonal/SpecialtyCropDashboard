'use client';

/**
 * FilterDropdown — Custom select with animated option flyout.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export default function FilterDropdown({
    label,
    options = [],
    value,
    onChange,
    color = 'var(--color-accent)',
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setTimeout(() => setSearchQuery(''), 200);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        onChange(opt === value ? '' : opt);
        setOpen(false);
        setTimeout(() => setSearchQuery(''), 200);
    };

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div ref={containerRef} className="relative">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {label}
            </label>
            <div
                onClick={() => !disabled && setOpen(!open)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border bg-[var(--color-surface)] px-4 py-3 text-sm transition-all duration-200
                    ${disabled
                        ? 'cursor-not-allowed border-[var(--color-border)] opacity-50 pointer-events-none'
                        : open
                            ? 'border-[var(--color-accent)] shadow-[var(--shadow-card-hover)]'
                            : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] shadow-[var(--shadow-card)]'
                    }`}
            >
                <span className={value ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
                    {value || `Select ${label.toLowerCase()}...`}
                </span>
                <div className="flex items-center gap-1.5">
                    {value && (
                        <>
                            <span
                                className="h-2 w-2 rounded-full hidden sm:block"
                                style={{ backgroundColor: color }}
                            />
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange('');
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                                aria-label={`Clear ${label}`}
                            >
                                <X size={14} />
                            </button>
                        </>
                    )}
                    <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-0.5">
                        <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
                    </motion.div>
                </div>
            </div>

            <AnimatePresence>
                {open && options.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full z-50 mt-1.5 flex max-h-72 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
                    >
                        {options.length > 5 && (
                            <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                                <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-[var(--color-text-secondary)] focus-within:ring-1 focus-within:ring-[var(--color-accent)]">
                                    <Search size={14} className="opacity-50" />
                                    <input
                                        type="text"
                                        placeholder={`Search ${label.toLowerCase()}...`}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="overflow-y-auto">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => handleSelect(opt)}
                                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors
                                            ${opt === value
                                                ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium'
                                                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                                            }`}
                                    >
                                        <span>{opt}</span>
                                        {opt === value && <Check size={14} />}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-4 text-center text-sm text-[var(--color-text-muted)]">
                                    No {label.toLowerCase()} found
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
