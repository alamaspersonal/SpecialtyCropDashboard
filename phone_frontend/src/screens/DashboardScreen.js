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

    // Data Partitioning
    const [terminalData, setTerminalData] = useState([]);
    const [shippingData, setShippingData] = useState([]);
    const [packageOptions, setPackageOptions] = useState({ terminal: [], shipping: [] });
    const [selectedPackages, setSelectedPackages] = useState({ terminal: '', shipping: '' });

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
                // Fetching raw prices with higher limit to get mix
                const data = await getPrices(filters, 200);
                setPriceData(data); // Keep raw fallback

                // Partition Data - Using actual market_type values from CSV
                const tData = data.filter(d => d.market_type === 'Terminal' || !d.market_type);
                const sData = data.filter(d => d.market_type === 'Shipping');

                setTerminalData(tData);
                setShippingData(sData);

                // Extract Packages
                const getPackages = (arr) => [...new Set(arr.map(d => d.package).filter(Boolean))].sort();
                const tPackages = getPackages(tData);
                const sPackages = getPackages(sData);

                setPackageOptions({ terminal: tPackages, shipping: sPackages });

                // Set Defaults (first available)
                setSelectedPackages({
                    terminal: tPackages[0] || '',
                    shipping: sPackages[0] || ''
                });

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

        // Filter by selected package if set
        const getAvg = (data, userPackage) => {
            if (!data.length) return 0;
            const filtered = userPackage ? data.filter(d => d.package === userPackage) : data;
            if (!filtered.length) return 0; // Or fallback to all?
            return filtered.reduce((acc, curr) => acc + (curr.low_price || 0), 0) / filtered.length;
        };

        const terminalAvg = getAvg(terminalData, selectedPackages.terminal);

        // If we have real shipping data, use it. Otherwise derive it from Real Terminal or just use derivation.
        let shippingAvg = getAvg(shippingData, selectedPackages.shipping);

        // Fallback Mock Logic if no real shipping data found (common in demo data)
        if (shippingAvg === 0 && terminalAvg > 0) {
            shippingAvg = terminalAvg * 0.6;
        }

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
                            packageData={packageOptions}
                            actions={{
                                selectedPackages,
                                setPackage: (type, val) => setSelectedPackages(prev => ({ ...prev, [type]: val }))
                            }}
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
