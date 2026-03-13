/**
 * ComparisonContainer — Manages dual date ranges and renders an integrated
 * PriceBridge comparison chart connecting Period A and Period B.
 */

import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import usePriceBridge from '../../hooks/usePriceBridge';

const TIME_RANGES = [
    { label: 'Last Day', days: 1 },
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
    { label: 'Custom', days: 'custom' },
];

export default function ComparisonContainer({ filters, organicOnly, selectedVariety, dateBounds = {} }) {
    const [timeRangeA, setTimeRangeA] = useState('custom');
    const [timeRangeB, setTimeRangeB] = useState('custom');

    const [startA, setStartA] = useState(null);
    const [endA, setEndA] = useState(null);
    const [startB, setStartB] = useState(null);
    const [endB, setEndB] = useState(null);

    // Initial load: Set Period B to Last 7 Days, Period A to the 7 Days Before That
    useEffect(() => {
        if (dateBounds.maxDate && !startA) {
            const maxD = new Date(dateBounds.maxDate);
            const bStart = new Date(maxD);
            bStart.setDate(bStart.getDate() - 7);
            
            const aStart = new Date(bStart);
            aStart.setDate(aStart.getDate() - 7);
            
            setStartA(aStart);
            setEndA(bStart);
            setStartB(bStart);
            setEndB(maxD);
            
            setTimeRangeA('custom');
            setTimeRangeB(7);
        }
    }, [dateBounds.maxDate, startA]);

    const handleTimeRangeClick = (period, days) => {
        if (period === 'A') {
            setTimeRangeA(days);
            if (days !== 'custom' && dateBounds.maxDate) {
                const maxD = new Date(dateBounds.maxDate);
                const aStart = new Date(maxD);
                aStart.setDate(aStart.getDate() - days);
                setStartA(aStart);
                setEndA(maxD);
            }
        } else {
            setTimeRangeB(days);
            if (days !== 'custom' && dateBounds.maxDate) {
                const maxD = new Date(dateBounds.maxDate);
                const bStart = new Date(maxD);
                bStart.setDate(bStart.getDate() - days);
                setStartB(bStart);
                setEndB(maxD);
            }
        }
    };

    const { bridges, loading, error } = usePriceBridge(
        filters, startA, endA, startB, endB,
        { organicOnly, selectedVariety }
    );

    const formatDate = (date) => {
        if (!date) return '';
        try {
            return date.toISOString().split('T')[0];
        } catch(e) {
            return '';
        }
    };

    const renderTimeSelector = (period, currentMode, startDate, endDate, setStart, setEnd) => (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Clock size={14} className="text-[var(--color-text-muted)]" />
                <div className="flex gap-1 rounded-xl bg-[var(--color-surface-elevated)] p-1">
                    {TIME_RANGES.map(t => (
                        <button
                            key={t.days}
                            className={`relative rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200
                                ${currentMode === t.days
                                    ? 'text-[var(--color-text-primary)]'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                }`}
                            onClick={() => handleTimeRangeClick(period, t.days)}
                        >
                            {currentMode === t.days && (
                                <motion.div
                                    layoutId={`time-indicator-${period}`}
                                    className="absolute inset-0 rounded-lg bg-[var(--color-surface)] shadow-sm"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {currentMode === 'custom' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="grid gap-2 sm:grid-cols-2 mt-1">
                            <div>
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Start</label>
                                <input
                                    type="date"
                                    value={formatDate(startDate)}
                                    max={formatDate(endDate)}
                                    min={dateBounds.minDate ? formatDate(new Date(dateBounds.minDate)) : undefined}
                                    onChange={e => {
                                        setStart(new Date(e.target.value));
                                        if (period === 'A') setTimeRangeA('custom');
                                        else setTimeRangeB('custom');
                                    }}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-blue-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">End</label>
                                <input
                                    type="date"
                                    value={formatDate(endDate)}
                                    min={formatDate(startDate)}
                                    max={dateBounds.maxDate ? formatDate(new Date(dateBounds.maxDate)) : formatDate(new Date())}
                                    onChange={e => {
                                        setEnd(new Date(e.target.value));
                                        if (period === 'A') setTimeRangeA('custom');
                                        else setTimeRangeB('custom');
                                    }}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-blue-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    // Chart Assembly
    let chartData = [];
    if (bridges && !loading && !error) {
        chartData = [
            {
                name: 'Terminal',
                periodA: bridges.terminal.period_a_avg,
                countA: bridges.terminal.period_a.reportCount,
                periodB: bridges.terminal.period_b_avg,
                countB: bridges.terminal.period_b.reportCount,
            },
            {
                name: 'Shipping',
                periodA: bridges.shipping.period_a_avg,
                countA: bridges.shipping.period_a.reportCount,
                periodB: bridges.shipping.period_b_avg,
                countB: bridges.shipping.period_b.reportCount,
            },
            {
                name: 'Retail',
                periodA: bridges.retail.period_a_avg,
                countA: bridges.retail.period_a.reportCount,
                periodB: bridges.retail.period_b_avg,
                countB: bridges.retail.period_b.reportCount,
            }
        ].filter(d => d.countA > 0 || d.countB > 0);
    }

    const CustomComparisonTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const diff = data.periodB - data.periodA;
            const isPositive = diff >= 0;
            return (
                <div className="glass rounded-xl px-4 py-3 shadow-[var(--shadow-dropdown)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{label} Market</p>
                    <div className="grid gap-x-3 gap-y-1 items-center" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-xs text-[var(--color-text-secondary)]">Period A ({data.countA} reports):</span>
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">${data.periodA.toFixed(2)}</span>

                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-[var(--color-text-secondary)]">Period B ({data.countB} reports):</span>
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">${data.periodB.toFixed(2)}</span>
                        
                        <div className="col-span-3 mt-1.5 pt-1.5 border-t border-[var(--color-border)] flex justify-between">
                            <span className="text-xs text-[var(--color-text-muted)]">Difference:</span>
                            <span className={`text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                                {isPositive ? '+' : ''}${(Math.abs(diff) || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-5">
            {/* Date Pickers */}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
                {/* Period A */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 [html[data-theme='dark']_&]:border-blue-900/30 [html[data-theme='dark']_&]:bg-blue-950/20">
                    <div className="mb-3 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Period A</h3>
                    </div>
                    {renderTimeSelector('A', timeRangeA, startA, endA, setStartA, setEndA)}
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
                    {renderTimeSelector('B', timeRangeB, startB, endB, setStartB, setEndB)}
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

                    {/* Integrated Graph */}
                    {chartData.length > 0 ? (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
                            <div className="mb-4">
                                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Integrated Market Comparison</h4>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Overlay of Period A versus Period B averages across all active markets.</p>
                            </div>
                            <div className="h-80 w-full mt-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-primary)' }} dy={10} />
                                        <YAxis tickFormatter={(v) => `$${v.toFixed(0)}`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                                        <Tooltip content={<CustomComparisonTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', color: 'var(--color-text-primary)' }} iconType="circle" />
                                        <Bar dataKey="periodA" name="Period A" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                        <Bar dataKey="periodB" name="Period B" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] py-10">
                            <p className="text-sm text-[var(--color-text-muted)]">No overlapping data for these periods.</p>
                        </div>
                    )}
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
                    {sign}${(Math.abs(delta) || 0).toFixed(2)}
                </div>
                {pct !== 0 && (
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                        ({sign}{(Math.abs(pct) || 0).toFixed(1)}%)
                    </div>
                )}
            </div>
        </div>
    );
}
