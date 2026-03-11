'use client';

/**
 * FilterDropdown — Custom select with animated option flyout.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function FilterDropdown({
    label,
    options = [],
    value,
    onChange,
    color = 'var(--color-accent)',
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        onChange(opt === value ? '' : opt);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {label}
            </label>
            <button
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`flex w-full items-center justify-between rounded-xl border bg-[var(--color-surface)] px-4 py-3 text-sm transition-all duration-200
                    ${disabled
                        ? 'cursor-not-allowed border-[var(--color-border)] opacity-50'
                        : open
                            ? 'border-[var(--color-accent)] shadow-[var(--shadow-card-hover)]'
                            : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] shadow-[var(--shadow-card)]'
                    }`}
            >
                <span className={value ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
                    {value || `Select ${label.toLowerCase()}...`}
                </span>
                <div className="flex items-center gap-1">
                    {value && (
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                    )}
                    <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
                    </motion.div>
                </div>
            </button>

            <AnimatePresence>
                {open && options.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
                    >
                        {options.map((opt) => (
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
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
