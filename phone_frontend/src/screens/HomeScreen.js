import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getFavorites } from '../services/favorites';

export default function HomeScreen({ navigation }) {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadFavorites = async () => {
        setLoading(true);
        const favs = await getFavorites();
        setFavorites(favs);
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadFavorites();
        }, [])
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoIcon}>
                        <Text style={styles.logoText}>Ag</Text>
                    </View>
                    <Text style={styles.headerTitle}>MarketIntel</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFavorites} />}
            >
                <View style={styles.heroSection}>
                    <Text style={styles.greeting}>Welcome Back</Text>
                    <Text style={styles.subGreeting}>Track market prices in real-time.</Text>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Watchlist</Text>
                </View>

                {favorites.length > 0 ? (
                    <View style={styles.favoritesGrid}>
                        {favorites.map((fav, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.favCard}
                                onPress={() => navigation.navigate('Dashboard', { filters: fav })}
                            >
                                <View style={styles.favIconPlaceholder}>
                                    <Text style={styles.favIconText}>{fav.commodity.charAt(0)}</Text>
                                </View>
                                <Text style={styles.favTitle}>{fav.commodity}</Text>
                                <Text style={styles.favSubtitle}>View Report →</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>You haven't added any favorites yet.</Text>
                        <Text style={styles.emptySubText}>Search for a crop to add it to your watchlist.</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => navigation.navigate('Filters')}
                >
                    <Text style={styles.searchButtonText}>Start New Search</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e2e8f0' },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoIcon: { width: 40, height: 40, backgroundColor: '#059669', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    logoText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },

    scrollContent: { padding: 24 },
    heroSection: { marginBottom: 32 },
    greeting: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
    subGreeting: { fontSize: 16, color: '#64748b', marginTop: 4 },

    sectionHeader: { marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155' },

    favoritesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
    favCard: {
        width: '48%',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    favIconPlaceholder: { width: 32, height: 32, backgroundColor: '#dcfce7', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    favIconText: { color: '#166534', fontWeight: 'bold' },
    favTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
    favSubtitle: { fontSize: 12, color: '#0ea5e9', fontWeight: 'bold' },

    emptyState: { padding: 32, alignItems: 'center', backgroundColor: 'white', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', marginBottom: 32 },
    emptyText: { color: '#64748b', fontSize: 16, fontWeight: '500', marginBottom: 4 },
    emptySubText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },

    searchButton: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    searchButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
