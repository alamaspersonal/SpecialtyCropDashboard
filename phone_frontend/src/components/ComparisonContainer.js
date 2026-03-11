/**
 * ComparisonContainer — Period A vs. Period B Price Bridge
 *
 * Manages two date range selectors and renders PriceBridgeChart
 * for each market type (Terminal, Shipping, Retail).
 *
 * Uses the usePriceBridge hook for data fetching and computation.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import usePriceBridge from '../hooks/usePriceBridge';
import PriceBridgeChart from './PriceBridgeChart';

// ─── Date helpers ────────────────────────────────────────────────

function formatDateLabel(date) {
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

// ─── Presets ─────────────────────────────────────────────────────

const COMPARISON_PRESETS = [
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

// ─── Main Component ──────────────────────────────────────────────

export default function ComparisonContainer({ filters, organicOnly, selectedVariety }) {
    const { colors, isDark } = useTheme();

    // Period A: default = 2 weeks ago → 1 week ago
    const [startA, setStartA] = useState(() => daysAgo(14));
    const [endA, setEndA] = useState(() => daysAgo(7));

    // Period B: default = 1 week ago → today
    const [startB, setStartB] = useState(() => daysAgo(7));
    const [endB, setEndB] = useState(() => new Date());

    // Date picker modal state
    const [dateModal, setDateModal] = useState(null); // { field, period }
    const [tempDate, setTempDate] = useState(new Date());

    // Fetch + compute bridge
    const { bridges, loading, error } = usePriceBridge(
        filters, startA, endA, startB, endB,
        { organicOnly, selectedVariety }
    );

    // ── Date Picker Logic ──

    const openPicker = (period, field) => {
        const current = period === 'A'
            ? (field === 'start' ? startA : endA)
            : (field === 'start' ? startB : endB);
        setTempDate(current);
        setDateModal({ period, field });
    };

    const confirmDate = () => {
        if (!dateModal) return;
        const { period, field } = dateModal;
        if (period === 'A') {
            if (field === 'start') setStartA(tempDate);
            else setEndA(tempDate);
        } else {
            if (field === 'start') setStartB(tempDate);
            else setEndB(tempDate);
        }
        setDateModal(null);
    };

    const applyPreset = (preset) => {
        const a = preset.getA();
        const b = preset.getB();
        setStartA(a.start);
        setEndA(a.end);
        setStartB(b.start);
        setEndB(b.end);
    };

    // ── Render ──

    return (
        <View style={styles.wrapper}>
            {/* Preset buttons */}
            <View style={styles.presetRow}>
                {COMPARISON_PRESETS.map((preset) => (
                    <TouchableOpacity
                        key={preset.label}
                        style={[styles.presetChip, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                        onPress={() => applyPreset(preset)}
                    >
                        <Text style={[styles.presetText, { color: colors.textSecondary }]}>
                            {preset.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Date range cards */}
            <View style={styles.dateCardsContainer}>
                <DateRangeCard
                    label="Period A"
                    start={startA}
                    end={endA}
                    color="#3b82f6"
                    colors={colors}
                    isDark={isDark}
                    onStartPress={() => openPicker('A', 'start')}
                    onEndPress={() => openPicker('A', 'end')}
                />
                <Ionicons name="arrow-forward" size={20} color={colors.textMuted} style={{ marginHorizontal: 4 }} />
                <DateRangeCard
                    label="Period B"
                    start={startB}
                    end={endB}
                    color="#22c55e"
                    colors={colors}
                    isDark={isDark}
                    onStartPress={() => openPicker('B', 'start')}
                    onEndPress={() => openPicker('B', 'end')}
                />
            </View>

            {/* Loading / Error / Bridge charts */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Computing price bridge…
                    </Text>
                </View>
            ) : error ? (
                <View style={[styles.errorContainer, { backgroundColor: isDark ? '#7f1d1d' : '#fef2f2' }]}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={[styles.errorText, { color: isDark ? '#fca5a5' : '#dc2626' }]}>
                        Failed to compute bridge. Check your date ranges.
                    </Text>
                </View>
            ) : bridges ? (
                <>
                    {/* Summary cards */}
                    <View style={styles.summaryRow}>
                        <SummaryChip label="Terminal" delta={bridges.summary.terminal_delta} pct={bridges.summary.terminal_pct} isDark={isDark} />
                        <SummaryChip label="Shipping" delta={bridges.summary.shipping_delta} pct={bridges.summary.shipping_pct} isDark={isDark} />
                        <SummaryChip label="Retail" delta={bridges.summary.retail_delta} pct={bridges.summary.retail_pct} isDark={isDark} />
                    </View>

                    {/* Bridge charts */}
                    <PriceBridgeChart bridge={bridges.terminal} marketType="terminal" label="Terminal Market" />
                    <PriceBridgeChart bridge={bridges.shipping} marketType="shipping" label="Shipping Point" />
                    <PriceBridgeChart bridge={bridges.retail} marketType="retail" label="National Retail" />
                </>
            ) : (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Select date ranges to compare price periods.
                </Text>
            )}

            {/* Date Picker Modal */}
            <Modal visible={!!dateModal} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setDateModal(null)}
                >
                    <View style={[styles.datePickerModal, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.datePickerTitle, { color: colors.text }]}>
                            {dateModal ? `Period ${dateModal.period} — ${dateModal.field === 'start' ? 'Start' : 'End'} Date` : ''}
                        </Text>
                        <DateTimePicker
                            value={tempDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            maximumDate={new Date()}
                            onChange={(event, selectedDate) => {
                                if (Platform.OS === 'android') {
                                    if (event.type === 'set' && selectedDate) {
                                        setTempDate(selectedDate);
                                        confirmDate();
                                    } else {
                                        setDateModal(null);
                                    }
                                    return;
                                }
                                if (selectedDate) setTempDate(selectedDate);
                            }}
                            themeVariant={isDark ? 'dark' : 'light'}
                            style={{ height: 150 }}
                        />
                        {Platform.OS === 'ios' && (
                            <View style={styles.datePickerActions}>
                                <TouchableOpacity
                                    style={[styles.datePickerBtn, { borderColor: colors.border }]}
                                    onPress={() => setDateModal(null)}
                                >
                                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerBtn, { backgroundColor: colors.accent }]}
                                    onPress={confirmDate}
                                >
                                    <Text style={{ color: '#0f172a', fontWeight: '700' }}>Apply</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

// ─── Sub-components ──────────────────────────────────────────────

function DateRangeCard({ label, start, end, color, colors, isDark, onStartPress, onEndPress }) {
    return (
        <View style={[styles.dateCard, { borderColor: color, backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.dateCardLabel, { color }]}>{label}</Text>
            <TouchableOpacity onPress={onStartPress}>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                    {formatDateLabel(start)}
                </Text>
            </TouchableOpacity>
            <Text style={[styles.dateSep, { color: colors.textMuted }]}>to</Text>
            <TouchableOpacity onPress={onEndPress}>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                    {formatDateLabel(end)}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

function SummaryChip({ label, delta, pct, isDark }) {
    const isPositive = delta >= 0;
    const bg = isPositive
        ? (isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4')
        : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2');
    const textColor = isPositive
        ? (isDark ? '#86efac' : '#166534')
        : (isDark ? '#fca5a5' : '#991b1b');
    const sign = delta >= 0 ? '+' : '–';

    return (
        <View style={[styles.summaryChip, { backgroundColor: bg }]}>
            <Text style={[styles.summaryLabel, { color: textColor }]}>{label}</Text>
            <Text style={[styles.summaryDelta, { color: textColor }]}>
                {sign}${Math.abs(delta).toFixed(2)}
            </Text>
            {pct !== 0 && (
                <Text style={[styles.summaryPct, { color: textColor }]}>
                    ({sign}{Math.abs(pct).toFixed(1)}%)
                </Text>
            )}
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
    wrapper: {
        marginTop: 8,
    },

    // Presets
    presetRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        justifyContent: 'center',
    },
    presetChip: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
    },
    presetText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Date cards
    dateCardsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    dateCard: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    dateCardLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    dateValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    dateSep: {
        fontSize: 11,
        marginVertical: 2,
    },

    // Summary
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    summaryChip: {
        flex: 1,
        padding: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    summaryDelta: {
        fontSize: 15,
        fontWeight: '800',
    },
    summaryPct: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },

    // Loading / Error
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 14,
        flex: 1,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 14,
        paddingVertical: 30,
    },

    // Date Picker Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    datePickerModal: {
        width: '100%',
        borderRadius: 20,
        padding: 24,
    },
    datePickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 16,
    },
    datePickerActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    datePickerBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
    },
});
