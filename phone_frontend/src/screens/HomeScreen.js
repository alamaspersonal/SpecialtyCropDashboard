import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, TextInput, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFavorites } from '../services/favorites';
import { getUserName, getProfileImage } from '../services/userStorage';
import { useTheme } from '../context/ThemeContext';
import WatchlistAccordionItem from '../components/WatchlistAccordionItem';
import { STATIC_FILTERS } from '../constants/staticFilters';

export default function HomeScreen({ navigation }) {
    const { colors } = useTheme();
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [userName, setUserName] = useState('');
    const [profileImage, setProfileImage] = useState(null);

    const loadData = async () => {
        setLoading(true);
        const [favs, name, image] = await Promise.all([
            getFavorites(),
            getUserName(),
            getProfileImage()
        ]);
        setFavorites(favs);
        setUserName(name || 'Friend');
        setProfileImage(image);
        if (favs.length > 0 && !expandedId) {
            setExpandedId(0); 
        }
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
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
        
        setSearchResults([...commodityMatches, ...varietyMatches].slice(0, 10));
    };

    const handleSelectSearchResult = (result) => {
        setSearchQuery('');
        setSearchResults([]);
        const filters = result.type === 'Commodity' 
            ? { commodity: result.name } 
            : { variety: result.name };
        navigation.navigate('Dashboard', { filters });
    };

    // Dynamic styles based on theme
    const dynamicStyles = {
        container: { flex: 1, backgroundColor: colors.background },
        header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, backgroundColor: colors.background },
        searchContainer: {
            backgroundColor: colors.surfaceElevated,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
        },
        searchInput: {
            fontSize: 16,
            color: colors.text,
            flex: 1,
        },
        searchResultsContainer: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            marginTop: 8,
            maxHeight: 250,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchResultItem: {
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        subGreeting: { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 2 },
        greeting: { fontSize: 28, fontWeight: 'bold', color: colors.text },
        emptyState: { 
            padding: 32, 
            alignItems: 'center', 
            backgroundColor: colors.surface, 
            borderRadius: 16, 
            borderStyle: 'dashed', 
            borderWidth: 2, 
            borderColor: colors.border, 
            marginTop: 20 
        },
        fabIconCircle: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.accent,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            elevation: 6,
            marginBottom: -28,
            borderWidth: 5,
            borderColor: colors.background,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
        },
        startFilteringButton: {
            backgroundColor: colors.accent,
            width: '100%',
            paddingTop: 36,
            paddingBottom: 18,
            borderRadius: 20,
            alignItems: 'center',
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 8
        },
    };

    return (
        <SafeAreaView style={dynamicStyles.container}>
            {/* Custom Header */}
            <View style={dynamicStyles.header}>
                <View style={styles.headerTopRow}>
                    <View /> 
                    <TouchableOpacity onPress={() => navigation.navigate('Account')} style={styles.profileButton}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.profileButtonImage} />
                        ) : (
                            <Ionicons name="person-circle-outline" size={32} color={colors.text} />
                        )}
                    </TouchableOpacity>
                </View>
                
                {/* Search Bar */}
                <View style={dynamicStyles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
                    <TextInput 
                        style={dynamicStyles.searchInput}
                        placeholder="Search commodities or varieties..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                    <View style={dynamicStyles.searchResultsContainer}>
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item, idx) => `${item.type}-${item.name}-${idx}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={dynamicStyles.searchResultItem}
                                    onPress={() => handleSelectSearchResult(item)}
                                >
                                    <Text style={[styles.searchResultType, { color: colors.textSecondary }]}>{item.type}</Text>
                                    <Text style={[styles.searchResultName, { color: colors.text }]}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.accent} />}
            >
                <View style={styles.heroSection}>
                    <Text style={dynamicStyles.subGreeting}>Welcome Back {userName},</Text>
                    <Text style={dynamicStyles.greeting}>Your Watchlist</Text>
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
                    <View style={dynamicStyles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>You haven't added any favorites yet.</Text>
                        <Text style={[styles.emptySubText, { color: colors.textMuted }]}>Search for a crop to add it to your watchlist.</Text>
                    </View>
                )}
            </ScrollView>

            {/* Floating Action Button */}
            <View style={styles.fabWrapper}>
                <View style={dynamicStyles.fabIconCircle}>
                    <Ionicons name="options-outline" size={32} color="#0f172a" />
                </View>
                <TouchableOpacity
                    style={dynamicStyles.startFilteringButton}
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
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    
    searchResultType: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    searchResultName: {
        fontSize: 16,
        fontWeight: '500',
    },

    scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
    
    heroSection: { marginBottom: 20, marginTop: 10 },

    accordionContainer: { gap: 12 },

    emptyText: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
    emptySubText: { fontSize: 14, textAlign: 'center' },

    fabWrapper: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        alignItems: 'center',
    },
    startFilteringText: {
        color: '#0f172a', 
        fontSize: 22,
        fontWeight: 'bold',
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#22c55e',
    },
    profileButtonImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
});
