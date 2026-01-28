/**
 * User Storage Service - Handles user preferences with AsyncStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    USER_NAME: '@user_name',
    ONBOARDING_COMPLETE: '@onboarding_complete',
    PROFILE_IMAGE: '@profile_image',
};

/**
 * Get the stored user name
 */
export const getUserName = async () => {
    try {
        return await AsyncStorage.getItem(KEYS.USER_NAME);
    } catch (e) {
        console.error('Error getting user name:', e);
        return null;
    }
};

/**
 * Save the user name
 */
export const setUserName = async (name) => {
    try {
        await AsyncStorage.setItem(KEYS.USER_NAME, name);
        return true;
    } catch (e) {
        console.error('Error saving user name:', e);
        return false;
    }
};

/**
 * Get the stored profile image URI
 */
export const getProfileImage = async () => {
    try {
        return await AsyncStorage.getItem(KEYS.PROFILE_IMAGE);
    } catch (e) {
        console.error('Error getting profile image:', e);
        return null;
    }
};

/**
 * Save the profile image URI
 */
export const setProfileImage = async (uri) => {
    try {
        if (uri) {
            await AsyncStorage.setItem(KEYS.PROFILE_IMAGE, uri);
        } else {
            await AsyncStorage.removeItem(KEYS.PROFILE_IMAGE);
        }
        return true;
    } catch (e) {
        console.error('Error saving profile image:', e);
        return false;
    }
};

/**
 * Check if onboarding has been completed
 */
export const hasCompletedOnboarding = async () => {
    try {
        const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
        return value === 'true';
    } catch (e) {
        console.error('Error checking onboarding:', e);
        return false;
    }
};

/**
 * Mark onboarding as complete
 */
export const setOnboardingComplete = async () => {
    try {
        await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, 'true');
        return true;
    } catch (e) {
        console.error('Error setting onboarding complete:', e);
        return false;
    }
};

/**
 * Clear all user data (for testing/logout)
 */
export const clearUserData = async () => {
    try {
        await AsyncStorage.multiRemove([KEYS.USER_NAME, KEYS.ONBOARDING_COMPLETE, KEYS.PROFILE_IMAGE]);
        return true;
    } catch (e) {
        console.error('Error clearing user data:', e);
        return false;
    }
};
