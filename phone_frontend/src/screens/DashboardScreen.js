import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPrices } from '../services/api';
import PriceBarChart from '../components/PriceBarChart';

export default function DashboardScreen({ route, navigation }) {
    const { filters } = route.params;
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [marketNotes, setMarketNotes] = useState('');

    useEffect(() => {
        const fetchPrices = async () => {
            setLoading(true);
            try {
                const data = await getPrices(filters, 50);
                setPriceData(data);

                if (data.length > 0 && data[0].market_tone_comments) {
                    setMarketNotes(data[0].market_tone_comments);
                } else {
                    setMarketNotes('');
                }
            } catch (err) {
                console.error('Error fetching prices:', err);
                setError('Failed to load price data.');
            } finally {
                setLoading(false);
            }
        };
        fetchPrices();
    }, [filters]);

    // Aggregate current prices (simple average for the dashboard view)
    const currentPrice = priceData.length > 0 ? {
        low: priceData.reduce((sum, p) => sum + (p.low_price || 0), 0) / priceData.filter(p => p.low_price).length,
        high: priceData.reduce((sum, p) => sum + (p.high_price || 0), 0) / priceData.filter(p => p.high_price).length,
    } : null;

    // Placeholder for prior week data (since API doesn't support historical lookup yet)
    const priorPrice = currentPrice ? {
        low: currentPrice.low * 0.95, // Simulate 5% drop
        high: currentPrice.high * 0.98,
    } : null;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.filtersSummary}>
                    <Text style={styles.summaryText}>
                        {filters.commodity} • {filters.variety || 'All Varieties'} • {filters.package || 'All Packages'}
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0f766e" style={{ marginTop: 40 }} />
                ) : error ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : priceData.length > 0 ? (
                    <>
                        <PriceBarChart
                            currentPrice={currentPrice}
                            priorPrice={priorPrice}
                            currentDate={filters.date}
                            priorDate="Prior Week"
                        />

                        {/* Market Notes Panel */}
                        <View style={styles.notesPanel}>
                            <Text style={styles.notesTitle}>Market notes:</Text>
                            <Text style={styles.notesText}>
                                {marketNotes || 'No market notes available.'}
                            </Text>
                        </View>

                        {/* CTA Button */}
                        <TouchableOpacity style={styles.ctaButton}>
                            <Text style={styles.ctaText}>Click here to compare with your production costs</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={styles.noDataText}>No data available for this selection.</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        color: '#0f766e',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    filtersSummary: {
        marginBottom: 24,
        padding: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
        alignItems: 'center',
    },
    summaryText: {
        fontSize: 14,
        color: '#4b5563',
        fontWeight: '500',
    },
    notesPanel: {
        backgroundColor: '#dcfce7', // Light green background from mockup
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    notesTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#14532d',
    },
    notesText: {
        color: '#166534',
        fontSize: 14,
        lineHeight: 20,
    },
    ctaButton: {
        backgroundColor: '#ffedd5', // Light orange
        borderWidth: 2,
        borderColor: '#fdba74',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 32,
    },
    ctaText: {
        color: '#9a3412',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
    },
    noDataText: {
        textAlign: 'center',
        color: 'gray',
        marginTop: 20,
    },
});
