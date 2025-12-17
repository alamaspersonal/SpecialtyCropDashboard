import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PriceBarChart({ currentPrice, priorPrice, currentDate, priorDate }) {
    // Normalize values for bar width calculation
    const maxPrice = Math.max(currentPrice?.high || 0, priorPrice?.high || 0) * 1.2; // Add 20% buffer

    const getBarWidth = (value) => {
        if (!maxPrice || !value) return 0;
        return `${(value / maxPrice) * 100}%`;
    };

    const renderBar = (label, price, color) => (
        <View style={styles.barRow}>
            <View style={[styles.barLabelContainer, { backgroundColor: color }]}>
                <Text style={styles.barLabel}>{label}</Text>
            </View>
            <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: getBarWidth(price?.high), backgroundColor: '#0e7490' }]} />
                {/* Low price marker */}
                {price?.low && (
                    <View style={[styles.lowMarker, { left: getBarWidth(price.low) }]} />
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Most Recent Price */}
            <View style={styles.column}>
                <Text style={styles.columnHeader}>Most recent price</Text>
                <Text style={styles.dateLabel}>({currentDate})</Text>
                <View style={styles.barsContainer}>
                    {renderBar('Terminal market price', currentPrice, '#0ea5e9')}
                    {/* Placeholders for other price types to match mockup layout */}
                    <View style={[styles.placeholderBar, { backgroundColor: '#e879f9' }]}><Text style={styles.placeholderText}>National retail price</Text></View>
                    <View style={[styles.placeholderBar, { backgroundColor: '#fdba74' }]}><Text style={styles.placeholderText}>Shipping point price</Text></View>
                    <View style={[styles.placeholderBar, { backgroundColor: '#fef08a' }]}><Text style={styles.placeholderText}>Reference farm price</Text></View>
                </View>
            </View>

            {/* Prior Week Price */}
            <View style={styles.column}>
                <Text style={styles.columnHeader}>Price at prior week</Text>
                <Text style={styles.dateLabel}>({priorDate || 'N/A'})</Text>
                <View style={styles.barsContainer}>
                    {renderBar('Terminal market price', priorPrice, '#0ea5e9')}
                    {/* Placeholders */}
                    <View style={[styles.placeholderBar, { backgroundColor: '#e879f9' }]}><Text style={styles.placeholderText}>National retail price</Text></View>
                    <View style={[styles.placeholderBar, { backgroundColor: '#fdba74' }]}><Text style={styles.placeholderText}>Shipping point price</Text></View>
                    <View style={[styles.placeholderBar, { backgroundColor: '#fef08a' }]}><Text style={styles.placeholderText}>Reference farm price</Text></View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
    },
    column: {
        flex: 1,
    },
    columnHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
        color: '#1f2937',
    },
    dateLabel: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 16,
    },
    barsContainer: {
        gap: 12,
    },
    barRow: {
        marginBottom: 8,
    },
    barLabelContainer: {
        padding: 6,
        borderRadius: 4,
        marginBottom: 4,
        alignSelf: 'flex-start',
    },
    barLabel: {
        color: 'black',  // Changed to black for better contrast on light colors
        fontSize: 10,
        fontWeight: '600',
    },
    barTrack: {
        height: 100, // Matching the tall bars in mockup
        backgroundColor: '#f3f4f6',
        borderRadius: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'relative',
    },
    barFill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        backgroundColor: '#155e75', // Dark blue from mockup
    },
    lowMarker: {
        position: 'absolute',
        bottom: 0,
        top: 0,
        width: 2,
        backgroundColor: '#38bdf8', // Light blue line for low price
    },
    placeholderBar: {
        height: 40,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.5, // Faded to indicate data not available
    },
    placeholderText: {
        fontSize: 10,
        textAlign: 'center',
        color: '#374151',
    },
});
