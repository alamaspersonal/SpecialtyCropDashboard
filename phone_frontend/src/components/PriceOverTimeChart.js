/**
 * PriceOverTimeChart — Apple Stocks-inspired time-series chart
 *
 * Uses Victory Native XL (Skia-backed) for 60fps rendering.
 * Displays up to 3 data lines: Retail, Terminal, Shipping.
 * Includes:
 *   - Crosshair tooltip on long-press/drag
 *   - Series toggle pills
 *   - Time range preset selector (3M / 6M / 1Y / 2Y / All)
 *   - Collapsible filter chips
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Modal,
    FlatList,
} from 'react-native';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { Circle, useFont } from '@shopify/react-native-skia';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import usePriceTimeSeries from '../hooks/usePriceTimeSeries';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 260;

// ── Series colors (matching PriceWaterfallMobile cards) ──
const SERIES_CONFIG = {
    retail:   { color: '#d946ef', label: 'Retail' },
    terminal: { color: '#0ea5e9', label: 'Terminal' },
    shipping: { color: '#f97316', label: 'Shipping' },
};

// ── Tooltip component (rendered in Skia canvas) ──
function ChartTooltip({ state, seriesVisibility }) {
    // Show a dot at the pressed position for each visible series
    const dots = [];
    if (seriesVisibility.retail && state.y.retail) {
        dots.push(
            <Circle
                key="retail"
                cx={state.x.position}
                cy={state.y.retail.position}
                r={6}
                color={SERIES_CONFIG.retail.color}
            />
        );
    }
    if (seriesVisibility.terminal && state.y.terminal) {
        dots.push(
            <Circle
                key="terminal"
                cx={state.x.position}
                cy={state.y.terminal.position}
                r={6}
                color={SERIES_CONFIG.terminal.color}
            />
        );
    }
    if (seriesVisibility.shipping && state.y.shipping) {
        dots.push(
            <Circle
                key="shipping"
                cx={state.x.position}
                cy={state.y.shipping.position}
                r={6}
                color={SERIES_CONFIG.shipping.color}
            />
        );
    }
    return <>{dots}</>;
}

// ── Filter Chip Row ──
function FilterChipRow({ options, selectedValue, onSelect, label, colors }) {
    const [modalVisible, setModalVisible] = useState(false);

    if (!options || options.length === 0) return null;

    const displayValue = selectedValue || 'All';
    const truncated = displayValue.length > 16 ? displayValue.slice(0, 14) + '…' : displayValue;

    return (
        <>
            <TouchableOpacity
                style={[styles.filterChip, { backgroundColor: colors.surfaceElevated, borderColor: selectedValue ? colors.accent : colors.border }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={[styles.filterChipLabel, { color: colors.textMuted }]}>{label}</Text>
                <Text style={[styles.filterChipValue, { color: selectedValue ? colors.accent : colors.text }]} numberOfLines={1}>
                    {truncated}
                </Text>
                <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, borderBottomColor: colors.border }]}>Select {label}</Text>
                        <FlatList
                            data={['All', ...options]}
                            keyExtractor={(item) => item}
                            style={styles.optionsList}
                            renderItem={({ item }) => {
                                const isSelected = (item === 'All' && !selectedValue) || item === selectedValue;
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.optionItem,
                                            { borderBottomColor: colors.border },
                                            isSelected && { backgroundColor: colors.accent + '18' },
                                        ]}
                                        onPress={() => {
                                            onSelect(item === 'All' ? '' : item);
                                            setModalVisible(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            { color: colors.text },
                                            isSelected && { color: colors.accent, fontWeight: '600' },
                                        ]}>{item}</Text>
                                        {isSelected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity
                            style={[styles.cancelButton, { borderTopColor: colors.border }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

// ── Main Component ──────────────────────────────────────────────
export default function PriceOverTimeChart({ filters, organicOnly, selectedVariety }) {
    const { colors, isDark } = useTheme();

    // ── Hook: data + filters + time range ──
    const {
        series,
        loading,
        error,
        filterOptions,
        selectedPackage,
        selectedOrigin,
        selectedRange,
        availableRanges,
        dateSpan,
        actions,
    } = usePriceTimeSeries(filters, { organicOnly, selectedVariety });

    // ── Series visibility toggles (local state) ──
    const [seriesVisibility, setSeriesVisibility] = useState({
        retail: true,
        terminal: true,
        shipping: true,
    });

    // ── Filters collapsed state ──
    const [filtersExpanded, setFiltersExpanded] = useState(false);

    // ── Chart press state for crosshair ──
    const { state: pressState, isActive: isPressing } = useChartPressState({
        x: '',
        y: { retail: 0, terminal: 0, shipping: 0 },
    });

    // ── Merge series into a single data array for CartesianChart ──
    // Victory Native needs a flat array with a shared xKey.
    const chartData = useMemo(() => {
        // Collect all unique dates across all series
        const dateSet = new Set();
        series.retail.forEach(d => dateSet.add(d.date));
        series.terminal.forEach(d => dateSet.add(d.date));
        series.shipping.forEach(d => dateSet.add(d.date));

        const dates = [...dateSet].sort();
        if (dates.length === 0) return [];

        // Build lookup maps
        const retailMap = Object.fromEntries(series.retail.map(d => [d.date, d.price]));
        const terminalMap = Object.fromEntries(series.terminal.map(d => [d.date, d.price]));
        const shippingMap = Object.fromEntries(series.shipping.map(d => [d.date, d.price]));

        return dates.map(date => ({
            date,
            retail: retailMap[date] ?? null,
            terminal: terminalMap[date] ?? null,
            shipping: shippingMap[date] ?? null,
        }));
    }, [series]);

    // ── Determine which yKeys to use based on visibility + data ──
    const activeYKeys = useMemo(() => {
        const keys = [];
        if (seriesVisibility.retail && series.retail.length > 0) keys.push('retail');
        if (seriesVisibility.terminal && series.terminal.length > 0) keys.push('terminal');
        if (seriesVisibility.shipping && series.shipping.length > 0) keys.push('shipping');
        return keys;
    }, [seriesVisibility, series]);

    // ── Series button existence (for toggle pills; hide if no data at all) ──
    const seriesHasData = {
        retail: series.retail.length > 0,
        terminal: series.terminal.length > 0,
        shipping: series.shipping.length > 0,
    };

    const toggleSeries = (key) => {
        setSeriesVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ── Tooltip summary text ──
    const tooltipInfo = useMemo(() => {
        if (!isPressing) return null;
        return {
            date: pressState.x.value,
            retail: pressState.y.retail?.value,
            terminal: pressState.y.terminal?.value,
            shipping: pressState.y.shipping?.value,
        };
    }, [isPressing, pressState]);

    // ── Format month label for display (YYYY-MM → 'Mar 2024') ──
    const formatMonthLabel = (monthStr) => {
        if (!monthStr || monthStr.length < 7) return monthStr || '';
        // monthStr is 'YYYY-MM'
        const [year, month] = monthStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIdx = parseInt(month, 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return monthStr;
        return `${monthNames[monthIdx]} ${year}`;
    };

    // ── X-axis label formatter (abbreviate for space) ──
    const formatXLabel = (monthStr) => {
        if (!monthStr || monthStr.length < 7) return monthStr || '';
        const [year, month] = monthStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIdx = parseInt(month, 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return monthStr;
        return `${monthNames[monthIdx]} '${year.slice(2)}`;
    };

    // ── Loading state ──
    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
                <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 60 }} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading price history…</Text>
            </View>
        );
    }

    // ── Error state ──
    if (error) {
        return (
            <View style={[styles.container, { backgroundColor: isDark ? '#7f1d1d' : '#fef2f2' }]}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <Text style={[styles.errorText, { color: isDark ? '#fca5a5' : '#dc2626' }]}>
                    Failed to load price history.
                </Text>
            </View>
        );
    }

    // ── Empty state ──
    if (chartData.length === 0) {
        return (
            <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="analytics-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No price history available for this selection.
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Price Over Time</Text>
                {dateSpan.min && dateSpan.max && (
                    <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                        {new Date(dateSpan.min).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — {new Date(dateSpan.max).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                )}
            </View>

            {/* Time Range Selector */}
            <View style={[styles.rangeRow, { backgroundColor: isDark ? colors.background : '#f1f5f9' }]}>
                {availableRanges.map(preset => (
                    <TouchableOpacity
                        key={preset.key}
                        style={[
                            styles.rangeBtn,
                            selectedRange === preset.key && { backgroundColor: colors.accent },
                        ]}
                        onPress={() => actions.setSelectedRange(preset.key)}
                    >
                        <Text style={[
                            styles.rangeBtnText,
                            { color: colors.textSecondary },
                            selectedRange === preset.key && { color: isDark ? '#0f172a' : '#0f172a', fontWeight: '700' },
                        ]}>
                            {preset.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tooltip Display */}
            {isPressing && tooltipInfo && (
                <View style={[styles.tooltipBar, { backgroundColor: isDark ? colors.background : '#f8fafc' }]}>
                    <Text style={[styles.tooltipDate, { color: colors.text }]}>
                        {tooltipInfo.date ? formatMonthLabel(tooltipInfo.date) : ''}
                    </Text>
                    <View style={styles.tooltipPrices}>
                        {seriesVisibility.retail && tooltipInfo.retail != null && (
                            <Text style={[styles.tooltipPrice, { color: SERIES_CONFIG.retail.color }]}>
                                R: ${Number(tooltipInfo.retail).toFixed(2)}
                            </Text>
                        )}
                        {seriesVisibility.terminal && tooltipInfo.terminal != null && (
                            <Text style={[styles.tooltipPrice, { color: SERIES_CONFIG.terminal.color }]}>
                                T: ${Number(tooltipInfo.terminal).toFixed(2)}
                            </Text>
                        )}
                        {seriesVisibility.shipping && tooltipInfo.shipping != null && (
                            <Text style={[styles.tooltipPrice, { color: SERIES_CONFIG.shipping.color }]}>
                                S: ${Number(tooltipInfo.shipping).toFixed(2)}
                            </Text>
                        )}
                    </View>
                </View>
            )}

            {/* Chart */}
            {activeYKeys.length > 0 ? (
                <View style={styles.chartWrapper}>
                    <CartesianChart
                        data={chartData}
                        xKey="date"
                        yKeys={activeYKeys}
                        chartPressState={pressState}
                        axisOptions={{
                            formatXLabel,
                            tickCount: { x: 4, y: 5 },
                            labelColor: colors.textMuted,
                        }}
                        domainPadding={{ top: 20, bottom: 10 }}
                    >
                        {({ points }) => (
                            <>
                                {seriesVisibility.retail && points.retail && (
                                    <Line
                                        points={points.retail}
                                        color={SERIES_CONFIG.retail.color}
                                        strokeWidth={2.5}
                                        connectMissingData={true}
                                        curveType="natural"
                                        animate={{ type: 'timing', duration: 300 }}
                                    />
                                )}
                                {seriesVisibility.terminal && points.terminal && (
                                    <Line
                                        points={points.terminal}
                                        color={SERIES_CONFIG.terminal.color}
                                        strokeWidth={2.5}
                                        connectMissingData={true}
                                        curveType="natural"
                                        animate={{ type: 'timing', duration: 300 }}
                                    />
                                )}
                                {seriesVisibility.shipping && points.shipping && (
                                    <Line
                                        points={points.shipping}
                                        color={SERIES_CONFIG.shipping.color}
                                        strokeWidth={2.5}
                                        connectMissingData={true}
                                        curveType="natural"
                                        animate={{ type: 'timing', duration: 300 }}
                                    />
                                )}
                                {isPressing && (
                                    <ChartTooltip
                                        state={pressState}
                                        seriesVisibility={seriesVisibility}
                                    />
                                )}
                            </>
                        )}
                    </CartesianChart>
                </View>
            ) : (
                <View style={{ height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>Enable a data series to view the chart</Text>
                </View>
            )}

            {/* Series Toggle Pills */}
            <View style={styles.toggleRow}>
                {Object.entries(SERIES_CONFIG).map(([key, config]) => {
                    if (!seriesHasData[key]) return null;
                    const isActive = seriesVisibility[key];
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[
                                styles.togglePill,
                                {
                                    backgroundColor: isActive ? config.color + '20' : colors.background,
                                    borderColor: isActive ? config.color : colors.border,
                                },
                            ]}
                            onPress={() => toggleSeries(key)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.toggleDot, { backgroundColor: isActive ? config.color : colors.textMuted }]} />
                            <Text style={[
                                styles.toggleLabel,
                                { color: isActive ? config.color : colors.textMuted },
                            ]}>
                                {config.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Collapsible Filter Chips */}
            <TouchableOpacity
                style={[styles.filterToggle, { borderTopColor: colors.border }]}
                onPress={() => setFiltersExpanded(!filtersExpanded)}
            >
                <Ionicons name="options-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.filterToggleText, { color: colors.textSecondary }]}>
                    Filters {(selectedPackage || selectedOrigin) ? '(active)' : ''}
                </Text>
                <Ionicons
                    name={filtersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.textMuted}
                />
            </TouchableOpacity>

            {filtersExpanded && (
                <View style={styles.filterChipsRow}>
                    <FilterChipRow
                        label="Package"
                        options={filterOptions.packages}
                        selectedValue={selectedPackage}
                        onSelect={actions.setSelectedPackage}
                        colors={colors}
                    />
                    <FilterChipRow
                        label="Origin"
                        options={filterOptions.origins}
                        selectedValue={selectedOrigin}
                        onSelect={actions.setSelectedOrigin}
                        colors={colors}
                    />
                </View>
            )}
        </View>
    );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    loadingText: {
        textAlign: 'center',
        fontSize: 14,
        marginBottom: 20,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },

    // Time Range
    rangeRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 3,
        borderRadius: 10,
        gap: 2,
    },
    rangeBtn: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    rangeBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Tooltip
    tooltipBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 4,
    },
    tooltipDate: {
        fontSize: 13,
        fontWeight: '600',
    },
    tooltipPrices: {
        flexDirection: 'row',
        gap: 12,
    },
    tooltipPrice: {
        fontSize: 13,
        fontWeight: '700',
    },

    // Chart
    chartWrapper: {
        height: CHART_HEIGHT,
        paddingHorizontal: 8,
    },

    // Toggle Pills
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    togglePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1.5,
        gap: 6,
    },
    toggleDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    toggleLabel: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Filter Chips
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderTopWidth: 1,
    },
    filterToggleText: {
        fontSize: 13,
        fontWeight: '500',
    },
    filterChipsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 14,
        flexWrap: 'wrap',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    filterChipLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    filterChipValue: {
        fontSize: 12,
        fontWeight: '600',
        maxWidth: 100,
    },

    // Modal (for filter pickers)
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        borderRadius: 16,
        width: '100%',
        maxHeight: '70%',
        overflow: 'hidden',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    optionsList: {
        maxHeight: 300,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    optionText: {
        fontSize: 15,
        flex: 1,
    },
    cancelButton: {
        paddingVertical: 16,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
