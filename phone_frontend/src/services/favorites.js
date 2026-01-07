import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@market_intel_favorites';

export const getFavorites = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(FAVORITES_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error("Error reading favorites:", e);
        return [];
    }
};

export const saveFavorite = async (filter) => {
    try {
        const existing = await getFavorites();
        // Check duplication by checking if filter represents same query
        // Simple check: same commodity
        const isDuplicate = existing.some(f => f.commodity === filter.commodity);

        if (!isDuplicate) {
            const newFavorites = [...existing, filter];
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error saving favorite:", e);
        return false;
    }
};

export const removeFavorite = async (commodity) => {
    try {
        const existing = await getFavorites();
        const newFavorites = existing.filter(f => f.commodity !== commodity);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
        return true;
    } catch (e) {
        console.error("Error removing favorite:", e);
        return false;
    }
};

export const checkIsFavorite = async (commodity) => {
    const existing = await getFavorites();
    return existing.some(f => f.commodity === commodity);
};
