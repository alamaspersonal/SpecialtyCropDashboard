import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    ActivityIndicator,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import PriceWaterfallMobile from '../components/PriceWaterfallMobile';
import ComparisonContainer from '../components/ComparisonContainer';
import PriceOverTimeChart from '../components/PriceOverTimeChart';
import ErrorBoundary from '../components/ErrorBoundary';
import { saveFavorite, removeFavorite, checkIsFavorite } from '../services/favorites';
import { generateMarketInsights } from '../services/cerebrasApi';
import { useTheme } from '../context/ThemeContext';
import useWaterfallData from '../hooks/useWaterfallData';


export default function DashboardScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { filters, organicOnly: initialOrganicOnly } = route.params;

    // ── UI-level state (not data-engine) ──
    const [isFavorite, setIsFavorite] = useState(false);
    const [viewMode, setViewMode] = useState('waterfall'); // 'waterfall' | 'chart' | 'compare'
    const [showOverflowMenu, setShowOverflowMenu] = useState(false);

    // AI Insights State
    const [aiInsights, setAiInsights] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const cachedDailyInsights = useRef('');
    const aiGeneratedForKey = useRef('');

    // Time Range Selection
    const [timeRange, setTimeRange] = useState('daily');
    const [customStartDate, setCustomStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30); return d;
    });
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showDateModal, setShowDateModal] = useState(false);
    const [activeDatePicker, setActiveDatePicker] = useState(null);

    // Top-level Filter Controls
    const [organicOnly, setOrganicOnly] = useState(initialOrganicOnly || false);
    const [selectedVariety, setSelectedVariety] = useState(filters.variety || '');
    const [showVarietyModal, setShowVarietyModal] = useState(false);

    // Costs State
    const [showCostModal, setShowCostModal] = useState(false);
    const [costs, setCosts] = useState({
        packing: '2.50',
        cooling: '0.80',
        inspection: '0.15',
        commission: '0.50'
    });

    // ══════════════════════════════════════════════════════════════
    // USE THE CUSTOM HOOK — replaces ~600 lines of inline logic
    // ══════════════════════════════════════════════════════════════
    const hookData = useWaterfallData(filters, timeRange, {
        customStartDate,
        customEndDate,
        organicOnly,
        selectedVariety,
    });

    const {
        stats,
        loading,
        priceData,
        marketNotes,
        terminalData,
        shippingData,
        retailData,
        packageOptions,
        selectedPackages,
        originOptions,
        selectedOrigins,
        districtOptions,
        selectedDistricts,
        weightData,
        varietyOptions,
        hasOrganicData,
        serverDateBounds,
        actions,
    } = hookData;

    // ── Favorite status ──
    useEffect(() => {
        const checkFavStatus = async () => {
            const status = await checkIsFavorite(filters.commodity);
            setIsFavorite(status);
        };
        checkFavStatus();
    }, [filters.commodity]);

    const toggleFavorite = async () => {
        if (isFavorite) {
            await removeFavorite(filters.commodity);
            setIsFavorite(false);
        } else {
            await saveFavorite(filters);
            setIsFavorite(true);
        }
    };

    // ── AI Insights ──
    const aiCacheKey = `${filters.commodity}|${selectedVariety}|${organicOnly}|${JSON.stringify(selectedOrigins)}|${JSON.stringify(selectedPackages)}`;
    useEffect(() => {
        if (timeRange !== 'daily') {
            if (cachedDailyInsights.current) setAiInsights(cachedDailyInsights.current);
            return;
        }
        if (aiGeneratedForKey.current === aiCacheKey && cachedDailyInsights.current) {
            setAiInsights(cachedDailyInsights.current);
            return;
        }

        const fetchAIInsights = async () => {
            if (!priceData.length || !filters.commodity) return;

            const shippingComments = {
                supply: shippingData.map(d => d.supply_tone_comments).filter(Boolean),
                demand: shippingData.map(d => d.demand_tone_comments).filter(Boolean),
                market: shippingData.map(d => d.market_tone_comments).filter(Boolean),
                commodity: shippingData.map(d => d.commodity_comments).filter(Boolean),
            };
            const terminalComments = {
                offerings: terminalData.map(d => d.offerings_comments).filter(Boolean),
                reporter: terminalData.map(d => d.reporter_comment).filter(Boolean),
                market: terminalData.map(d => d.market_tone_comments).filter(Boolean),
                commodity: terminalData.map(d => d.commodity_comments).filter(Boolean),
            };

            const hasShippingComments = Object.values(shippingComments).some(arr => arr.length > 0);
            const hasTerminalComments = Object.values(terminalComments).some(arr => arr.length > 0);

            if (!hasShippingComments && !hasTerminalComments) {
                setAiInsights('No market notes available for this selection.');
                return;
            }

            const getDateRange = (data) => {
                const dates = data.map(d => d.report_date).filter(Boolean).sort();
                if (dates.length === 0) return null;
                return { start: dates[0], end: dates[dates.length - 1], reportCount: data.length };
            };

            const dateInfo = { shipping: getDateRange(shippingData), terminal: getDateRange(terminalData) };
            const filterContext = {
                variety: selectedVariety || null,
                organic: organicOnly || false,
                origin: selectedOrigins.terminal || selectedOrigins.shipping || null,
                package: selectedPackages.terminal || selectedPackages.shipping || null,
            };

            setAiLoading(true);
            try {
                const insights = await generateMarketInsights(filters.commodity, shippingComments, terminalComments, dateInfo, filterContext);
                setAiInsights(insights);
                cachedDailyInsights.current = insights;
                aiGeneratedForKey.current = aiCacheKey;
            } catch (error) {
                console.error('Error generating AI insights:', error);
                setAiInsights('');
            } finally {
                setAiLoading(false);
            }
        };

        fetchAIInsights();
    }, [priceData, filters.commodity, terminalData, shippingData, retailData, timeRange, selectedVariety, organicOnly, selectedOrigins, selectedPackages]);

    // ── Helper: format a date string ──
    const formatDateShort = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Price Dashboard</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    {/* Chart Toggle */}
                    <TouchableOpacity onPress={() => setViewMode(viewMode === 'chart' ? 'waterfall' : 'chart')}>
                        <Ionicons
                            name={viewMode === 'chart' ? 'analytics' : 'analytics-outline'}
                            size={24}
                            color={viewMode === 'chart' ? colors.accent : colors.textMuted}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleFavorite}>
                        <Ionicons name={isFavorite ? "star" : "star-outline"} size={24} color={isFavorite ? '#eab308' : colors.textMuted} />
                    </TouchableOpacity>
                    {/* Overflow Menu */}
                    <TouchableOpacity onPress={() => setShowOverflowMenu(true)}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                ) : stats ? (
                    <>
                        <Text style={[styles.subtitle, { color: colors.text }]}>{filters.commodity || 'Commodity'}</Text>

                        {/* Variety Dropdown */}
                        <TouchableOpacity
                            style={[styles.varietySelector, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                            onPress={() => setShowVarietyModal(true)}
                        >
                            <Text style={[styles.varietySelectorLabel, { color: colors.textSecondary }]}>Variety:</Text>
                            <Text style={[styles.varietySelectorValue, { color: colors.text }]}>
                                {selectedVariety || 'All Varieties'}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                        </TouchableOpacity>

                        {/* Organic Checkbox */}
                        <TouchableOpacity
                            style={[
                                styles.organicCheckbox,
                                {
                                    backgroundColor: !hasOrganicData
                                        ? colors.surfaceElevated
                                        : organicOnly
                                            ? '#dcfce7'
                                            : colors.surfaceElevated,
                                    opacity: hasOrganicData ? 1 : 0.5
                                }
                            ]}
                            onPress={() => hasOrganicData && setOrganicOnly(!organicOnly)}
                            disabled={!hasOrganicData}
                            activeOpacity={hasOrganicData ? 0.7 : 1}
                        >
                            <View style={[
                                styles.checkbox,
                                organicOnly && hasOrganicData && styles.checkboxChecked,
                                !hasOrganicData && styles.checkboxDisabled
                            ]}>
                                {organicOnly && hasOrganicData && <Ionicons name="checkmark" size={14} color="white" />}
                            </View>
                            <Text style={[
                                styles.organicLabel,
                                { color: !hasOrganicData ? colors.textMuted : organicOnly ? '#166534' : colors.text }
                            ]}>
                                {hasOrganicData ? 'Organic Only' : 'Organic Only (No Data)'}
                            </Text>
                        </TouchableOpacity>

                        {/* ── Normal Mode: single waterfall ── */}
                        {viewMode === 'waterfall' && (
                            <>
                                {/* Time Range Toggle */}
                                <View style={[styles.timeRangeContainer, { backgroundColor: colors.surfaceElevated }]}>
                                    {[{ key: 'daily', label: 'Daily' }, { key: '7day', label: '7 Days' }, { key: '30day', label: '30 Days' }].map(preset => (
                                        <TouchableOpacity
                                            key={preset.key}
                                            style={[styles.timeRangeBtn, timeRange === preset.key && { backgroundColor: colors.accent }]}
                                            onPress={() => setTimeRange(preset.key)}
                                        >
                                            <Text style={[styles.timeRangeBtnText, { color: colors.textSecondary }, timeRange === preset.key && { color: '#0f172a' }]}>
                                                {preset.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Custom Date Range Button */}
                                <TouchableOpacity
                                    style={[
                                        styles.customDateBtn,
                                        {
                                            backgroundColor: timeRange === 'custom' ? colors.accent + '18' : colors.surfaceElevated,
                                            borderColor: timeRange === 'custom' ? colors.accent : colors.border,
                                        }
                                    ]}
                                    onPress={() => setShowDateModal(true)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={timeRange === 'custom' ? 'calendar' : 'calendar-outline'}
                                        size={16}
                                        color={timeRange === 'custom' ? colors.accent : colors.textMuted}
                                    />
                                    <Text style={[
                                        styles.customDateBtnText,
                                        { color: timeRange === 'custom' ? colors.accent : colors.textSecondary }
                                    ]}>
                                        {timeRange === 'custom'
                                            ? `${customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                            : 'Custom Range'
                                        }
                                    </Text>
                                    {timeRange === 'custom' && (
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); setTimeRange('daily'); }}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>

                                {/* Date Range Display */}
                                {timeRange !== 'custom' && stats.overallDateRange && (
                                    <View style={[styles.dateRangeContainer, { backgroundColor: colors.surfaceElevated }]}>
                                        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                                        <Text style={[styles.dateRangeText, { color: colors.textSecondary }]}>
                                            {timeRange === 'daily'
                                                ? `Data from: ${formatDateShort(stats.overallDateRange.end)}`
                                                : `${formatDateShort(stats.overallDateRange.start)} — ${formatDateShort(stats.overallDateRange.end)}`
                                            }
                                        </Text>
                                    </View>
                                )}
                                {timeRange !== 'daily' && timeRange !== 'custom' && stats.overallDateRange && (
                                    <Text style={[styles.dateRangeSubtext, { color: colors.textMuted }]}>
                                        {timeRange === '7day' ? '7 days' : '30 days'} before most recent report
                                    </Text>
                                )}

                                {/* Waterfall Component */}
                                <ErrorBoundary>
                                    <PriceWaterfallMobile
                                        stats={stats}
                                        costs={costs}
                                        packageData={packageOptions}
                                        weightData={weightData}
                                        originData={originOptions}
                                        districtData={districtOptions}
                                        dateRanges={stats.dateRanges}
                                        reportCounts={stats.reportCounts}
                                        actions={actions}
                                    />
                                </ErrorBoundary>
                            </>
                        )}

                        {/* ── Chart Mode: Price Over Time ── */}
                        {viewMode === 'chart' && (
                            <ErrorBoundary>
                                <PriceOverTimeChart
                                    filters={filters}
                                    organicOnly={organicOnly}
                                    selectedVariety={selectedVariety}
                                />
                            </ErrorBoundary>
                        )}

                        {/* ── Comparison Mode: Price Bridge ── */}
                        {viewMode === 'compare' && (
                            <ComparisonContainer
                                filters={filters}
                                organicOnly={organicOnly}
                                selectedVariety={selectedVariety}
                            />
                        )}

                        {/* AI Market Insights — shown in both modes */}
                        <View style={[styles.notesContainer, { backgroundColor: isDark ? colors.surfaceElevated : '#dcfce7', borderColor: isDark ? colors.border : '#bbf7d0' }]}>
                            <View style={styles.notesTitleRow}>
                                <Ionicons name="sparkles" size={18} color={isDark ? colors.accent : '#166534'} />
                                <Text style={[styles.notesTitle, { color: isDark ? colors.accent : '#166534' }]}>AI Market Insights</Text>
                            </View>
                            {aiLoading ? (
                                <View style={styles.aiLoadingContainer}>
                                    <ActivityIndicator size="small" color={colors.accent} />
                                    <Text style={[styles.aiLoadingText, { color: isDark ? colors.textSecondary : '#166534' }]}>Analyzing market data...</Text>
                                </View>
                            ) : (
                                <Text style={[styles.noteItem, { color: isDark ? colors.text : '#14532d' }]}>
                                    {aiInsights || marketNotes || 'Market analysis loading...'}
                                </Text>
                            )}
                        </View>
                    </>
                ) : (
                    <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No data available for this selection.</Text>
                )}
            </ScrollView>

            {/* Cost Configuration Modal */}
            <Modal visible={showCostModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Configure Costs</Text>
                        {Object.entries(costs).map(([key, val]) => (
                            <View key={key} style={styles.inputRow}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{key}</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surfaceElevated, color: colors.text }]}
                                    value={val}
                                    onChangeText={(text) => setCosts(prev => ({ ...prev, [key]: text }))}
                                    keyboardType="numeric"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        ))}
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: colors.accent }]}
                            onPress={() => setShowCostModal(false)}
                        >
                            <Text style={styles.closeButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Variety Selection Modal */}
            <Modal visible={showVarietyModal} animationType="fade" transparent>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowVarietyModal(false)}
                >
                    <View style={[styles.varietyModalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Select Variety</Text>
                        <ScrollView style={styles.varietyList}>
                            <TouchableOpacity
                                style={[
                                    styles.varietyItem,
                                    { borderBottomColor: colors.border },
                                    !selectedVariety && { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }
                                ]}
                                onPress={() => { setSelectedVariety(''); setShowVarietyModal(false); }}
                            >
                                <Text style={[
                                    styles.varietyItemText,
                                    { color: colors.text },
                                    !selectedVariety && { color: colors.accent, fontWeight: '600' }
                                ]}>All Varieties</Text>
                                {!selectedVariety && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                            </TouchableOpacity>
                            {varietyOptions.map(variety => (
                                <TouchableOpacity
                                    key={variety}
                                    style={[
                                        styles.varietyItem,
                                        { borderBottomColor: colors.border },
                                        selectedVariety === variety && { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }
                                    ]}
                                    onPress={() => { setSelectedVariety(variety); setShowVarietyModal(false); }}
                                >
                                    <Text style={[
                                        styles.varietyItemText,
                                        { color: colors.text },
                                        selectedVariety === variety && { color: colors.accent, fontWeight: '600' }
                                    ]}>{variety}</Text>
                                    {selectedVariety === variety && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: colors.textMuted }]}
                            onPress={() => setShowVarietyModal(false)}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Custom Date Range Modal */}
            <Modal visible={showDateModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.dateModalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.dateModalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>Select Date Range</Text>
                            <TouchableOpacity onPress={() => { setShowDateModal(false); setActiveDatePicker(null); }}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Quick Select Presets */}
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                            {[
                                { label: 'Last 7 Days', days: 7 },
                                { label: 'Last 30 Days', days: 30 },
                            ].map(preset => {
                                const maxDate = serverDateBounds.max || new Date();
                                return (
                                    <TouchableOpacity
                                        key={preset.label}
                                        style={[styles.quickPresetChip, { borderColor: colors.border }]}
                                        onPress={() => {
                                            const end = new Date(maxDate);
                                            const start = new Date(maxDate);
                                            start.setDate(start.getDate() - preset.days);
                                            if (serverDateBounds.min && start < serverDateBounds.min) {
                                                start.setTime(serverDateBounds.min.getTime());
                                            }
                                            setCustomStartDate(start);
                                            setCustomEndDate(end);
                                            setActiveDatePicker(null);
                                        }}
                                    >
                                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{preset.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Data availability hint */}
                        {serverDateBounds.min && serverDateBounds.max && (
                            <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 12 }}>
                                Data available: {serverDateBounds.min.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {serverDateBounds.max.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}  •  Max 1 month window
                            </Text>
                        )}

                        {/* Date Cards */}
                        <View style={styles.dateCardsRow}>
                            <TouchableOpacity
                                style={[
                                    styles.dateCard,
                                    { backgroundColor: colors.surfaceElevated, borderColor: activeDatePicker === 'start' ? colors.accent : colors.border }
                                ]}
                                onPress={() => setActiveDatePicker(activeDatePicker === 'start' ? null : 'start')}
                            >
                                <Text style={[styles.dateCardLabel, { color: colors.textMuted }]}>Start Date</Text>
                                <Text style={[styles.dateCardValue, { color: colors.text }]}>
                                    {customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </Text>
                            </TouchableOpacity>
                            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} style={{ marginHorizontal: 8 }} />
                            <TouchableOpacity
                                style={[
                                    styles.dateCard,
                                    { backgroundColor: colors.surfaceElevated, borderColor: activeDatePicker === 'end' ? colors.accent : colors.border }
                                ]}
                                onPress={() => setActiveDatePicker(activeDatePicker === 'end' ? null : 'end')}
                            >
                                <Text style={[styles.dateCardLabel, { color: colors.textMuted }]}>End Date</Text>
                                <Text style={[styles.dateCardValue, { color: colors.text }]}>
                                    {customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Native Date Picker */}
                        {activeDatePicker && (
                            <View style={styles.datePickerWrapper}>
                                <DateTimePicker
                                    value={activeDatePicker === 'start' ? customStartDate : customEndDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    maximumDate={activeDatePicker === 'start'
                                        ? new Date(customEndDate)
                                        : (() => {
                                            const maxFromSpan = new Date(customStartDate);
                                            maxFromSpan.setDate(maxFromSpan.getDate() + 31);
                                            const serverMax = serverDateBounds.max || new Date();
                                            return maxFromSpan < serverMax ? maxFromSpan : serverMax;
                                        })()
                                    }
                                    minimumDate={activeDatePicker === 'start'
                                        ? (serverDateBounds.min || undefined)
                                        : customStartDate
                                    }
                                    onChange={(event, selectedDate) => {
                                        if (Platform.OS === 'android') setActiveDatePicker(null);
                                        if (selectedDate) {
                                            if (activeDatePicker === 'start') {
                                                setCustomStartDate(selectedDate);
                                                const maxEnd = new Date(selectedDate);
                                                maxEnd.setDate(maxEnd.getDate() + 31);
                                                const serverMax = serverDateBounds.max || new Date();
                                                const cappedEnd = maxEnd < serverMax ? maxEnd : serverMax;
                                                if (customEndDate > cappedEnd) setCustomEndDate(cappedEnd);
                                                if (customEndDate < selectedDate) {
                                                    setCustomEndDate(new Date(Math.min(cappedEnd.getTime(), selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000)));
                                                }
                                            } else {
                                                setCustomEndDate(selectedDate);
                                            }
                                        }
                                    }}
                                    themeVariant={isDark ? 'dark' : 'light'}
                                    style={{ height: 150 }}
                                />
                            </View>
                        )}

                        {/* Actions */}
                        <View style={styles.dateModalActions}>
                            <TouchableOpacity
                                style={[styles.dateModalCancel, { borderColor: colors.border }]}
                                onPress={() => { setShowDateModal(false); setActiveDatePicker(null); }}
                            >
                                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dateModalApply, { backgroundColor: colors.accent }]}
                                onPress={() => {
                                    setTimeRange('custom');
                                    setShowDateModal(false);
                                    setActiveDatePicker(null);
                                }}
                            >
                                <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 15 }}>Apply Range</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Overflow Menu Modal */}
            <Modal visible={showOverflowMenu} animationType="fade" transparent>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOverflowMenu(false)}
                >
                    <View style={[styles.overflowMenu, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity
                            style={[styles.overflowItem, { borderBottomColor: colors.border }]}
                            onPress={() => {
                                setShowOverflowMenu(false);
                                setViewMode('compare');
                            }}
                        >
                            <Ionicons name="git-compare-outline" size={20} color={colors.text} />
                            <Text style={[styles.overflowItemText, { color: colors.text }]}>Compare Periods</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.overflowItem, { borderBottomColor: colors.border }]}
                            onPress={() => {
                                setShowOverflowMenu(false);
                                setShowCostModal(true);
                            }}
                        >
                            <Ionicons name="calculator-outline" size={20} color={colors.text} />
                            <Text style={[styles.overflowItemText, { color: colors.text }]}>Configure Costs</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.overflowCancel}
                            onPress={() => setShowOverflowMenu(false)}
                        >
                            <Text style={[styles.overflowCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderColor: '#e2e8f0'
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtnText: { color: '#1e293b', fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    settingsText: { color: '#22c55e', fontSize: 16, fontWeight: '600' },
    scrollContent: { padding: 16, paddingBottom: 40 },
    dateRangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignSelf: 'center',
    },
    dateRangeText: { fontSize: 13, fontWeight: '500' },
    dateRangeSubtext: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginBottom: 16 },
    subtitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 20 },
    notesContainer: { backgroundColor: '#dcfce7', padding: 16, borderRadius: 16, marginTop: 24, borderWidth: 1, borderColor: '#bbf7d0' },
    notesTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    notesTitle: { fontWeight: 'bold', color: '#166534', fontSize: 16 },
    noteItem: { color: '#14532d', marginBottom: 4, fontSize: 14, lineHeight: 20 },
    aiLoadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiLoadingText: { color: '#166534', fontSize: 14, fontStyle: 'italic' },
    noDataText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1e293b' },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    inputLabel: { fontSize: 16, textTransform: 'capitalize', color: '#64748b' },
    input: { backgroundColor: '#f1f5f9', width: 100, padding: 12, borderRadius: 10, textAlign: 'right', fontSize: 16 },
    closeButton: { backgroundColor: '#22c55e', padding: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' },
    closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    timeRangeContainer: {
        flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 4,
        backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, alignSelf: 'center',
    },
    timeRangeBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: 'transparent' },
    timeRangeBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    customDateBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1,
        alignSelf: 'center', marginBottom: 12,
    },
    customDateBtnText: { fontSize: 13, fontWeight: '600' },
    varietySelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12,
    },
    varietySelectorLabel: { fontSize: 14, fontWeight: '500' },
    varietySelectorValue: { fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 8 },
    varietyModalContent: { width: '90%', maxHeight: '70%', borderRadius: 16, padding: 0, overflow: 'hidden' },
    varietyList: { maxHeight: 300 },
    varietyItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    },
    varietyItemText: { fontSize: 15, color: '#374151' },
    organicCheckbox: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: 12, marginBottom: 16,
    },
    checkbox: {
        width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#22c55e',
        marginRight: 10, justifyContent: 'center', alignItems: 'center',
    },
    checkboxChecked: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
    checkboxDisabled: { borderColor: '#94a3b8', backgroundColor: 'transparent' },
    organicLabel: { fontSize: 15, fontWeight: '600' },
    dateModalContent: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        padding: 24, maxHeight: '80%',
    },
    dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    quickPresetChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
    dateCardsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    dateCard: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
    dateCardLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    dateCardValue: { fontSize: 15, fontWeight: '700' },
    datePickerWrapper: { alignItems: 'center', marginBottom: 16, overflow: 'hidden', borderRadius: 12 },
    dateModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    dateModalCancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    dateModalApply: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    overflowMenu: {
        width: '80%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    overflowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    overflowItemText: {
        fontSize: 16,
        fontWeight: '500',
    },
    overflowCancel: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    overflowCancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
