import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    FlatList,
    TouchableOpacity,
    Modal,
    RefreshControl,
} from 'react-native';
import { getFilters, getPrices } from '../services/api';
import FilterDropdown from '../components/FilterDropdown';
import PriceCard from '../components/PriceCard';

export default function DashboardScreen() {
    const [filters, setFilters] = useState(null);
    const [selectedFilters, setSelectedFilters] = useState({
        commodity: '',
        variety: '',
        category: '',
        package: '',
        district: '',
        organic: '',
        date: '',
    });
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [marketNotes, setMarketNotes] = useState('');
    const [filtersVisible, setFiltersVisible] = useState(false);

    // Fetch filters
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const data = await getFilters(selectedFilters);
                setFilters(data);

                if (!selectedFilters.date && data.dates && data.dates.length > 0) {
                    setSelectedFilters(prev => ({ ...prev, date: data.dates[0] }));
                }
            } catch (err) {
                console.error('Error fetching filters:', err);
                setError('Failed to load filters. Is the backend running?');
            }
        };
        fetchFilters();
    }, [selectedFilters]);

    // Fetch prices
    useEffect(() => {
        const fetchPrices = async () => {
            if (!selectedFilters.date) return;

            setLoading(true);
            try {
                const data = await getPrices(selectedFilters, 50);
                setPriceData(data);

                if (data.length > 0 && data[0].market_tone_comments) {
                    setMarketNotes(data[0].market_tone_comments);
                } else {
                    setMarketNotes('');
                }
                setError(null);
            } catch (err) {
                console.error('Error fetching prices:', err);
                setError('Failed to load price data.');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        };
        fetchPrices();
    }, [selectedFilters]);

    const handleFilterChange = (filterName, value) => {
        setSelectedFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const onRefresh = () => {
        setRefreshing(true);
        setSelectedFilters(prev => ({ ...prev }));
    };

    // Calculate averages
    const avgLowPrice = priceData.length > 0
        ? (priceData.reduce((sum, p) => sum + (p.low_price || 0), 0) / priceData.filter(p => p.low_price).length).toFixed(2)
        : '—';
    const avgHighPrice = priceData.length > 0
        ? (priceData.reduce((sum, p) => sum + (p.high_price || 0), 0) / priceData.filter(p => p.high_price).length).toFixed(2)
        : '—';

    const renderPriceItem = ({ item }) => (
        <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.commodityCell]} numberOfLines={1}>
                {item.commodity}
            </Text>
            <Text style={[styles.tableCell, styles.priceCell]}>
                ${item.low_price?.toFixed(2) || '—'}
            </Text>
            <Text style={[styles.tableCell, styles.priceCell]}>
                ${item.high_price?.toFixed(2) || '—'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Specialty Crop Dashboard</Text>
                    <Text style={styles.subtitle}>USDA Market Pricing Data</Text>
                </View>
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setFiltersVisible(true)}
                >
                    <Text style={styles.filterButtonText}>Filters</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Modal */}
            <Modal
                visible={filtersVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setFiltersVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Filters</Text>
                        <TouchableOpacity onPress={() => setFiltersVisible(false)}>
                            <Text style={styles.doneButton}>Done</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.filterScroll}>
                        {filters && (
                            <>
                                <FilterDropdown
                                    label="Date"
                                    options={filters.dates}
                                    value={selectedFilters.date}
                                    onChange={(v) => handleFilterChange('date', v)}
                                    color="#2563eb"
                                />
                                <FilterDropdown
                                    label="Category"
                                    options={filters.categories}
                                    value={selectedFilters.category}
                                    onChange={(v) => handleFilterChange('category', v)}
                                    color="#db2777"
                                />
                                <FilterDropdown
                                    label="Commodity"
                                    options={filters.commodities}
                                    value={selectedFilters.commodity}
                                    onChange={(v) => handleFilterChange('commodity', v)}
                                    color="#0d9488"
                                />
                                <FilterDropdown
                                    label="Variety"
                                    options={filters.varieties}
                                    value={selectedFilters.variety}
                                    onChange={(v) => handleFilterChange('variety', v)}
                                    color="#eab308"
                                />
                                <FilterDropdown
                                    label="Package"
                                    options={filters.packages}
                                    value={selectedFilters.package}
                                    onChange={(v) => handleFilterChange('package', v)}
                                    color="#9333ea"
                                />
                                <FilterDropdown
                                    label="Organic"
                                    options={filters.organics}
                                    value={selectedFilters.organic}
                                    onChange={(v) => handleFilterChange('organic', v)}
                                    color="#16a34a"
                                />
                            </>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Main Content */}
            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Date Display */}
                <Text style={styles.dateLabel}>
                    Terminal Market Price — {selectedFilters.date || 'Select Date'}
                </Text>

                {/* Price Summary */}
                <PriceCard
                    avgLowPrice={avgLowPrice}
                    avgHighPrice={avgHighPrice}
                    recordCount={priceData.length}
                />

                {/* Price Table */}
                {loading ? (
                    <ActivityIndicator size="large" color="#0d9488" style={styles.loader} />
                ) : priceData.length > 0 ? (
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.commodityCell]}>Commodity</Text>
                            <Text style={[styles.tableHeaderCell, styles.priceCell]}>Low</Text>
                            <Text style={[styles.tableHeaderCell, styles.priceCell]}>High</Text>
                        </View>
                        <FlatList
                            data={priceData}
                            renderItem={renderPriceItem}
                            keyExtractor={(item) => item.id.toString()}
                            scrollEnabled={false}
                        />
                    </View>
                ) : (
                    <Text style={styles.noData}>No data found for the selected filters.</Text>
                )}

                {/* Market Notes */}
                <View style={styles.notesContainer}>
                    <Text style={styles.notesTitle}>Market Notes</Text>
                    <Text style={styles.notesText}>
                        {marketNotes || 'No market notes available for the current selection.'}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    header: {
        backgroundColor: '#0f766e',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#99f6e4',
        fontSize: 12,
    },
    filterButton: {
        backgroundColor: '#14b8a6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    filterButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    dateLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 16,
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    tableHeaderCell: {
        fontWeight: '600',
        color: '#4b5563',
        fontSize: 12,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    tableCell: {
        fontSize: 14,
    },
    commodityCell: {
        flex: 2,
    },
    priceCell: {
        flex: 1,
        textAlign: 'right',
        color: '#16a34a',
        fontWeight: '600',
    },
    loader: {
        marginVertical: 40,
    },
    noData: {
        textAlign: 'center',
        color: '#6b7280',
        marginVertical: 40,
    },
    notesContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 32,
    },
    notesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    notesText: {
        color: '#6b7280',
        fontSize: 14,
        lineHeight: 20,
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#dc2626',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    doneButton: {
        color: '#0d9488',
        fontSize: 16,
        fontWeight: '600',
    },
    filterScroll: {
        flex: 1,
        padding: 16,
    },
});
