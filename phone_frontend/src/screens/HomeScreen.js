import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFavorites } from '../services/favorites';
import WatchlistAccordionItem from '../components/WatchlistAccordionItem';
import { STATIC_FILTERS } from '../constants/staticFilters';

export default function HomeScreen({ navigation }) {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const loadFavorites = async () => {
        setLoading(true);
        const favs = await getFavorites();
        setFavorites(favs);
        if (favs.length > 0 && !expandedId) {
            setExpandedId(0); 
        }
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadFavorites();
        }, [])
    );

    const toggleExpand = (index) => {
        setExpandedId(expandedId === index ? null : index);
    };

    // Search Logic
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        const lowerQuery = query.toLowerCase();
        
        // Search commodities
        const commodityMatches = STATIC_FILTERS.commodities
            .filter(c => c.toLowerCase().includes(lowerQuery))
            .map(c => ({ type: 'Commodity', name: c }));
        
        // Search varieties
        const varietyMatches = STATIC_FILTERS.varieties
            .filter(v => v.toLowerCase().includes(lowerQuery))
            .map(v => ({ type: 'Variety', name: v }));
        
        setSearchResults([...commodityMatches, ...varietyMatches].slice(0, 10)); // Limit results
    };

    const handleSelectSearchResult = (result) => {
        setSearchQuery('');
        setSearchResults([]);
        // Navigate to Dashboard with the selected filter
        const filters = result.type === 'Commodity' 
            ? { commodity: result.name } 
            : { variety: result.name };
        navigation.navigate('Dashboard', { filters });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Custom Header */}
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <View /> 
                    <TouchableOpacity onPress={() => navigation.navigate('Account')}>
                        <Ionicons name="person-circle-outline" size={32} color="black" />
                    </TouchableOpacity>
                </View>
                
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search commodities or varieties..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                            <Ionicons name="close-circle" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                    <View style={styles.searchResultsContainer}>
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item, idx) => `${item.type}-${item.name}-${idx}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.searchResultItem}
                                    onPress={() => handleSelectSearchResult(item)}
                                >
                                    <Text style={styles.searchResultType}>{item.type}</Text>
                                    <Text style={styles.searchResultName}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFavorites} />}
            >
                <View style={styles.heroSection}>
                    <Text style={styles.subGreeting}>Welcome Back Anthony,</Text>
                    <Text style={styles.greeting}>Your Watchlist</Text>
                </View>

                {favorites.length > 0 ? (
                    <View style={styles.accordionContainer}>
                        {favorites.map((fav, index) => (
                            <WatchlistAccordionItem
                                key={index}
                                item={fav}
                                expanded={expandedId === index}
                                onToggle={() => toggleExpand(index)}
                                onPressDashboard={() => navigation.navigate('Dashboard', { filters: fav })}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>You haven't added any favorites yet.</Text>
                        <Text style={styles.emptySubText}>Search for a crop to add it to your watchlist.</Text>
                    </View>
                )}
            </ScrollView>

             {/* Floating Action Button for Filtering - Custom Design with Popping Icon */}
            <View style={styles.fabWrapper}>
                <View style={styles.fabIconCircle}>
                    <Ionicons name="options-outline" size={32} color="black" />
                </View>
                <TouchableOpacity
                    style={styles.startFilteringButton}
                    onPress={() => navigation.navigate('Filters')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.startFilteringText}>Start Filtering</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, backgroundColor: '#f8fafc' },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    
    searchContainer: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        fontSize: 16,
        color: '#1e293b',
        flex: 1,
    },
    searchResultsContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginTop: 8,
        maxHeight: 250,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchResultItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchResultType: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    searchResultName: {
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '500',
    },

    scrollContent: { paddingHorizontal: 24, paddingBottom: 120 }, // Extra padding for large FAB
    
    heroSection: { marginBottom: 20, marginTop: 10 },
    subGreeting: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
    greeting: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },

    accordionContainer: { gap: 12 },

    emptyState: { padding: 32, alignItems: 'center', backgroundColor: 'white', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', marginTop: 20 },
    emptyText: { color: '#64748b', fontSize: 16, fontWeight: '500', marginBottom: 4 },
    emptySubText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },

    fabWrapper: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        alignItems: 'center',
    },
    fabIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        elevation: 6,
        marginBottom: -28,
        borderWidth: 5,
        borderColor: '#f8fafc',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    startFilteringButton: {
        backgroundColor: '#22c55e',
        width: '100%',
        paddingTop: 36,
        paddingBottom: 18,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: "#22c55e",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8
    },
    startFilteringText: {
        color: 'white', 
        fontSize: 22,
        fontWeight: 'bold',
    },
});
