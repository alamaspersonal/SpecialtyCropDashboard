'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronDown, Check, FileDown } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';

export default function ExportDropdown({
    combinedData = [],
    terminalData = [],
    shippingData = [],
    retailData = [],
    commodityName = 'Data',
    filters = { terminal: {}, shipping: {}, retail: {} }
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasAnyData = combinedData.length > 0;

    const handleExport = (dataseet, suffix, marketFilters) => {
        if (!dataseet || dataseet.length === 0) return;
        
        setIsExporting(true);
        setIsOpen(false);
        
        // Use a short timeout to let the UI update (show loading indicator)
        setTimeout(() => {
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = commodityName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            // Build filter string for the filename
            let filterParts = [];
            if (marketFilters) {
                if (marketFilters.pkg) filterParts.push(marketFilters.pkg.replace(/[^a-z0-9]/gi, '_').toLowerCase());
                if (marketFilters.org) filterParts.push(marketFilters.org.replace(/[^a-z0-9]/gi, '_').toLowerCase());
                if (marketFilters.dist) filterParts.push(marketFilters.dist.replace(/[^a-z0-9]/gi, '_').toLowerCase());
            }
            
            const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
            const filename = `${safeName}_${suffix}${filterSuffix}_${dateStr}`;
            
            exportToCSV(dataseet, filename);
            
            // Revert state back after a reasonable notification time
            setTimeout(() => {
                setIsExporting(false);
            }, 1000); // 1 second showing "Download Started" / Check icon
        }, 100);
    };

    const exportOptions = [
        {
            label: 'Export All Data (Combined)',
            data: combinedData,
            suffix: 'combined',
            filters: null, // combined doesn't have a single filter schema
            icon: <FileDown size={14} className="text-[var(--color-accent)]" />,
            disabled: !hasAnyData
        },
        {
            label: 'Export Terminal Data',
            data: terminalData,
            suffix: 'terminal',
            filters: filters.terminal,
            icon: <Download size={14} className="opacity-70" />,
            disabled: terminalData.length === 0
        },
        {
            label: 'Export Retail Data',
            data: retailData,
            suffix: 'retail',
            filters: filters.retail,
            icon: <Download size={14} className="opacity-70" />,
            disabled: retailData.length === 0
        },
        {
            label: 'Export Shipping Data',
            data: shippingData,
            suffix: 'shipping',
            filters: filters.shipping,
            icon: <Download size={14} className="opacity-70" />,
            disabled: shippingData.length === 0
        }
    ];

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isExporting || (!hasAnyData && !isExporting)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200
                    ${isOpen
                        ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] border border-[var(--color-text-muted)]'
                        : isExporting
                            ? 'bg-[var(--color-accent)] text-white shadow-md border border-[var(--color-accent)]'
                            : hasAnyData
                                ? 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                                : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-60 cursor-not-allowed'
                    }`}
            >
                {isExporting ? (
                    <>
                        <Check size={14} className="animate-pulse" />
                        Downloading...
                    </>
                ) : (
                    <>
                        <Download size={14} />
                        Export
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
                    >
                        <div className="py-1">
                            {exportOptions.map((option, idx) => (
                                <button
                                    key={option.suffix}
                                    onClick={() => handleExport(option.data, option.suffix, option.filters)}
                                    disabled={option.disabled}
                                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors
                                        ${option.disabled 
                                            ? 'text-[var(--color-text-muted)] cursor-not-allowed bg-transparent' 
                                            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                                        }
                                        ${idx === 0 ? 'border-b border-[var(--color-border)] pb-2.5 mb-1' : ''}
                                    `}
                                >
                                    <span className={option.disabled ? 'opacity-40' : ''}>
                                        {option.icon}
                                    </span>
                                    <span className="flex-1 font-medium">
                                        {option.label}
                                    </span>
                                    {!option.disabled && (
                                        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold bg-[var(--color-surface-elevated)] px-1.5 py-0.5 rounded">
                                            {option.data.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
