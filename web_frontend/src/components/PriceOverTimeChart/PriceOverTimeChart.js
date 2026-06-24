'use client';

/**
 * PriceOverTimeChart — line chart of Terminal/Shipping/Retail prices over time.
 * Mirrors the mobile price-over-time feature: time-range presets, per-line
 * visibility toggles, a shared package sub-filter, and an optional CPI
 * inflation adjustment. Plots the backend-normalized $/lb (or $/unit) price.
 */

import { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import usePriceTimeSeries from '../../hooks/usePriceTimeSeries';
import FilterDropdown from '../FilterDropdown/FilterDropdown';
import { CPI_BASE_KEY } from '../../constants/cpiData';

const MARKETS = [
    { key: 'terminal', label: 'Terminal', color: 'var(--color-terminal)' },
    { key: 'shipping', label: 'Shipping', color: 'var(--color-shipping)' },
    { key: 'retail', label: 'Retail', color: 'var(--color-retail)' },
];

// Module-scoped so it isn't re-created each render. recharts injects
// active/payload/label; `visible` and `fmtDate` are passed explicitly.
function ChartTooltip({ active, payload, label, visible, fmtDate }) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="glass rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-dropdown)]">
            <p className="mb-1 text-xs font-semibold text-[var(--color-text-primary)]">{fmtDate(label)}</p>
            <div className="space-y-0.5">
                {MARKETS.filter(m => visible[m.key]).map(m => {
                    const entry = payload.find(p => p.dataKey === m.key);
                    if (!entry || entry.value == null) return null;
                    return (
                        <div key={m.key} className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                            <span className="text-[var(--color-text-secondary)]">{m.label}</span>
                            <span className="ml-auto font-bold text-[var(--color-text-primary)]">${entry.value.toFixed(2)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function PriceOverTimeChart({ filters, organicOnly }) {
    const {
        series, loading, error,
        packageOptions, selectedPackage,
        selectedRange, availableRanges, granularity,
        cpiAdjusted, dateSpan, actions,
    } = usePriceTimeSeries(filters, { organicOnly });

    const [visible, setVisible] = useState({ terminal: true, shipping: true, retail: true });

    const fmtDate = (d) => {
        const dt = new Date(d);
        if (isNaN(dt)) return d;
        return granularity === 'month'
            ? dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Merge the three series into one row per date for recharts.
    const chartData = useMemo(() => {
        const map = new Map();
        for (const m of MARKETS) {
            for (const p of series[m.key] || []) {
                let row = map.get(p.date);
                if (!row) { row = { date: p.date }; map.set(p.date, row); }
                row[m.key] = p.price;
            }
        }
        return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    }, [series]);

    const unitLabel = useMemo(() => {
        const units = series._units || {};
        const counts = {};
        for (const m of MARKETS) {
            if (visible[m.key] && units[m.key]) counts[units[m.key]] = (counts[units[m.key]] || 0) + 1;
        }
        const u = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || units.terminal || 'lb';
        return u === 'lb' ? 'Price / lb' : u === 'unit' ? 'Price / unit' : 'Avg package price';
    }, [series, visible]);

    // Net change of the most-populated visible series (Stocks-style readout).
    const netChange = useMemo(() => {
        let best = null;
        for (const m of MARKETS) {
            if (!visible[m.key]) continue;
            const pts = series[m.key] || [];
            if (pts.length >= 2 && (!best || pts.length > best.pts.length)) best = { m, pts };
        }
        if (!best) return null;
        const first = best.pts[0].price;
        const last = best.pts[best.pts.length - 1].price;
        const delta = last - first;
        return { delta, pct: first ? (delta / first) * 100 : 0, label: best.m.label, last };
    }, [series, visible]);

    const hasData = chartData.length > 0;

    return (
        <div className="space-y-5">
            {/* Header: unit + net change */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{unitLabel}</p>
                    {netChange && (
                        <div className="mt-0.5 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-[var(--color-text-primary)]">${netChange.last.toFixed(2)}</span>
                            <span className={`flex items-center gap-1 text-sm font-semibold ${netChange.delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {netChange.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {netChange.delta >= 0 ? '+' : ''}{netChange.delta.toFixed(2)} ({netChange.pct >= 0 ? '+' : ''}{netChange.pct.toFixed(1)}%)
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">{netChange.label}, {selectedRange}</span>
                        </div>
                    )}
                </div>

                {/* Package sub-filter */}
                {packageOptions.length > 1 && (
                    <div className="w-48">
                        <FilterDropdown
                            label="Package"
                            options={packageOptions}
                            value={selectedPackage}
                            onChange={(v) => actions.setSelectedPackage(v)}
                            color="var(--color-accent)"
                        />
                    </div>
                )}
            </div>

            {/* Controls: time range + CPI toggle */}
            <div className="flex flex-wrap items-center gap-3">
                <Clock size={14} className="text-[var(--color-text-muted)]" />
                <div className="flex gap-1 rounded-xl bg-[var(--color-surface-elevated)] p-1">
                    {availableRanges.map(r => (
                        <button
                            key={r}
                            onClick={() => actions.setSelectedRange(r)}
                            className={`relative rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200
                                ${selectedRange === r ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                        >
                            {selectedRange === r && (
                                <motion.div
                                    layoutId="ts-range-indicator"
                                    className="absolute inset-0 rounded-lg bg-[var(--color-surface)] shadow-sm"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10">{r}</span>
                        </button>
                    ))}
                </div>

                <label className="group ml-auto flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs transition-all hover:border-[var(--color-text-muted)]">
                    <input
                        type="checkbox"
                        checked={cpiAdjusted}
                        onChange={(e) => actions.setCpiAdjusted(e.target.checked)}
                        className="peer sr-only"
                    />
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded border border-[var(--color-border)] transition-all peer-checked:border-[var(--color-accent)] peer-checked:bg-[var(--color-accent)]">
                        {cpiAdjusted && <span className="text-[8px] text-white">✓</span>}
                    </div>
                    <span className="text-[var(--color-text-secondary)]">
                        Inflation-adjusted{cpiAdjusted ? ` (${CPI_BASE_KEY} $)` : ''}
                    </span>
                </label>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                {loading ? (
                    <div className="flex h-80 items-center justify-center gap-3">
                        <div className="spinner" />
                        <p className="text-sm text-[var(--color-text-muted)]">Loading price history…</p>
                    </div>
                ) : error ? (
                    <div className="flex h-80 items-center justify-center gap-2 text-sm text-red-500">
                        <AlertCircle size={18} /> Failed to load price history.
                    </div>
                ) : !hasData ? (
                    <div className="flex h-80 items-center justify-center">
                        <p className="text-sm text-[var(--color-text-muted)]">No price history for this selection.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={340}>
                        <LineChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid-line)" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={fmtDate}
                                tick={{ fontSize: 11, fill: 'var(--chart-axis-text)' }}
                                axisLine={{ stroke: 'var(--chart-grid-line)' }}
                                tickLine={false}
                                minTickGap={28}
                            />
                            <YAxis
                                tickFormatter={(v) => `$${v.toFixed(2)}`}
                                tick={{ fontSize: 11, fill: 'var(--chart-axis-text)' }}
                                axisLine={false}
                                tickLine={false}
                                width={56}
                            />
                            <Tooltip content={<ChartTooltip visible={visible} fmtDate={fmtDate} />} />
                            {MARKETS.filter(m => visible[m.key]).map(m => (
                                <Line
                                    key={m.key}
                                    type="monotone"
                                    dataKey={m.key}
                                    stroke={m.color}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                    connectNulls={false}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}

                {/* Series toggle legend */}
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {MARKETS.map(m => {
                        const on = visible[m.key];
                        const hasSeries = (series[m.key] || []).length > 0;
                        return (
                            <button
                                key={m.key}
                                disabled={!hasSeries}
                                onClick={() => setVisible(v => ({ ...v, [m.key]: !v[m.key] }))}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all
                                    ${!hasSeries ? 'cursor-not-allowed opacity-40' : ''}
                                    ${on
                                        ? 'border-transparent text-white'
                                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                                style={on && hasSeries ? { backgroundColor: m.color } : undefined}
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? 'currentColor' : m.color }} />
                                {m.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
