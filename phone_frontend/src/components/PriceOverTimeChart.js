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

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    FlatList,
    ScrollView,
    Dimensions,
} from 'react-native';
import { CartesianChart, StackedBar } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import usePriceTimeSeries from '../hooks/usePriceTimeSeries';
import ExpandableBottomSheet from './ExpandableBottomSheet';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler'; // Optional if needed, but we can stick to react-native's ScrollView


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 260;

// ── Series colors (matching PriceWaterfallMobile cards) ──
const SERIES_CONFIG = {
    retail:   { color: '#d946ef', label: 'Retail' },
    terminal: { color: '#0ea5e9', label: 'Terminal' },
    shipping: { color: '#f97316', label: 'Shipping' },
};

// Removed ChartTooltip (no longer used since we use touch overlay)

// ── Filter Chip Row ──
function FilterChipRow({ options, selectedValue, onSelect, label, colors, enabledOptions }) {
    const [modalVisible, setModalVisible] = useState(false);

    if (!options || options.length === 0) return null;

    const displayValue = selectedValue || 'All';
    const truncated = displayValue.length > 16 ? displayValue.slice(0, 14) + '…' : displayValue;

    return (
        <>
            <TouchableOpacity
                style={[styles.filterChip, { backgroundColor: '#1e293b', borderColor: selectedValue ? '#38bdf8' : '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 5 }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={[styles.filterChipLabel, { color: '#94a3b8' }]}>{label}</Text>
                <Text style={[styles.filterChipValue, { color: selectedValue ? '#38bdf8' : '#f8fafc' }]} numberOfLines={1}>
                    {truncated}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#94a3b8" />
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
                                // 'All' is always enabled; others check enabledOptions set
                                const hasData = item === 'All' || !enabledOptions || enabledOptions.has(item);
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.optionItem,
                                            { borderBottomColor: colors.border },
                                            isSelected && { backgroundColor: colors.accent + '18' },
                                            !hasData && { opacity: 0.35 },
                                        ]}
                                        onPress={() => {
                                            if (!hasData) return; // Don't allow selecting options with no data
                                            onSelect(item === 'All' ? '' : item);
                                            setModalVisible(false);
                                        }}
                                        activeOpacity={hasData ? 0.7 : 1}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                            <Text style={[
                                                styles.optionText,
                                                { color: hasData ? colors.text : colors.textMuted },
                                                isSelected && { color: colors.accent, fontWeight: '600' },
                                            ]}>{item}</Text>
                                            {!hasData && (
                                                <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>No data</Text>
                                            )}
                                        </View>
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

// Dependencies removed as they are housed in ExpandableBottomSheet.js

// ── Main Component ──────────────────────────────────────────────
export default function PriceOverTimeChart({ filters, organicOnly, selectedVariety, varietyOptions, onSelectVariety }) {
    const { colors, isDark } = useTheme();
    const robotoFont = useFont(require('../../assets/fonts/Roboto-Regular.ttf'), 11);

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
        const retailMap = Object.fromEntries(series.retail.map(d => [d.date, d]));
        const terminalMap = Object.fromEntries(series.terminal.map(d => [d.date, d]));
        const shippingMap = Object.fromEntries(series.shipping.map(d => [d.date, d]));

        return dates.map(date => {
            const r = retailMap[date];
            const t = terminalMap[date];
            const s = shippingMap[date];
            return {
                date,
                retail: r ? r.price : null,
                terminal: t ? t.price : null,
                shipping: s ? s.price : null,
                retailMeta: r || null,
                terminalMeta: t || null,
                shippingMeta: s || null,
            };
        });
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

    // ── Active tooltip data (set via lookup when user presses chart) ──
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [activeIndex, setActiveIndex] = useState(null);
    const [isScrubbing, setIsScrubbing] = useState(false); // Disable scroll while scrubbing
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const displayTooltip = activeTooltip || (chartData.length > 0 ? chartData[chartData.length - 1] : null);

    // ── Apple Stocks-style stats ──
    const headerStats = useMemo(() => {
        if (!chartData || chartData.length < 2) return null;
        
        const possibleKeys = ['retail', 'terminal', 'shipping'];
        let bestKey = null;
        let maxValidPoints = 1;
        
        for (const key of possibleKeys) {
            if (seriesVisibility[key] && series[key].length > 0) {
                const validPoints = chartData.filter(d => d[key] != null);
                if (validPoints.length > maxValidPoints) {
                    bestKey = key;
                    maxValidPoints = validPoints.length;
                }
            }
        }

        if (!bestKey) return null;

        const validPoints = chartData.filter(d => d[bestKey] != null);
        const firstPrice = validPoints[0][bestKey];
        const lastPrice = validPoints[validPoints.length - 1][bestKey];
        
        const netChange = lastPrice - firstPrice;
        const pctChange = firstPrice > 0 ? (netChange / firstPrice) * 100 : 0;
        
        const isPositive = netChange >= 0;
        const color = isPositive ? '#22c55e' : '#ef4444'; // Green or Red
        const sign = isPositive ? '+' : '';

        return {
            net: `${sign}$${Math.abs(netChange).toFixed(2)}`,
            pct: `${sign}${Math.abs(pctChange).toFixed(1)}%`,
            color: color,
        };
    }, [chartData, seriesVisibility, series]);

    // ── Format month label for display (YYYY-MM → 'Mar 2024') ──
    const formatMonthLabel = (monthStr) => {
        if (monthStr == null) return '';
        const str = String(monthStr);
        if (str.length < 7 || !str.includes('-')) return str;
        const parts = str.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return str;
        return `${monthNames[monthIdx]} ${parts[0]}`;
    };

    // ── X-axis label formatter (abbreviate for space) ──
    const formatXLabel = (monthStr) => {
        if (monthStr == null) return '';
        const str = String(monthStr);
        if (str.length < 7 || !str.includes('-')) return str;
        const parts = str.split('-');
        
        const monthFirstLetters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return str;
        
        // Show the full year for January as a major division
        if (monthIdx === 0) {
            return parts[0];
        }
        
        // Otherwise, just the first letter (e.g. J, F, M)
        return monthFirstLetters[monthIdx];
    };

    // ── Look up tooltip data by touch position ──
    const chartDataRef = useRef(chartData);
    useEffect(() => { chartDataRef.current = chartData; }, [chartData]);


    const chartLayoutRef = useRef({ x: 0, width: 0 });
    const pointsRef = useRef({});


    const handleTouchEvent = useCallback((evt) => {
        const touchX = evt.nativeEvent.locationX;
        const { width } = chartLayoutRef.current;
        if (width <= 0 || chartDataRef.current.length === 0) return;

        // Chart has ~8px padding on each side from paddingHorizontal
        const chartPadding = 8;
        const chartWidth = width - chartPadding * 2;
        const relativeX = touchX - chartPadding;
        const fraction = Math.max(0, Math.min(1, relativeX / chartWidth));

        // Map fraction to nearest data index
        const dataLen = chartDataRef.current.length;
        const index = Math.round(fraction * (dataLen - 1));
        const row = chartDataRef.current[index];


        if (row) {
            setActiveIndex(index);
            setActiveTooltip({

                date: row.date,
                retail: row.retail,
                terminal: row.terminal,
                shipping: row.shipping,
                retailMeta: row.retailMeta,
                terminalMeta: row.terminalMeta,
                shippingMeta: row.shippingMeta,
            });
        }
    }, [isScrubbing]); // Make sure this hook uses latest if it depended on it, but isScrubbing dependency is safe

    const handleTouchStart = useCallback((evt) => {
        setIsScrubbing(true);
        handleTouchEvent(evt);
    }, [handleTouchEvent]);

    const handleTouchEnd = useCallback(() => {
        setIsScrubbing(false);
        // intentionally left blank to keep tooltip active
    }, []);

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

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
            <View style={{ flex: 1 }}>
                {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                        {headerStats ? (
                            <Text style={[styles.headerSubtitle, { color: headerStats.color, fontWeight: '700', fontSize: 16 }]}>
                                {headerStats.net} ({headerStats.pct}) Past {selectedRange === 'All' ? 'All Time' : selectedRange}
                            </Text>
                        ) : dateSpan.min && dateSpan.max ? (
                            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                                {new Date(dateSpan.min).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — {new Date(dateSpan.max).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </Text>
                        ) : null}
                    </View>
                </View>
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


            {/* Chart with touch overlay for tooltip */}
            {activeYKeys.length > 0 ? (
                <View
                    style={[styles.chartWrapper, { backgroundColor: '#0f172a', borderRadius: 16 }]}
                    onLayout={(e) => {
                        chartLayoutRef.current = {
                            x: e.nativeEvent.layout.x,
                            width: e.nativeEvent.layout.width,
                        };
                    }}
                >
                    <CartesianChart
                        data={chartData}
                        xKey="date"
                        yKeys={activeYKeys}
                        axisOptions={{
                            font: robotoFont,
                            formatXLabel,
                            formatYLabel: (v) => `$${v}`,
                            tickCount: { x: 12, y: 5 },
                            labelColor: '#94a3b8',
                            lineColor: '#334155', // Subtle grid color for dark background
                        }}
                        domainPadding={{ top: 20, bottom: 0, left: 15, right: 15 }}
                    >
                        {({ points, chartBounds }) => {
                            // Sync points to ref for the crosshair overlay below
                            pointsRef.current = points;
                            
                            const activePoints = [];
                            const activeColors = [];
                            
                            if (seriesVisibility.retail && points.retail) {
                                activePoints.push(points.retail);
                                activeColors.push(SERIES_CONFIG.retail.color);
                            }
                            if (seriesVisibility.terminal && points.terminal) {
                                activePoints.push(points.terminal);
                                activeColors.push(SERIES_CONFIG.terminal.color);
                            }
                            if (seriesVisibility.shipping && points.shipping) {
                                activePoints.push(points.shipping);
                                activeColors.push(SERIES_CONFIG.shipping.color);
                            }

                            return (
                                <>
                                    {activePoints.length > 0 && (
                                        <StackedBar
                                            chartBounds={chartBounds}
                                            points={activePoints}
                                            colors={activeColors}
                                            barWidth={8}
                                            barOptions={() => ({
                                                roundedCorners: { topLeft: 2, topRight: 2, bottomLeft: 2, bottomRight: 2 }
                                            })}
                                            animate={{ type: 'timing', duration: 300 }}
                                        />
                                    )}
                                </>
                            );
                        }}
                    </CartesianChart>

                    {/* Active Crosshair & Price Badges Overlay */}
                    {activeIndex !== null && pointsRef.current && (
                        <View style={StyleSheet.absoluteFill} pointerEvents="none">
                            {/* Vertical Line */}
                            {(() => {
                                const activePoint = pointsRef.current.retail?.[activeIndex] || 
                                                    pointsRef.current.terminal?.[activeIndex] || 
                                                    pointsRef.current.shipping?.[activeIndex];
                                if (!activePoint) return null;
                                const xPos = activePoint.x + 7;
                                const isRightEdge = xPos > SCREEN_WIDTH - 120;
                                const dataRow = chartData[activeIndex];
                                
                                return (
                                    <>
                                        <View style={{
                                            position: 'absolute', left: xPos, top: 0, bottom: 0,
                                            width: 1, backgroundColor: colors.textSecondary, opacity: 0.5
                                        }} />
                                        
                                        {/* Series Nodes */}
                                        {['retail', 'terminal', 'shipping'].map(key => {
                                            if (!seriesVisibility[key]) return null;
                                            const p = pointsRef.current[key]?.[activeIndex];
                                            if (!p) return null;
                                            return (
                                                <View key={key} style={{
                                                    position: 'absolute', left: p.x + 3, top: p.y - 4.5,
                                                    width: 9, height: 9, borderRadius: 4.5,
                                                    backgroundColor: SERIES_CONFIG[key].color,
                                                    borderWidth: 2, borderColor: colors.surfaceElevated
                                                }} />
                                            );
                                        })}
                                        
                                        {/* Floating Badge */}
                                        <View style={{
                                            position: 'absolute',
                                            left: isRightEdge ? xPos - 85 : xPos + 8,
                                            top: 20,
                                            backgroundColor: colors.surfaceElevated,
                                            paddingHorizontal: 8, paddingVertical: 6,
                                            borderRadius: 8, borderWidth: 1, borderColor: colors.border,
                                            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
                                        }}>
                                            {seriesVisibility.retail && dataRow.retail != null && (
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: SERIES_CONFIG.retail.color, marginBottom: 2 }}>
                                                    Ret: ${dataRow.retail.toFixed(2)}
                                                </Text>
                                            )}
                                            {seriesVisibility.terminal && dataRow.terminal != null && (
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: SERIES_CONFIG.terminal.color, marginBottom: 2 }}>
                                                    Ter: ${dataRow.terminal.toFixed(2)}
                                                </Text>
                                            )}
                                            {seriesVisibility.shipping && dataRow.shipping != null && (
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: SERIES_CONFIG.shipping.color }}>
                                                    Shi: ${dataRow.shipping.toFixed(2)}
                                                </Text>
                                            )}
                                        </View>
                                    </>
                                );
                            })()}
                        </View>
                    )}

                    {/* Transparent touch overlay for scrubbing */}
                    <View
                        style={styles.touchOverlay}
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        onResponderGrant={handleTouchStart}
                        onResponderMove={handleTouchEvent}
                        onResponderRelease={handleTouchEnd}
                        onResponderTerminate={handleTouchEnd}
                    />
                </View>
            ) : chartData.length === 0 ? (
                <View style={{ flex: 1, minHeight: 260, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="analytics-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                        No price history available for this selection.
                    </Text>
                </View>
            ) : (
                <View style={{ flex: 1, minHeight: 260, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>Enable a data series to view the chart</Text>
                </View>
            )}

            {/* Static Filters Section (Always bounds correctly above the bottom sheet) */}
            <View style={styles.filtersBottomArea}>
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

            {/* Fixed Filter Chips (Variety, Package, Origin) stuck under the chart */}
            <View style={[styles.filterChipsRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }]}>
                {(selectedVariety || selectedPackage || selectedOrigin) && (
                    <TouchableOpacity 
                        style={{ alignSelf: 'flex-end', marginBottom: 4, paddingHorizontal: 12 }}
                        onPress={() => {
                            if (onSelectVariety) onSelectVariety('');
                            if (actions.setSelectedPackage) actions.setSelectedPackage('');
                            if (actions.setSelectedOrigin) actions.setSelectedOrigin('');
                        }}
                    >
                        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 12 }}>Clear Filters</Text>
                    </TouchableOpacity>
                )}
                {varietyOptions && varietyOptions.length > 0 && onSelectVariety && (
                    <FilterChipRow
                        label="Variety"
                        options={varietyOptions}
                        selectedValue={selectedVariety}
                        onSelect={onSelectVariety}
                        colors={colors}
                    />
                )}
                <FilterChipRow
                    label="Package"
                    options={filterOptions.packages}
                    selectedValue={selectedPackage}
                    onSelect={actions.setSelectedPackage}
                    colors={colors}
                    enabledOptions={filterOptions.packagesWithData}
                />
                <FilterChipRow
                    label="Origin"
                    options={filterOptions.origins}
                    selectedValue={selectedOrigin}
                    onSelect={actions.setSelectedOrigin}
                    colors={colors}
                    enabledOptions={filterOptions.originsWithData}
                />
            </View>
            </View>
            </View>

            {/* Custom Swipeable Bottom Sheet */}
            <ExpandableBottomSheet
                displayTooltip={displayTooltip}
                seriesVisibility={seriesVisibility}
                seriesConfig={SERIES_CONFIG}
                colors={colors}
                formatMonthLabel={formatMonthLabel}
            />
        </View>
    );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
        // Remove paddingBottom: 85 and minHeight from here as it messes with absolute positioning of the bottom sheet
    },
    filtersBottomArea: {
        paddingBottom: 85, // Guarantees ExpandableBottomSheet never obstructs these controls
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
    tooltipContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    tooltipDate: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    tooltipMetrics: {
        flexDirection: 'column',
    },

    // Chart
    chartWrapper: {
        flex: 1,
        minHeight: 150, // Let it compress fluidly on smaller devices
        paddingHorizontal: 8,
        position: 'relative',
    },
    touchOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10,
        elevation: 10,
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
