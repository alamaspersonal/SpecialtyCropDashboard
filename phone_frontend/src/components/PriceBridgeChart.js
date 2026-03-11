/**
 * PriceBridgeChart — Mobile transposed vertical bridge visualization
 *
 * Renders a single market-type Price Bridge as a full-width vertical stack:
 *   Period A anchor → Effect rows → Period B anchor
 *
 * Follows financial waterfall conventions:
 *   - Blue/Slate for anchor bars
 *   - Green for positive effects
 *   - Red for negative effects
 *   - Gray for residual
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Color constants (industry standard) ─────────────────────────

const COLORS = {
    anchor: '#3b82f6',        // Blue — total bars
    anchorDark: '#60a5fa',
    positive: '#22c55e',      // Green — favorable
    negative: '#ef4444',      // Red — unfavorable
    residual: '#94a3b8',      // Slate gray — residual
    connector: '#e2e8f0',     // Light gray — connecting lines
};

// ─── Helpers ─────────────────────────────────────────────────────

function formatPrice(val) {
    if (val == null || isNaN(val)) return '—';
    return `$${Math.abs(val).toFixed(2)}`;
}

function formatSignedPrice(val) {
    if (val == null || isNaN(val)) return '—';
    const sign = val >= 0 ? '+' : '–';
    return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function formatPct(val) {
    if (val == null || isNaN(val) || val === 0) return '';
    const sign = val >= 0 ? '+' : '–';
    return `(${sign}${Math.abs(val).toFixed(1)}%)`;
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEffectColor(value, label) {
    if (label.includes('Residual') || label.includes('Other')) return COLORS.residual;
    if (value > 0) return COLORS.positive;
    if (value < 0) return COLORS.negative;
    return COLORS.residual;
}

// ─── Sub-components ──────────────────────────────────────────────

const AnchorRow = ({ label, price, period, isDark }) => (
    <View style={styles.anchorRow}>
        <View style={[styles.anchorBar, { backgroundColor: isDark ? COLORS.anchorDark : COLORS.anchor }]} />
        <View style={styles.anchorContent}>
            <View style={styles.anchorLabelRow}>
                <Text style={[styles.anchorLabel, isDark && styles.textLight]}>{label}</Text>
                {period?.start && (
                    <Text style={[styles.anchorMeta, isDark && styles.textMuted]}>
                        {formatDateShort(period.start)} – {formatDateShort(period.end)}
                        {period.reportCount > 0 && ` · ${period.reportCount} reports`}
                    </Text>
                )}
            </View>
            <Text style={[styles.anchorPrice, isDark && styles.textLight]}>
                {formatPrice(price)}
            </Text>
        </View>
    </View>
);

const EffectRow = ({ label, value, maxAbsValue, isDark }) => {
    const color = getEffectColor(value, label);
    const barWidth = maxAbsValue > 0 ? (Math.abs(value) / maxAbsValue) * 100 : 0;
    const pct = barWidth > 0 ? `${Math.max(barWidth, 8)}%` : '0%';

    return (
        <View style={styles.effectRow}>
            <View style={[styles.connectorDot, { backgroundColor: color }]} />
            <View style={styles.effectContent}>
                <View style={styles.effectLabelRow}>
                    <Text style={[styles.effectLabel, isDark && styles.textMuted]}>{label}</Text>
                    <Text style={[styles.effectValue, { color }]}>
                        {formatSignedPrice(value)}
                    </Text>
                </View>
                {value !== 0 && (
                    <View style={styles.effectBarTrack}>
                        <Animated.View
                            style={[
                                styles.effectBar,
                                { width: pct, backgroundColor: color },
                            ]}
                        />
                    </View>
                )}
            </View>
        </View>
    );
};

// ─── Main Component ──────────────────────────────────────────────

export default function PriceBridgeChart({ bridge, marketType, label }) {
    const { colors, isDark } = useTheme();
    const [expanded, setExpanded] = useState(true);

    if (!bridge) return null;

    const { period_a_avg, period_b_avg, effects, period_a, period_b } = bridge;
    const totalDelta = period_b_avg - period_a_avg;
    const pctChange = period_a_avg !== 0
        ? ((period_b_avg - period_a_avg) / period_a_avg) * 100
        : 0;

    const maxAbsValue = Math.max(...effects.map(e => Math.abs(e.value)), 0.01);

    // Header color based on market type
    const headerColors = {
        terminal: '#6366f1',    // indigo
        shipping: '#f59e0b',    // amber
        retail: '#10b981',      // emerald
    };
    const headerBg = headerColors[marketType] || colors.accent;

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {/* Header with market type + delta summary */}
            <TouchableOpacity
                style={[styles.header, { backgroundColor: headerBg }]}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.8}
            >
                <Text style={styles.headerLabel}>{label}</Text>
                <View style={styles.headerRight}>
                    <Text style={[
                        styles.headerDelta,
                        { color: totalDelta >= 0 ? '#dcfce7' : '#fecaca' }
                    ]}>
                        {formatSignedPrice(totalDelta)} {formatPct(pctChange)}
                    </Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="rgba(255,255,255,0.7)"
                    />
                </View>
            </TouchableOpacity>

            {/* Bridge body */}
            {expanded && (
                <View style={styles.body}>
                    {/* Period A anchor */}
                    <AnchorRow
                        label="Period A"
                        price={period_a_avg}
                        period={period_a}
                        isDark={isDark}
                    />

                    {/* Connector line */}
                    <View style={[styles.connectorLine, { backgroundColor: COLORS.connector }]} />

                    {/* Effect rows */}
                    {effects.map((effect, i) => (
                        <React.Fragment key={effect.label}>
                            <EffectRow
                                label={effect.label}
                                value={effect.value}
                                maxAbsValue={maxAbsValue}
                                isDark={isDark}
                            />
                            {i < effects.length - 1 && (
                                <View style={[styles.connectorLine, { backgroundColor: COLORS.connector }]} />
                            )}
                        </React.Fragment>
                    ))}

                    {/* Connector line */}
                    <View style={[styles.connectorLine, { backgroundColor: COLORS.connector }]} />

                    {/* Period B anchor */}
                    <AnchorRow
                        label="Period B"
                        price={period_b_avg}
                        period={period_b}
                        isDark={isDark}
                    />
                </View>
            )}
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerLabel: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerDelta: {
        fontSize: 15,
        fontWeight: '700',
    },

    // Body
    body: {
        padding: 16,
    },

    // Anchor rows
    anchorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    anchorBar: {
        width: 4,
        height: '100%',
        minHeight: 40,
        borderRadius: 2,
        marginRight: 12,
    },
    anchorContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    anchorLabelRow: {
        flex: 1,
    },
    anchorLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    anchorMeta: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    anchorPrice: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
        marginLeft: 12,
    },

    // Effect rows
    effectRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        paddingLeft: 4,
    },
    connectorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
        marginRight: 12,
    },
    effectContent: {
        flex: 1,
    },
    effectLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    effectLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
    },
    effectValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    effectBarTrack: {
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    effectBar: {
        height: 6,
        borderRadius: 3,
    },

    // Connector lines
    connectorLine: {
        width: 2,
        height: 12,
        marginLeft: 7,
        borderRadius: 1,
    },

    // Dark mode text
    textLight: {
        color: '#f1f5f9',
    },
    textMuted: {
        color: '#94a3b8',
    },
});
