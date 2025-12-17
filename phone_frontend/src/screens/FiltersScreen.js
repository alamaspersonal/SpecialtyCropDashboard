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
import { getFilters } from '../services/api';
import FilterDropdown from '../components/FilterDropdown';

export default function FiltersScreen({ navigation }) {
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const data = await getFilters(selectedFilters);
                setFilters(data);

                if (!selectedFilters.date && data.dates && data.dates.length > 0) {
                    setSelectedFilters(prev => ({ ...prev, date: data.dates[0] }));
                }
                setLoading(false);
            } catch (err) {
                console.error('Error fetching filters:', err);
                setError('Failed to load filters. Is the backend running?');
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

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0f766e" />
                    <Text style={styles.loadingText}>Loading filters...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView style={styles.scrollView}>
                <Text style={styles.header}>Select Filters</Text>
                <Text style={styles.subheader}>Choose your criteria to view price data</Text>

                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {filters && (
                    <View style={styles.filtersContainer}>
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
                            label="District"
                            options={filters.districts}
                            value={selectedFilters.district}
                            onChange={(v) => handleFilterChange('district', v)}
                            color="#0d9488"
                        />
                        <FilterDropdown
                            label="Organic"
                            options={filters.organics}
                            value={selectedFilters.organic}
                            onChange={(v) => handleFilterChange('organic', v)}
                            color="#16a34a"
                        />
                    </View>
                )}
            </ScrollView>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.viewButton}
                    onPress={handleViewDashboard}
                >
                    <Text style={styles.viewButtonText}>View Dashboard</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    subheader: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 24,
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
    filtersContainer: {
        gap: 12,
    },
    buttonContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    viewButton: {
        backgroundColor: '#0f766e',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    viewButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
});
