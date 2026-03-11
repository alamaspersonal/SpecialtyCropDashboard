/**
 * Favorites Service — Web replacement for AsyncStorage-based favorites
 *
 * Manages a watchlist of favorite commodities using localStorage.
 */

const FAVORITES_KEY = '@market_intel_favorites';

function readFavorites() {
    try {
        if (typeof window === 'undefined') return [];
        const json = localStorage.getItem(FAVORITES_KEY);
        return json ? JSON.parse(json) : [];
    } catch (e) {
        console.error('Error reading favorites:', e);
        return [];
    }
}

function writeFavorites(favorites) {
    try {
        if (typeof window === 'undefined') return false;
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        return true;
    } catch (e) {
        console.error('Error writing favorites:', e);
        return false;
    }
}

export const getFavorites = () => readFavorites();

export const saveFavorite = (filter) => {
    const existing = readFavorites();
    const isDuplicate = existing.some(f => f.commodity === filter.commodity);
    if (!isDuplicate) {
        writeFavorites([...existing, filter]);
        return true;
    }
    return false;
};

export const removeFavorite = (commodity) => {
    const existing = readFavorites();
    const filtered = existing.filter(f => f.commodity !== commodity);
    return writeFavorites(filtered);
};

export const checkIsFavorite = (commodity) => {
    const existing = readFavorites();
    return existing.some(f => f.commodity === commodity);
};
