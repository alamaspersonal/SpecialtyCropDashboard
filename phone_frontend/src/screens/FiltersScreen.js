import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFilters } from '../services/api';
import FilterDropdown from '../components/FilterDropdown';

export default function FiltersScreen({ navigation }) {
    const [filters, setFilters] = useState(null);
    const [selectedFilters, setSelectedFilters] = useState({
        commodity: '',
        variety: '',
        category: '',
        district: '',
        organic: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
    }, [selectedFilters]);

    const handleFilterChange = (filterName, value) => {
        setSelectedFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleViewDashboard = () => {
        navigation.navigate('Dashboard', { filters: selectedFilters });
    };

    const clearFilters = () => {
        setSelectedFilters({
            commodity: '',
            variety: '',
            category: '',
            district: '',
            organic: '',
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#22c55e" />
                    <Text style={styles.loadingText}>Loading filters...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Filters</Text>
                <TouchableOpacity onPress={clearFilters}>
                    <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Refine Your Search</Text>
                <Text style={styles.sectionSubtitle}>Select criteria to view specific price data</Text>

                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={20} color="#dc2626" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {filters && (
                    <View style={styles.filtersContainer}>
                        <FilterDropdown
                            label="Category"
                            options={filters.categories}
                            value={selectedFilters.category}
                            onChange={(v) => handleFilterChange('category', v)}
                            color="#22c55e"
                        />
                        <FilterDropdown
                            label="Commodity"
                            options={filters.commodities}
                            value={selectedFilters.commodity}
                            onChange={(v) => handleFilterChange('commodity', v)}
                            color="#22c55e"
                        />
                        <FilterDropdown
                            label="Variety"
                            options={filters.varieties}
                            value={selectedFilters.variety}
                            onChange={(v) => handleFilterChange('variety', v)}
                            color="#22c55e"
                        />
                        <FilterDropdown
                            label="District"
                            options={filters.districts}
                            value={selectedFilters.district}
                            onChange={(v) => handleFilterChange('district', v)}
                            color="#22c55e"
                        />
                        <FilterDropdown
                            label="Organic"
                            options={filters.organics}
                            value={selectedFilters.organic}
                            onChange={(v) => handleFilterChange('organic', v)}
                            color="#22c55e"
                        />
                    </View>
                )}
            </ScrollView>

            {/* Bottom Action Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.viewButton}
                    onPress={handleViewDashboard}
                    activeOpacity={0.8}
                >
                    <Ionicons name="bar-chart-outline" size={22} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.viewButtonText}>View Dashboard</Text>
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
});
