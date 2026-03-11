/**
 * ErrorBoundary — Catches rendering errors in child components
 *
 * Used to wrap each waterfall chart so that a failure in one
 * doesn't crash the entire comparison view.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.icon}>⚠️</Text>
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.message}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </Text>
                    <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        minHeight: 200,
    },
    icon: {
        fontSize: 32,
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    message: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#22c55e',
        borderRadius: 10,
    },
    retryText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 14,
    },
});
