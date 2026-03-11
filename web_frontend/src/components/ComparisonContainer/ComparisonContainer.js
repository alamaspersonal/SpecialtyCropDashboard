/**
 * ComparisonContainer — Manages dual date ranges and renders PriceBridge
 * components for each market type.
 */

import React, { useState } from 'react';
import { Calendar, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import usePriceBridge from '../../hooks/usePriceBridge';
import PriceBridge from '../PriceBridge/PriceBridge';

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

const PRESETS = [
    {
        label: 'Week over Week',
        getA: () => ({ start: daysAgo(14), end: daysAgo(7) }),
        getB: () => ({ start: daysAgo(7), end: new Date() }),
    },
    {
        label: 'Month over Month',
        getA: () => ({ start: daysAgo(60), end: daysAgo(30) }),
        getB: () => ({ start: daysAgo(30), end: new Date() }),
    },
];

export default function ComparisonContainer({ filters, organicOnly, selectedVariety }) {
    const [startA, setStartA] = useState(() => daysAgo(14));
    const [endA, setEndA] = useState(() => daysAgo(7));
    const [startB, setStartB] = useState(() => daysAgo(7));
    const [endB, setEndB] = useState(() => new Date());

    const { bridges, loading, error } = usePriceBridge(
        filters, startA, endA, startB, endB,
        { organicOnly, selectedVariety }
    );

    const applyPreset = (preset) => {
        const a = preset.getA();
        const b = preset.getB();
        setStartA(a.start);
        setEndA(a.end);
        setStartB(b.start);
        setEndB(b.end);
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    return (
        <div className="space-y-5">
            {/* Presets */}
            <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                    <button
                        key={p.label}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:shadow-sm"
                        onClick={() => applyPreset(p)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Date Pickers */}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
                {/* Period A */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 [html[data-theme='dark']_&]:border-blue-900/30 [html[data-theme='dark']_&]:bg-blue-950/20">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Period A</h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Start</label>
                            <input
                                type="date"
                                value={formatDate(startA)}
                                max={formatDate(endA)}
                                onChange={e => setStartA(new Date(e.target.value))}
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-blue-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">End</label>
                            <input
                                type="date"
                                value={formatDate(endA)}
                                min={formatDate(startA)}
                                max={formatDate(new Date())}
                                onChange={e => setEndA(new Date(e.target.value))}
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-blue-400 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* VS Badge */}
                <div className="flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-[10px] font-bold text-[var(--color-text-muted)]">
                        VS
                    </span>
                </div>

                {/* Period B */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 [html[data-theme='dark']_&]:border-emerald-900/30 [html[data-theme='dark']_&]:bg-emerald-950/20">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Period B</h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Start</label>
                            <input
                                type="date"
                                value={formatDate(startB)}
                                max={formatDate(endB)}
                                onChange={e => setStartB(new Date(e.target.value))}
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-emerald-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">End</label>
                            <input
                                type="date"
                                value={formatDate(endB)}
                                min={formatDate(startB)}
                                max={formatDate(new Date())}
                                onChange={e => setEndB(new Date(e.target.value))}
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-emerald-400 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* State rendering */}
            {loading ? (
                <div className="flex items-center justify-center gap-3 py-8">
                    <div className="spinner" />
                    <p className="text-sm text-[var(--color-text-muted)]">Computing Price Bridge...</p>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-6 text-sm text-red-600 [html[data-theme='dark']_&]:border-red-900/30 [html[data-theme='dark']_&]:bg-red-950/20 [html[data-theme='dark']_&]:text-red-400">
                    <AlertCircle size={18} />
                    <p>Failed to compute bridge. Check your date ranges.</p>
                </div>
            ) : bridges ? (
                <div className="space-y-5">
                    {/* Summary Chips */}
                    <div className="grid gap-3 sm:grid-cols-3">
                        <SummaryChip label="Terminal Market" delta={bridges.summary.terminal_delta} pct={bridges.summary.terminal_pct} />
                        <SummaryChip label="Shipping Point" delta={bridges.summary.shipping_delta} pct={bridges.summary.shipping_pct} />
                        <SummaryChip label="National Retail" delta={bridges.summary.retail_delta} pct={bridges.summary.retail_pct} />
                    </div>

                    {/* Bridge Charts */}
                    <div className="grid gap-4 xl:grid-cols-2">
                        <PriceBridge bridge={bridges.terminal} label="Terminal Market Bridge" />
                        <PriceBridge bridge={bridges.shipping} label="Shipping Point Bridge" />
                        <PriceBridge bridge={bridges.retail} label="National Retail Bridge" />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] py-10">
                    <Calendar size={32} className="text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Select date ranges to compare price periods.</p>
                </div>
            )}
        </div>
    );
}

function SummaryChip({ label, delta, pct }) {
    const isPositive = delta >= 0;
    const sign = isPositive ? '+' : '–';
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className={`flex items-center gap-3 rounded-xl border p-3 ${
            isPositive
                ? 'border-emerald-200 bg-emerald-50 [html[data-theme="dark"]_&]:border-emerald-900/30 [html[data-theme="dark"]_&]:bg-emerald-950/20'
                : 'border-red-200 bg-red-50 [html[data-theme="dark"]_&]:border-red-900/30 [html[data-theme="dark"]_&]:bg-red-950/20'
        }`}>
            <Icon size={16} className={isPositive ? 'text-emerald-500' : 'text-red-500'} />
            <div>
                <h4 className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</h4>
                <div className={`text-sm font-bold ${isPositive ? 'text-emerald-600 [html[data-theme="dark"]_&]:text-emerald-400' : 'text-red-600 [html[data-theme="dark"]_&]:text-red-400'}`}>
                    {sign}${Math.abs(delta).toFixed(2)}
                </div>
                {pct !== 0 && (
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                        ({sign}{Math.abs(pct).toFixed(1)}%)
                    </div>
                )}
            </div>
        </div>
    );
}
