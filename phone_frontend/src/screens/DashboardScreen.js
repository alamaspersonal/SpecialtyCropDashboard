import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPrices } from '../services/api';
import PriceWaterfallMobile from '../components/PriceWaterfallMobile';
import { saveFavorite, removeFavorite, checkIsFavorite } from '../services/favorites';
import { generateMarketInsights } from '../services/cerebrasApi';
import { useTheme } from '../context/ThemeContext';

// Package weight lookup (simplified - ideally fetch from backend)
const PACKAGE_WEIGHTS = {
    // Common package weights
    "25 lb cartons": { weight_lbs: 25, units: null },
    "50 lb cartons": { weight_lbs: 50, units: null },
    "40 lb cartons": { weight_lbs: 40, units: null },
    "30 lb cartons": { weight_lbs: 30, units: null },
    "cartons": { weight_lbs: 25, units: null },
    "bushel cartons": { weight_lbs: 30, units: null },
    "1 1/9 bushel cartons": { weight_lbs: 30, units: null },
    "flats 12 1-pint baskets": { weight_lbs: 12, units: null },
    "flats 8 1-lb containers": { weight_lbs: 8, units: null },
};

export default function DashboardScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { filters } = route.params;
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [marketNotes, setMarketNotes] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    
    // AI Insights State
    const [aiInsights, setAiInsights] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Data Partitioning
    const [terminalData, setTerminalData] = useState([]);
    const [shippingData, setShippingData] = useState([]);
    const [retailData, setRetailData] = useState([]);
    const [packageOptions, setPackageOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedPackages, setSelectedPackages] = useState({ terminal: '', shipping: '', retail: '' });
    const [weightData, setWeightData] = useState({ terminal: null, shipping: null, retail: null });

    // Time Range Selection
    const [timeRange, setTimeRange] = useState('daily'); // 'daily' or '7day'

    // Costs State
    const [showCostModal, setShowCostModal] = useState(false);
    const [costs, setCosts] = useState({
        packing: '2.50',
        cooling: '0.80',
        inspection: '0.15',
        commission: '0.50'
    });



    useEffect(() => {
        checkFavStatus();
        const fetchPrices = async () => {
            setLoading(true);
            try {
                // Determine days parameter based on timeRange
                const daysParam = timeRange === '7day' ? 7 : timeRange === '30day' ? 30 : null;

                // Prepare filters: Always exclude specific date to rely on latest data or ranges
                const apiFilters = { ...filters };
                delete apiFilters.date;
                delete apiFilters.package;

                console.log('[DEBUG] Fetching prices with:', { filters: apiFilters, limit: 500, daysParam, timeRange });

                // Fetching raw prices with higher limit to get mix
                const data = await getPrices(apiFilters, 500, daysParam);
                console.log('[DEBUG] Received data length:', data?.length);
                console.log('[DEBUG] Sample data:', data?.slice(0, 3));
                
                setPriceData(data); // Keep raw fallback

                // Partition Data - Using actual market_type values from CSV
                const tData = data.filter(d => d.market_type === 'Terminal' || !d.market_type);
                const sData = data.filter(d => d.market_type === 'Shipping' || d.market_type === 'Shipping Point');
                const rData = data.filter(d => d.market_type === 'Retail' || d.market_type === 'Retail - Specialty Crops');

                console.log('[DEBUG] Partitioned data - Terminal:', tData.length, 'Shipping:', sData.length, 'Retail:', rData.length);

                setTerminalData(tData);
                setShippingData(sData);
                setRetailData(rData);

                // Extract Packages
                const getPackages = (arr) => [...new Set(arr.map(d => d.package).filter(Boolean))].sort();
                const tPackages = getPackages(tData);
                const sPackages = getPackages(sData);
                const rPackages = getPackages(rData);

                setPackageOptions({
                    terminal: tPackages,
                    shipping: sPackages,
                    retail: rPackages
                });

                // Preserve selected packages if still valid, otherwise set defaults
                setSelectedPackages(prev => ({
                    terminal: tPackages.includes(prev.terminal) ? prev.terminal : (tPackages[0] || ''),
                    shipping: sPackages.includes(prev.shipping) ? prev.shipping : (sPackages[0] || ''),
                    retail: rPackages.includes(prev.retail) ? prev.retail : (rPackages[0] || '')
                }));

                if (data.length > 0 && data[0].market_tone_comments) {
                    setMarketNotes(data[0].market_tone_comments);
                } else {
                    setMarketNotes('');
                }
            } catch (err) {
                console.error("Error fetching prices:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPrices();
    }, [filters, timeRange]);

    // Generate AI Insights when stats are ready
    useEffect(() => {
        const fetchAIInsights = async () => {
            if (!priceData.length || !filters.commodity) return;
            
            setAiLoading(true);
            try {
                // Get all market notes from the data
                const allNotes = priceData
                    .map(d => d.market_tone_comments)
                    .filter(Boolean)
                    .slice(0, 5);
                
                // Build stats object for AI
                const aiStats = {
                    terminal: {
                        avg: terminalData.length > 0 
                            ? terminalData.reduce((acc, d) => acc + (d.low_price || 0), 0) / terminalData.length 
                            : 0,
                        pct_change: 0 // Would need historical data for real calculation
                    },
                    shipping: {
                        avg: shippingData.length > 0 
                            ? shippingData.reduce((acc, d) => acc + (d.low_price || 0), 0) / shippingData.length 
                            : 0,
                        pct_change: 0
                    },
                    retail: {
                        avg: retailData.length > 0 
                            ? retailData.reduce((acc, d) => acc + (d.low_price || 0), 0) / retailData.length 
                            : 0,
                        pct_change: 0
                    }
                };
                
                const insights = await generateMarketInsights(
                    filters.commodity,
                    aiStats,
                    allNotes
                );
                setAiInsights(insights);
            } catch (error) {
                console.error('Error generating AI insights:', error);
                setAiInsights('');
            } finally {
                setAiLoading(false);
            }
        };
        
        fetchAIInsights();
    }, [priceData, filters.commodity, terminalData, shippingData, retailData]);

    // Update weightData when selected packages change
    useEffect(() => {
        const lookupWeight = (pkg) => {
            if (!pkg) return null;
            // Try exact match
            if (PACKAGE_WEIGHTS[pkg]) return PACKAGE_WEIGHTS[pkg];
            // Try partial match
            for (const [key, val] of Object.entries(PACKAGE_WEIGHTS)) {
                if (pkg.toLowerCase().includes(key.toLowerCase()) || 
                    key.toLowerCase().includes(pkg.toLowerCase())) {
                    return val;
                }
            }
            // Extract weight from package name (e.g., "25 lb cartons" -> 25)
            const match = pkg.match(/(\d+)\s*(?:lb|lbs)/i);
            if (match) {
                return { weight_lbs: parseInt(match[1]), units: null };
            }
            return null;
        };

        setWeightData({
            terminal: lookupWeight(selectedPackages.terminal),
            shipping: lookupWeight(selectedPackages.shipping),
            retail: lookupWeight(selectedPackages.retail),
        });
    }, [selectedPackages]);

    const checkFavStatus = async () => {
        const status = await checkIsFavorite(filters.commodity);
        setIsFavorite(status);
    };

    const toggleFavorite = async () => {
        if (isFavorite) {
            await removeFavorite(filters.commodity);
            setIsFavorite(false);
        } else {
            await saveFavorite(filters);
            setIsFavorite(true);
        }
    };
    // Calculate averages
    const calculateStats = () => {
        if (!priceData.length) return null;

        // Filter data by time range
        const filterByTimeRange = (data) => {
            if (timeRange === 'daily') {
                // Get the most recent date in the data
                const dates = data.map(d => new Date(d.report_date)).filter(d => !isNaN(d));
                if (dates.length === 0) return data;
                const maxDate = new Date(Math.max(...dates));
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return itemDate.toDateString() === maxDate.toDateString();
                });
            } else {
                // 7-day mode: backend already filters by last 7 days, so use all data
                return data;
            }
        };

        const filteredTerminal = filterByTimeRange(terminalData);
        const filteredShipping = filterByTimeRange(shippingData);
        const filteredRetail = filterByTimeRange(retailData);

        // Filter by selected package if set
        const getAvg = (data, userPackage, priceField) => {
            if (!data.length) return 0;
            const filtered = userPackage ? data.filter(d => d.package === userPackage) : data;
            if (!filtered.length) return 0;
            return filtered.reduce((acc, curr) => acc + (curr[priceField] || 0), 0) / filtered.length;
        };

        const terminalLowAvg = getAvg(filteredTerminal, selectedPackages.terminal, 'low_price');
        const terminalHighAvg = getAvg(filteredTerminal, selectedPackages.terminal, 'high_price');

        // If we have real shipping data, use it. Otherwise derive it.
        let shippingLowAvg = getAvg(filteredShipping, selectedPackages.shipping, 'low_price');
        let shippingHighAvg = getAvg(filteredShipping, selectedPackages.shipping, 'high_price');

        // Retail data - use wtd_avg_price if available, otherwise use low/high prices
        // Try wtd_avg_price first (retail-specific field)
        let retailLowAvg = getAvg(filteredRetail, selectedPackages.retail, 'wtd_avg_price');
        let retailHighAvg = getAvg(filteredRetail, selectedPackages.retail, 'wtd_avg_price');
        
        // Fall back to low_price/high_price if wtd_avg_price is not available
        if (retailLowAvg === 0) {
            retailLowAvg = getAvg(filteredRetail, selectedPackages.retail, 'low_price');
            retailHighAvg = getAvg(filteredRetail, selectedPackages.retail, 'high_price');
        }
        
        console.log('[DEBUG] Retail data - count:', filteredRetail.length, 'lowAvg:', retailLowAvg, 'highAvg:', retailHighAvg);

        // Fallback Mock Logic if no real shipping data found
        let isShippingEstimated = false;
        if (shippingLowAvg === 0 && terminalLowAvg > 0) {
            shippingLowAvg = terminalLowAvg * 0.6;
            shippingHighAvg = terminalHighAvg * 0.6;
            isShippingEstimated = true;
        }

        return {
            terminal_low_avg: terminalLowAvg,
            terminal_high_avg: terminalHighAvg,
            shipping_low_avg: shippingLowAvg,
            shipping_high_avg: shippingHighAvg,
            retail_low_avg: retailLowAvg,
            retail_high_avg: retailHighAvg,
            is_shipping_estimated: isShippingEstimated,
            date: filters.date || 'Today',
            timeRange: timeRange
        };
    };
    const stats = calculateStats();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Price Dashboard</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={toggleFavorite}>
                        <Ionicons name={isFavorite ? "star" : "star-outline"} size={24} color={isFavorite ? '#eab308' : colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowCostModal(true)}>
                        <Ionicons name="settings-outline" size={24} color={colors.accent} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 50 }} />
                ) : stats ? (
                    <>
                        <Text style={[styles.subtitle, { color: colors.text }]}>{filters.commodity || 'Commodity'}</Text>

                        {/* Time Range Toggle */}
                        <View style={[styles.timeRangeContainer, { backgroundColor: colors.surfaceElevated }]}>
                            <TouchableOpacity
                                style={[styles.timeRangeBtn, timeRange === 'daily' && { backgroundColor: colors.accent }]}
                                onPress={() => setTimeRange('daily')}
                            >
                                <Text style={[styles.timeRangeBtnText, { color: colors.textSecondary }, timeRange === 'daily' && { color: '#0f172a' }]}>Daily</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.timeRangeBtn, timeRange === '7day' && { backgroundColor: colors.accent }]}
                                onPress={() => setTimeRange('7day')}
                            >
                                <Text style={[styles.timeRangeBtnText, { color: colors.textSecondary }, timeRange === '7day' && { color: '#0f172a' }]}>7-Day</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.timeRangeBtn, timeRange === '30day' && { backgroundColor: colors.accent }]}
                                onPress={() => setTimeRange('30day')}
                            >
                                <Text style={[styles.timeRangeBtnText, { color: colors.textSecondary }, timeRange === '30day' && { color: '#0f172a' }]}>30-Day</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Waterfall Component */}
                        <PriceWaterfallMobile
                            stats={stats}
                            costs={costs}
                            packageData={packageOptions}
                            weightData={weightData}
                            actions={{
                                selectedPackages,
                                setPackage: (type, val) => setSelectedPackages(prev => ({ ...prev, [type]: val }))
                            }}
                        />

                        {/* AI Market Insights */}
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

    // Time Range Toggle - Updated to green theme
    timeRangeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 8,
        backgroundColor: '#f1f5f9',
        padding: 4,
        borderRadius: 12,
        alignSelf: 'center',
    },
    timeRangeBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: 'transparent',
    },
    timeRangeBtnActive: {
        backgroundColor: '#22c55e',
    },
    timeRangeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    timeRangeBtnTextActive: {
        color: 'white',
    },
});
