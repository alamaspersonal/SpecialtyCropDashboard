/**
 * PriceBridge — Waterfall bridge chart using Recharts.
 * Visualizes variance decomposition (price effect, mix effects, residual).
 */

import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

export default function PriceBridge({ bridge, label }) {
    if (!bridge || bridge.period_a.reportCount === 0 || bridge.period_b.reportCount === 0) {
        return (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</h4>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">Insufficient data to compute bridge.</p>
            </div>
        );
    }

    const chartData = useMemo(() => {
        let currentLevel = bridge.period_a_avg;

        const makeNode = (name, val, isAnchor = false) => {
            const node = { name, value: val, isAnchor };
            if (isAnchor) {
                node.base = 0;
                node.bar = val;
                node.fill = '#3b82f6';
            } else {
                if (val >= 0) {
                    node.base = currentLevel;
                    node.bar = val;
                    node.fill = '#22c55e';
                } else {
                    node.base = currentLevel + val;
                    node.bar = Math.abs(val);
                    node.fill = '#ef4444';
                }
                currentLevel += val;
            }
            return node;
        };

        const nodes = [makeNode('Period A', bridge.period_a_avg, true)];
        bridge.effects.forEach(effect => {
            nodes.push(makeNode(effect.label.replace(' / ', '\n'), effect.value));
        });
        nodes.push(makeNode('Period B', bridge.period_b_avg, true));
        return nodes;
    }, [bridge]);

    const formatCurrency = (val) => `$${val.toFixed(2)}`;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[1]?.payload || payload[0]?.payload;
            if (!data) return null;
            const isAnchor = data.isAnchor;
            const sign = !isAnchor && data.value > 0 ? '+' : '';
            return (
                <div className="glass rounded-xl px-3 py-2 shadow-[var(--shadow-dropdown)]">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">{data.name.replace('\n', ' ')}</p>
                    <p className="text-sm font-bold" style={{ color: data.fill }}>
                        {isAnchor ? formatCurrency(data.value) : `${sign}${formatCurrency(data.value)}`}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</h4>
                <div className="flex gap-3">
                    <span className="rounded-md bg-[var(--color-surface-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                        A: {bridge.period_a.reportCount} reports
                    </span>
                    <span className="rounded-md bg-[var(--color-surface-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                        B: {bridge.period_b.reportCount} reports
                    </span>
                </div>
            </div>

            <div>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                            interval={0}
                        />
                        <YAxis
                            tickFormatter={formatCurrency}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                        <Bar dataKey="base" stackId="a" fill="transparent" />
                        <Bar dataKey="bar" stackId="a" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
