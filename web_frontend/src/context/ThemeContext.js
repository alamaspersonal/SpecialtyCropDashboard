'use client';

/**
 * Theme Context — Dark/Light mode support for the web app
 *
 * Uses CSS custom properties via [data-theme] attribute on <html>.
 * Persists preference to localStorage & respects system preference.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getThemePreference, setThemePreference } from '../services/userStorage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(false);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Load saved theme preference or use system preference
        const saved = getThemePreference();
        if (saved !== null) {
            setIsDark(saved === 'dark');
        } else {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDark(systemDark);
        }
        setIsReady(true);
    }, []);

    // Sync theme to <html data-theme>
    useEffect(() => {
        if (!isReady) return;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }, [isDark, isReady]);

    const toggleTheme = () => {
        const newValue = !isDark;
        setIsDark(newValue);
        setThemePreference(newValue ? 'dark' : 'light');
    };

    // Prevent flash of unstyled content
    if (!isReady) return null;

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
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
