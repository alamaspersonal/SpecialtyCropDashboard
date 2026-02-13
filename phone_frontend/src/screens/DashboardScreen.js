import React, { useState, useEffect, useRef } from 'react';
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
    "cartons 2 layer": { weight_lbs: 25, units: null },
    
    // Unit-based packages (count/mesh bags/trays)
    "4 count mesh bags": { weight_lbs: null, units: 4 },
    "5 count mesh bags": { weight_lbs: null, units: 5 },
    "3 count mesh bags": { weight_lbs: null, units: 3 },
    "3 count filmbag": { weight_lbs: null, units: 3 },
    "6 ct trays filmwrapped": { weight_lbs: null, units: 6 },
    "each": { weight_lbs: null, units: 1 },
    "per each": { weight_lbs: null, units: 1 },
};

export default function DashboardScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { filters, organicOnly: initialOrganicOnly } = route.params;
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [marketNotes, setMarketNotes] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    
    // AI Insights State
    const [aiInsights, setAiInsights] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const cachedDailyInsights = useRef('');
    const aiGeneratedForKey = useRef('');

    // Data Partitioning
    const [terminalData, setTerminalData] = useState([]);
    const [shippingData, setShippingData] = useState([]);
    const [retailData, setRetailData] = useState([]);
    const [packageOptions, setPackageOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedPackages, setSelectedPackages] = useState({ terminal: '', shipping: '', retail: '' });
    const [weightData, setWeightData] = useState({ terminal: null, shipping: null, retail: null });

    // Origin and District Selection
    const [originOptions, setOriginOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedOrigins, setSelectedOrigins] = useState({ terminal: '', shipping: '', retail: '' });
    const [districtOptions, setDistrictOptions] = useState({ terminal: [], shipping: [], retail: [] });
    const [selectedDistricts, setSelectedDistricts] = useState({ terminal: '', shipping: '', retail: '' });

    // Time Range Selection
    const [timeRange, setTimeRange] = useState('daily'); // 'daily' or '7day'

    // Top-level Filter Controls
    // Top-level Filter Controls
    const [organicOnly, setOrganicOnly] = useState(initialOrganicOnly || false);
    const [hasOrganicData, setHasOrganicData] = useState(false);
    const [varietyOptions, setVarietyOptions] = useState([]);
    // Initialize selectedVariety from navigation params if available
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



    useEffect(() => {
        checkFavStatus();
        const fetchPrices = async () => {
            setLoading(true);
            try {
                // Always fetch all data — time range filtering is done per-market-type in calculateStats
                const apiFilters = { ...filters };
                delete apiFilters.date;
                delete apiFilters.package;
                delete apiFilters.variety;

                console.log('[DEBUG] Fetching prices with:', { filters: apiFilters, limit: 500, timeRange });

                // Fetching raw prices with higher limit to get mix
                const data = await getPrices(apiFilters, 500, null);
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

                // Extract varieties from all data
                const allVarieties = [...new Set(data.map(d => d.variety).filter(Boolean))].sort();
                setVarietyOptions(allVarieties);

                // Check if any organic data exists
                const organicExists = data.some(d => d.organic === 'yes');
                setHasOrganicData(organicExists);
                // If no organic data, reset the organic filter
                if (!organicExists && organicOnly) {
                    setOrganicOnly(false);
                }

                // Extract Packages, Origins, and Districts
                const getUnique = (arr, field) => [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();
                
                const tPackages = getUnique(tData, 'package');
                const sPackages = getUnique(sData, 'package');
                const rPackages = getUnique(rData, 'package');

                const tOrigins = getUnique(tData, 'origin');
                const sOrigins = getUnique(sData, 'origin');
                const rOrigins = getUnique(rData, 'origin');

                const tDistricts = getUnique(tData, 'district');
                const sDistricts = getUnique(sData, 'district');
                const rDistricts = getUnique(rData, 'district');

                setPackageOptions({
                    terminal: tPackages,
                    shipping: sPackages,
                    retail: rPackages
                });

                setOriginOptions({
                    terminal: tOrigins,
                    shipping: sOrigins,
                    retail: rOrigins
                });

                setDistrictOptions({
                    terminal: tDistricts,
                    shipping: sDistricts,
                    retail: rDistricts
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
    }, [filters]);

    // Generate AI Insights — only for daily view, regenerate on filter changes
    const aiCacheKey = `${filters.commodity}|${selectedVariety}|${organicOnly}|${JSON.stringify(selectedOrigins)}|${JSON.stringify(selectedPackages)}`;
    useEffect(() => {
        // If not daily, just show cached insight (no API call)
        if (timeRange !== 'daily') {
            if (cachedDailyInsights.current) {
                setAiInsights(cachedDailyInsights.current);
            }
            return;
        }

        // If we already generated insights for this exact filter combo, reuse cache
        if (aiGeneratedForKey.current === aiCacheKey && cachedDailyInsights.current) {
            setAiInsights(cachedDailyInsights.current);
            return;
        }

        const fetchAIInsights = async () => {
            if (!priceData.length || !filters.commodity) return;
            
            // Build Shipping Point data (supply/demand focused)
            const shippingComments = {
                supply: shippingData.map(d => d.supply_tone_comments).filter(Boolean),
                demand: shippingData.map(d => d.demand_tone_comments).filter(Boolean),
                market: shippingData.map(d => d.market_tone_comments).filter(Boolean),
                commodity: shippingData.map(d => d.commodity_comments).filter(Boolean)
            };
            
            // Build Terminal Market data (offerings/reporter focused)
            const terminalComments = {
                offerings: terminalData.map(d => d.offerings_comments).filter(Boolean),
                reporter: terminalData.map(d => d.reporter_comment).filter(Boolean),
                market: terminalData.map(d => d.market_tone_comments).filter(Boolean),
                commodity: terminalData.map(d => d.commodity_comments).filter(Boolean)
            };
            
            // Check if we have any comments to analyze
            const hasShippingComments = Object.values(shippingComments).some(arr => arr.length > 0);
            const hasTerminalComments = Object.values(terminalComments).some(arr => arr.length > 0);
            
            if (!hasShippingComments && !hasTerminalComments) {
                setAiInsights('No market notes available for this selection.');
                setAiLoading(false);
                return;
            }
            
            // Build date info for the AI prompt
            const getDateRange = (data) => {
                const dates = data.map(d => d.report_date).filter(Boolean).sort();
                if (dates.length === 0) return null;
                return { start: dates[0], end: dates[dates.length - 1], reportCount: data.length };
            };

            const dateInfo = {
                shipping: getDateRange(shippingData),
                terminal: getDateRange(terminalData),
            };

            // Build filter context for the AI
            const filterContext = {
                variety: selectedVariety || null,
                organic: organicOnly || false,
                origin: selectedOrigins.terminal || selectedOrigins.shipping || null,
                package: selectedPackages.terminal || selectedPackages.shipping || null,
            };

            setAiLoading(true);
            try {
                const insights = await generateMarketInsights(
                    filters.commodity,
                    shippingComments,
                    terminalComments,
                    dateInfo,
                    filterContext
                );
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

    // Cascading filter logic: recalculate options and validate selections
    useEffect(() => {
        if (!terminalData.length && !shippingData.length && !retailData.length) return;

        // Helper: Filter base data by top-level selections
        const getBaseData = (data) => {
            let filtered = data;
            if (organicOnly) {
                filtered = filtered.filter(d => d.organic === 'yes');
            }
            if (selectedVariety) {
                filtered = filtered.filter(d => d.variety === selectedVariety);
            }
            return filtered;
        };

        const tBase = getBaseData(terminalData);
        const sBase = getBaseData(shippingData);
        const rBase = getBaseData(retailData);

        const getUnique = (arr, field) => [...new Set(arr.map(d => d[field]).filter(Boolean))].sort();

        // Helper: Calculate options for a specific market type based on OTHER current filters
        const getOptionsForType = (baseData, currentPkg, currentOrg, currentDist) => {
            // Packages: filtered by Origin + District
            const pkgData = baseData.filter(d => 
                (!currentOrg || d.origin === currentOrg) && 
                (!currentDist || d.district === currentDist)
            );

            // Origins: filtered by Package + District
            const orgData = baseData.filter(d => 
                (!currentPkg || d.package === currentPkg) && 
                (!currentDist || d.district === currentDist)
            );

            // Districts: filtered by Package + Origin
            const distData = baseData.filter(d => 
                (!currentPkg || d.package === currentPkg) && 
                (!currentOrg || d.origin === currentOrg)
            );

            return {
                packages: getUnique(pkgData, 'package'),
                origins: getUnique(orgData, 'origin'),
                districts: getUnique(distData, 'district')
            };
        };

        // Calculate options for each market type
        const tOpts = getOptionsForType(tBase, selectedPackages.terminal, selectedOrigins.terminal, selectedDistricts.terminal);
        const sOpts = getOptionsForType(sBase, selectedPackages.shipping, selectedOrigins.shipping, selectedDistricts.shipping);
        const rOpts = getOptionsForType(rBase, selectedPackages.retail, selectedOrigins.retail, selectedDistricts.retail);

        // Update Options States
        // We use JSON.stringify to compare and avoid unnecessary re-renders if content is identical
        const newPkgOpts = { terminal: tOpts.packages, shipping: sOpts.packages, retail: rOpts.packages };
        setPackageOptions(prev => JSON.stringify(prev) === JSON.stringify(newPkgOpts) ? prev : newPkgOpts);

        const newOrgOpts = { terminal: tOpts.origins, shipping: sOpts.origins, retail: rOpts.origins };
        setOriginOptions(prev => JSON.stringify(prev) === JSON.stringify(newOrgOpts) ? prev : newOrgOpts);

        const newDistOpts = { terminal: tOpts.districts, shipping: sOpts.districts, retail: rOpts.districts };
        setDistrictOptions(prev => JSON.stringify(prev) === JSON.stringify(newDistOpts) ? prev : newDistOpts);


        // Helper: Validate and Auto-Select
        const validate = (options, currentVal) => {
            if (options.length === 0) return '';
            if (options.length === 1) return options[0]; // Auto-select single option
            if (options.includes(currentVal)) return currentVal; // Keep valid selection
            return ''; // Reset to 'All' if invalid
        };

        // Update Selections if needed (checking current vs new valid)
        // using functional updates to check previous state and avoid loops
        setSelectedPackages(prev => {
            const next = {
                terminal: validate(tOpts.packages, prev.terminal),
                shipping: validate(sOpts.packages, prev.shipping),
                retail: validate(rOpts.packages, prev.retail)
            };
            return (prev.terminal === next.terminal && prev.shipping === next.shipping && prev.retail === next.retail) ? prev : next;
        });

        setSelectedOrigins(prev => {
            const next = {
                terminal: validate(tOpts.origins, prev.terminal),
                shipping: validate(sOpts.origins, prev.shipping),
                retail: validate(rOpts.origins, prev.retail)
            };
            return (prev.terminal === next.terminal && prev.shipping === next.shipping && prev.retail === next.retail) ? prev : next;
        });

        setSelectedDistricts(prev => {
            const next = {
                terminal: validate(tOpts.districts, prev.terminal),
                shipping: validate(sOpts.districts, prev.shipping),
                retail: validate(rOpts.districts, prev.retail)
            };
            return (prev.terminal === next.terminal && prev.shipping === next.shipping && prev.retail === next.retail) ? prev : next;
        });

    }, [
        selectedVariety, organicOnly, 
        terminalData, shippingData, retailData, 
        selectedPackages, selectedOrigins, selectedDistricts
    ]);

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
    // Helper: extract date range from data array
    const getDateRangeFromData = (data) => {
        const dates = data.map(d => d.report_date).filter(Boolean).sort();
        if (dates.length === 0) return null;
        return { start: dates[0], end: dates[dates.length - 1] };
    };

    // Helper: format a date string for display
    const formatDateShort = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Calculate averages
    const calculateStats = () => {
        if (!priceData.length) return null;

        // Filter data by time range — each dataset uses its own latest date as anchor
        const filterByTimeRange = (data) => {
            const dates = data.map(d => new Date(d.report_date)).filter(d => !isNaN(d));
            if (dates.length === 0) return data;
            const maxDate = new Date(Math.max(...dates));

            if (timeRange === 'daily') {
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return itemDate.toDateString() === maxDate.toDateString();
                });
            } else {
                // 7-day / 30-day: N days before THIS dataset's latest date
                const days = timeRange === '7day' ? 7 : 30;
                const cutoff = new Date(maxDate);
                cutoff.setDate(cutoff.getDate() - days);
                return data.filter(d => {
                    const itemDate = new Date(d.report_date);
                    return !isNaN(itemDate) && itemDate >= cutoff;
                });
            }
        };

        // Apply organic filter first
        let baseTerminal = terminalData;
        let baseShipping = shippingData;
        let baseRetail = retailData;

        if (organicOnly) {
            baseTerminal = baseTerminal.filter(d => d.organic === 'yes');
            baseShipping = baseShipping.filter(d => d.organic === 'yes');
            baseRetail = baseRetail.filter(d => d.organic === 'yes');
        }

        if (selectedVariety) {
            baseTerminal = baseTerminal.filter(d => d.variety === selectedVariety);
            baseShipping = baseShipping.filter(d => d.variety === selectedVariety);
            baseRetail = baseRetail.filter(d => d.variety === selectedVariety);
        }

        const filteredTerminal = filterByTimeRange(baseTerminal);
        const filteredShipping = filterByTimeRange(baseShipping);
        const filteredRetail = filterByTimeRange(baseRetail);

        // Filter by selected package, origin, and district
        const filterData = (data, type) => {
            let filtered = data;
            if (selectedPackages[type]) {
                filtered = filtered.filter(d => d.package === selectedPackages[type]);
            }
            if (selectedOrigins[type]) {
                filtered = filtered.filter(d => d.origin === selectedOrigins[type]);
            }
            if (selectedDistricts[type]) {
                filtered = filtered.filter(d => d.district === selectedDistricts[type]);
            }
            return filtered;
        };

        // Calculate average price from available price fields (matching backend logic)
        const calcAvgPrice = (data) => {
            if (!data.length) return 0;
            
            const priceFields = ['low_price', 'high_price', 'mostly_low_price', 'mostly_high_price'];
            const fieldAvgs = [];
            
            priceFields.forEach(field => {
                const validValues = data.map(d => d[field]).filter(v => v !== null && v !== undefined && !isNaN(v));
                if (validValues.length > 0) {
                    fieldAvgs.push(validValues.reduce((a, b) => a + b, 0) / validValues.length);
                }
            });
            
            if (fieldAvgs.length === 0) {
                // Fallback to wtd_avg_price for retail
                const wtdValues = data.map(d => d.wtd_avg_price).filter(v => v !== null && v !== undefined && !isNaN(v));
                if (wtdValues.length > 0) {
                    return wtdValues.reduce((a, b) => a + b, 0) / wtdValues.length;
                }
                return 0;
            }
            
            return fieldAvgs.reduce((a, b) => a + b, 0) / fieldAvgs.length;
        };

        const terminalFiltered = filterData(filteredTerminal, 'terminal');
        const shippingFiltered = filterData(filteredShipping, 'shipping');
        const retailFiltered = filterData(filteredRetail, 'retail');

        let terminalAvg = calcAvgPrice(terminalFiltered);
        let shippingAvg = calcAvgPrice(shippingFiltered);
        let retailAvg = calcAvgPrice(retailFiltered);
        
        console.log('[DEBUG] Avg prices - Terminal:', terminalAvg, 'Shipping:', shippingAvg, 'Retail:', retailAvg);

        // Fallback Mock Logic if no real shipping data found
        let isShippingEstimated = false;
        if (shippingAvg === 0 && terminalAvg > 0) {
            shippingAvg = terminalAvg * 0.6;
            isShippingEstimated = true;
        }

        // Fallback for retail if no data
        let isRetailEstimated = false;
        if (retailAvg === 0 && terminalAvg > 0) {
            retailAvg = terminalAvg * 1.4;
            isRetailEstimated = true;
        }

        // Compute per-market-type date ranges and report counts
        const dateRanges = {
            terminal: getDateRangeFromData(terminalFiltered),
            shipping: getDateRangeFromData(shippingFiltered),
            retail: getDateRangeFromData(retailFiltered),
        };
        const reportCounts = {
            terminal: terminalFiltered.length,
            shipping: shippingFiltered.length,
            retail: retailFiltered.length,
        };

        // Overall date range across all filtered data
        const allDates = [...terminalFiltered, ...shippingFiltered, ...retailFiltered]
            .map(d => d.report_date).filter(Boolean).sort();
        const overallDateRange = allDates.length > 0
            ? { start: allDates[0], end: allDates[allDates.length - 1] }
            : null;

        return {
            terminal_avg: terminalAvg,
            shipping_avg: shippingAvg,
            retail_avg: retailAvg,
            is_shipping_estimated: isShippingEstimated,
            is_retail_estimated: isRetailEstimated,
            date: filters.date || 'Today',
            timeRange: timeRange,
            dateRanges,
            reportCounts,
            overallDateRange,
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
                                <Text style={[styles.timeRangeBtnText, { color: colors.textSecondary }, timeRange === '7day' && { color: '#0f172a' }]}>Last 7 Days</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.timeRangeBtn, timeRange === '30day' && { backgroundColor: colors.accent }]}
                                onPress={() => setTimeRange('30day')}
                            >
                                <Text style={[styles.timeRangeBtnText, { color: colors.textSecondary }, timeRange === '30day' && { color: '#0f172a' }]}>Last 30 Days</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Date Range Display */}
                        {stats.overallDateRange && (
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
                        {timeRange !== 'daily' && stats.overallDateRange && (
                            <Text style={[styles.dateRangeSubtext, { color: colors.textMuted }]}>
                                {timeRange === '7day' ? '7 days' : '30 days'} before most recent report
                            </Text>
                        )}

                        {/* Waterfall Component */}
                        <PriceWaterfallMobile
                            stats={stats}
                            costs={costs}
                            packageData={packageOptions}
                            weightData={weightData}
                            originData={originOptions}
                            districtData={districtOptions}
                            dateRanges={stats.dateRanges}
                            reportCounts={stats.reportCounts}
                            actions={{
                                selectedPackages,
                                setPackage: (type, val) => setSelectedPackages(prev => ({ ...prev, [type]: val })),
                                selectedOrigins,
                                setOrigin: (type, val) => setSelectedOrigins(prev => ({ ...prev, [type]: val })),
                                selectedDistricts,
                                setDistrict: (type, val) => setSelectedDistricts(prev => ({ ...prev, [type]: val }))
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
    dateRangeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    dateRangeSubtext: {
        fontSize: 11,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 16,
    },
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

    // Variety Selector
    varietySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    varietySelectorLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    varietySelectorValue: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginLeft: 8,
    },
    varietyModalContent: {
        width: '90%',
        maxHeight: '70%',
        borderRadius: 16,
        padding: 0,
        overflow: 'hidden',
    },
    varietyList: {
        maxHeight: 300,
    },
    varietyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    varietyItemSelected: {
        backgroundColor: '#f0fdf4',
    },
    varietyItemText: {
        fontSize: 15,
        color: '#374151',
    },
    varietyItemTextSelected: {
        color: '#22c55e',
        fontWeight: '600',
    },

    // Organic Checkbox
    organicCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#22c55e',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    checkboxDisabled: {
        borderColor: '#94a3b8', // Slate-400 for better visibility in both modes
        backgroundColor: 'transparent',
    },
    organicLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
});
