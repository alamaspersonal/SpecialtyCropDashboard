/**
 * Theme Context - Provides dark mode support across the app
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Industry-standard slate-based color palette
const lightColors = {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#f1f5f9',
    text: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    accent: '#22c55e',
    accentLight: '#dcfce7',
    border: '#e2e8f0',
    error: '#dc2626',
    // Price colors
    priceGreen: '#16a34a',
    priceRed: '#dc2626',
};

const darkColors = {
    background: '#0f172a',
    surface: '#1e293b',
    surfaceElevated: '#334155',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    accent: '#4ade80',
    accentLight: '#166534',
    border: '#334155',
    error: '#f87171',
    // Price colors
    priceGreen: '#4ade80',
    priceRed: '#f87171',
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme();
    const [isDark, setIsDark] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Load saved theme preference
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const saved = await AsyncStorage.getItem('@theme_preference');
                if (saved !== null) {
                    setIsDark(saved === 'dark');
                } else {
                    // Use system preference as default
                    setIsDark(systemScheme === 'dark');
                }
            } catch (e) {
                console.error('Error loading theme:', e);
            }
            setIsReady(true);
        };
        loadTheme();
    }, []);

    // Save theme preference
    const toggleTheme = async () => {
        const newValue = !isDark;
        setIsDark(newValue);
        try {
            await AsyncStorage.setItem('@theme_preference', newValue ? 'dark' : 'light');
        } catch (e) {
            console.error('Error saving theme:', e);
        }
    };

    const colors = isDark ? darkColors : lightColors;

    if (!isReady) {
        return null; // Or a loading state
    }

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export { lightColors, darkColors };
