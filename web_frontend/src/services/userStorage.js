/**
 * Local Storage Service — Web replacement for AsyncStorage
 *
 * Provides an async-compatible API matching the mobile app's AsyncStorage usage.
 * Wraps localStorage with try/catch for safety.
 */

const KEYS = {
    USER_NAME: '@user_name',
    ONBOARDING_COMPLETE: '@onboarding_complete',
    PROFILE_IMAGE: '@profile_image',
    THEME_PREFERENCE: '@theme_preference',
};

function getItem(key) {
    try {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(key);
    } catch (e) {
        console.error(`Error reading ${key}:`, e);
        return null;
    }
}

function setItem(key, value) {
    try {
        if (typeof window === 'undefined') return false;
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error(`Error writing ${key}:`, e);
        return false;
    }
}

function removeItem(key) {
    try {
        if (typeof window === 'undefined') return false;
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error(`Error removing ${key}:`, e);
        return false;
    }
}

// --- User Name ---
export const getUserName = () => getItem(KEYS.USER_NAME);
export const setUserName = (name) => setItem(KEYS.USER_NAME, name);

// --- Profile Image ---
export const getProfileImage = () => getItem(KEYS.PROFILE_IMAGE);
export const setProfileImage = (uri) => {
    if (uri) {
        return setItem(KEYS.PROFILE_IMAGE, uri);
    }
    return removeItem(KEYS.PROFILE_IMAGE);
};

// --- Onboarding ---
export const hasCompletedOnboarding = () => getItem(KEYS.ONBOARDING_COMPLETE) === 'true';
export const setOnboardingComplete = () => setItem(KEYS.ONBOARDING_COMPLETE, 'true');

// --- Theme ---
export const getThemePreference = () => getItem(KEYS.THEME_PREFERENCE);
export const setThemePreference = (theme) => setItem(KEYS.THEME_PREFERENCE, theme);

// --- Clear All ---
export const clearUserData = () => {
    try {
        if (typeof window === 'undefined') return false;
        Object.values(KEYS).forEach(key => localStorage.removeItem(key));
        return true;
    } catch (e) {
        console.error('Error clearing user data:', e);
        return false;
    }
};
