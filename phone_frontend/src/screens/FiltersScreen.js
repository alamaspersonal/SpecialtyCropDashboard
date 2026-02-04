import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFilters, getCommoditiesWithCompleteData, getCommoditiesWithOrganicData } from '../services/api';
import FilterDropdown from '../components/FilterDropdown';
import { CATEGORY_COMMODITIES, COMMODITY_TO_CATEGORY } from '../constants/staticFilters';
import { useTheme } from '../context/ThemeContext';

export default function FiltersScreen({ navigation }) {
    const { colors } = useTheme();
    const [filters, setFilters] = useState(null);
    const [selectedFilters, setSelectedFilters] = useState({
        commodity: '',
        variety: '',
        category: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [validationError, setValidationError] = useState('');
    
    // Complete market data filter state
    const [showCompleteDataOnly, setShowCompleteDataOnly] = useState(false);
    const [completeDataCommodities, setCompleteDataCommodities] = useState(new Set());
    
    // Organic filter state
    const [organicOnly, setOrganicOnly] = useState(false);
    const [organicCommodities, setOrganicCommodities] = useState(new Set());

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const data = await getFilters(selectedFilters);
                setFilters(data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching filters:', err);
                setError('Failed to load filters.');
                setLoading(false);
            }
        };
        fetchFilters();
    }, [selectedFilters.category, selectedFilters.commodity]);

    // Fetch commodities with complete market data when toggle is enabled
    useEffect(() => {
        if (showCompleteDataOnly && completeDataCommodities.size === 0) {
            const fetchCompleteData = async () => {
                const completeCommodities = await getCommoditiesWithCompleteData();
                setCompleteDataCommodities(completeCommodities);
            };
            fetchCompleteData();
        }
    }, [showCompleteDataOnly]);

    // Fetch commodities with organic data when toggle is enabled
    useEffect(() => {
        if (organicOnly && organicCommodities.size === 0) {
            const fetchOrganicData = async () => {
                const organicCmds = await getCommoditiesWithOrganicData();
                setOrganicCommodities(organicCmds);
            };
            fetchOrganicData();
        }
    }, [organicOnly]);

    const handleFilterChange = (filterName, value) => {
        // Handle cascading filter logic based on which filter changed
        // Uses local mappings for INSTANT validation - no database calls!
        
        if (filterName === 'category') {
            // When category changes, immediately check if commodity is still valid
            setSelectedFilters(prev => {
                const newCategory = value;
                let newCommodity = prev.commodity;
                let newVariety = prev.variety;
                
                // If we have a commodity selected, check if it belongs to the new category
                if (prev.commodity && newCategory) {
                    const validCommodities = CATEGORY_COMMODITIES[newCategory] || [];
                    if (!validCommodities.includes(prev.commodity)) {
                        // Commodity is not in the new category - clear it immediately
                        console.log('[DEBUG] Instantly clearing invalid commodity:', prev.commodity);
                        newCommodity = '';
                        newVariety = ''; // Also clear variety
                    }
                }
                
                // If category is cleared, don't clear commodity (allow browsing)
                
                return { 
                    ...prev, 
                    category: newCategory,
                    commodity: newCommodity,
                    variety: newVariety,
                };
            });
        } 
        else if (filterName === 'commodity') {
            // When commodity is selected, instantly look up its parent category
            setSelectedFilters(prev => {
                let newCategory = prev.category;
                
                // Auto-fill category if not set and we have a commodity
                if (value && !prev.category) {
                    const lookupCategory = COMMODITY_TO_CATEGORY[value];
                    if (lookupCategory) {
                        console.log('[DEBUG] Instantly auto-filling category:', lookupCategory, 'for commodity:', value);
                        newCategory = lookupCategory;
                    }
                }
                
                return { 
                    ...prev, 
                    commodity: value,
                    category: newCategory,
                    variety: '', // Clear variety when commodity changes
                };
            });
        }
        else if (filterName === 'variety') {
            // Variety is a leaf node, just update it
            setSelectedFilters(prev => ({ ...prev, variety: value }));
        }
        
        // Clear validation error when filters change
        setValidationError('');
    };

    const handleViewDashboard = () => {
        if (!selectedFilters.commodity) {
            setValidationError('Please select a commodity to view the dashboard');
            return;
        }
        setValidationError('');
        navigation.navigate('Dashboard', { 
            filters: selectedFilters,
            organicOnly: organicOnly
        });
    };

    const clearFilters = () => {
        setSelectedFilters({
            commodity: '',
            variety: '',
            category: '',
        });
        setValidationError('');
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading filters...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Filters</Text>
                <TouchableOpacity onPress={clearFilters}>
                    <Text style={[styles.clearText, { color: colors.accent }]}>Clear</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Refine Your Search</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Select criteria to view specific price data</Text>

                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={20} color="#dc2626" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Complete Market Data Toggle */}
                <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceElevated }]}>
                    <View style={styles.toggleTextContainer}>
                        <Text style={[styles.toggleLabel, { color: colors.text }]}>Complete Data Only</Text>
                        <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                            Show only crops with Shipping, Terminal, and Retail data
                        </Text>
                    </View>
                    <Switch
                        value={showCompleteDataOnly}
                        onValueChange={setShowCompleteDataOnly}
                        trackColor={{ false: '#64748b', true: colors.accent }}
                        thumbColor={showCompleteDataOnly ? '#fff' : '#f4f3f4'}
                    />
                </View>

                {/* Organic Only Toggle */}
                <View style={[styles.organicToggleRow, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.organicLabel, { color: colors.text }]}>Organic</Text>
                    <View style={styles.yesNoContainer}>
                        <Text style={[styles.yesNoText, { color: organicOnly ? colors.textMuted : colors.text }]}>No</Text>
                        <Switch
                            value={organicOnly}
                            onValueChange={setOrganicOnly}
                            trackColor={{ false: '#64748b', true: colors.accent }}
                            thumbColor={organicOnly ? '#fff' : '#f4f3f4'}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                        <Text style={[styles.yesNoText, { color: organicOnly ? colors.text : colors.textMuted }]}>Yes</Text>
                    </View>
                </View>

                {filters && (
                    <View style={styles.filtersContainer}>
                        <FilterDropdown
                            label="Category"
                            options={
                                (() => {
                                    let categoryList = filters.categories;
                                    
                                    // Filter to only categories that have commodities with complete data
                                    if (showCompleteDataOnly && completeDataCommodities.size > 0) {
                                        categoryList = categoryList.filter(category => {
                                            const commoditiesInCategory = CATEGORY_COMMODITIES[category] || [];
                                            return commoditiesInCategory.some(c => completeDataCommodities.has(c));
                                        });
                                    }
                                    
                                    // Filter to only categories that have commodities with organic data
                                    if (organicOnly && organicCommodities.size > 0) {
                                        categoryList = categoryList.filter(category => {
                                            const commoditiesInCategory = CATEGORY_COMMODITIES[category] || [];
                                            return commoditiesInCategory.some(c => organicCommodities.has(c));
                                        });
                                    }
                                    return categoryList;
                                })()
                            }
                            value={selectedFilters.category}
                            onChange={(v) => handleFilterChange('category', v)}
                            color={colors.accent}
                        />
                        <FilterDropdown
                            label="Commodity"
                            options={
                                (() => {
                                    let commodityList = selectedFilters.category 
                                        ? CATEGORY_COMMODITIES[selectedFilters.category] || []
                                        : filters.commodities;
                                    
                                    // Filter to only complete data commodities when toggle is on
                                    if (showCompleteDataOnly && completeDataCommodities.size > 0) {
                                        commodityList = commodityList.filter(c => completeDataCommodities.has(c));
                                    }
                                    
                                    // Filter to only organic commodities when toggle is on
                                    if (organicOnly && organicCommodities.size > 0) {
                                        commodityList = commodityList.filter(c => organicCommodities.has(c));
                                    }
                                    return commodityList;
                                })()
                            }
                            value={selectedFilters.commodity}
                            onChange={(v) => handleFilterChange('commodity', v)}
                            color={colors.accent}
                        />
                        <FilterDropdown
                            label={selectedFilters.commodity ? "Variety" : "Variety (Select Commodity First)"}
                            options={filters.varieties}
                            value={selectedFilters.variety}
                            onChange={(v) => handleFilterChange('variety', v)}
                            color={colors.accent}
                            disabled={!selectedFilters.commodity}
                        />
                    </View>
                )}
            </ScrollView>

            {/* Bottom Action Button */}
            <View style={[styles.buttonContainer, { backgroundColor: colors.background }]}>
                {validationError ? (
                    <Text style={styles.validationError}>{validationError}</Text>
                ) : null}
                <TouchableOpacity
                    style={[
                        styles.viewButton, 
                        { 
                            backgroundColor: selectedFilters.commodity ? colors.accent : '#cbd5e1',
                            shadowColor: selectedFilters.commodity ? colors.accent : 'transparent'
                        }
                    ]}
                    onPress={handleViewDashboard}
                    activeOpacity={0.8}
                >
                    <Ionicons name="bar-chart-outline" size={22} color={selectedFilters.commodity ? '#0f172a' : '#64748b'} style={{ marginRight: 8 }} />
                    <Text style={[styles.viewButtonText, { color: selectedFilters.commodity ? 'white' : '#64748b' }]}>View Dashboard</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    clearText: {
        fontSize: 14,
        color: '#22c55e',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 24,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#dc2626',
        marginLeft: 8,
        flex: 1,
    },
    filtersContainer: {
        gap: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    toggleTextContainer: {
        flex: 1,
        marginRight: 12,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    toggleDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    organicToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 16,
    },
    organicLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    yesNoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    yesNoText: {
        fontSize: 13,
        fontWeight: '500',
    },
    buttonContainer: {
        padding: 20,
        paddingBottom: 28,
        backgroundColor: '#f8fafc',
    },
    viewButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    viewButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    validationError: {
        color: '#dc2626',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 12,
    },
});
