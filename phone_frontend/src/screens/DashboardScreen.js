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
import { getPrices } from '../services/api';
import PriceWaterfallMobile from '../components/PriceWaterfallMobile';

import { saveFavorite, removeFavorite, checkIsFavorite } from '../services/favorites';

export default function DashboardScreen({ route, navigation }) {
    const { filters } = route.params;
    const [priceData, setPriceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [marketNotes, setMarketNotes] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);

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
                // Fetching raw prices for now
                const data = await getPrices(filters, 50);
                setPriceData(data);

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
        // Simple average for demo
        const terminalAvg = priceData.reduce((acc, curr) => acc + (curr.low_price || 0), 0) / priceData.length;
        // Mock shipping price as 60% of terminal for demo
        const shippingAvg = terminalAvg * 0.6;

        return {
            current_terminal_avg: terminalAvg,
            current_shipping_avg: shippingAvg,
            date: filters.date || 'Today'
        };
    };

    const stats = calculateStats();

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Price Waterfall</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={toggleFavorite}>
                        <Text style={[styles.settingsText, { color: isFavorite ? '#eab308' : '#cbd5e1' }]}>★</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowCostModal(true)}>
                        <Text style={styles.settingsText}>Costs</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {loading ? (
                    <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 50 }} />
                ) : stats ? (
                    <>
                        <Text style={styles.subtitle}>{filters.commodity || 'Commodity'}</Text>

                        {/* Waterfall Component */}
                        <PriceWaterfallMobile
                            stats={stats}
                            costs={costs}
                        />

                        {/* Market Notes */}
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesTitle}>Market Notes:</Text>
                            <Text style={styles.noteItem}>{marketNotes || '• Demand exceeds supply.'}</Text>
                        </View>


                    </>
                ) : (
                    <Text style={styles.noDataText}>No data available for this selection.</Text>
                )}
            </ScrollView>

            {/* Cost Configuration Modal */}
            <Modal visible={showCostModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Configure Costs</Text>

                        {Object.entries(costs).map(([key, val]) => (
                            <View key={key} style={styles.inputRow}>
                                <Text style={styles.inputLabel}>{key}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={val}
                                    onChangeText={(text) => setCosts(prev => ({ ...prev, [key]: text }))}
                                    keyboardType="numeric"
                                />
                            </View>
                        ))}

                        <TouchableOpacity
                            style={styles.closeButton}
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
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e2e8f0' },
    backButton: { padding: 4 },
    backBtnText: { color: '#64748b', fontSize: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    settingsText: { color: '#0ea5e9', fontSize: 16, fontWeight: '600' },
    scrollContent: { padding: 16 },
    subtitle: { fontSize: 20, fontWeight: 'bold', color: '#334155', textAlign: 'center', marginBottom: 20 },

    notesContainer: { backgroundColor: '#dcfce7', padding: 16, borderRadius: 12, marginTop: 24, borderWidth: 1, borderColor: '#bbf7d0' },
    notesTitle: { fontWeight: 'bold', color: '#166534', marginBottom: 8 },
    noteItem: { color: '#14532d', marginBottom: 4 },


    noDataText: { textAlign: 'center', color: 'gray', marginTop: 20 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    inputLabel: { fontSize: 16, textTransform: 'capitalize', color: '#64748b' },
    input: { backgroundColor: '#f1f5f9', width: 100, padding: 8, borderRadius: 8, textAlign: 'right' },
    closeButton: { backgroundColor: '#0ea5e9', padding: 16, borderRadius: 12, marginTop: 12, alignItems: 'center' },
    closeButtonText: { color: 'white', fontWeight: 'bold' }
});
