import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStats } from '../services/supabaseApi';

export default function WatchlistAccordionItem({ item, expanded, onToggle, onPressDashboard }) {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (expanded && !stats) {
            getStats(item.commodity).then(setStats).catch(console.error);
        }
    }, [expanded, item.commodity]);

    // Helper to format currency
    const formatPrice = (price) => price ? `$${price.toFixed(2)}` : 'N/A';
    
    // Helper for percentage change 
    const renderPercentChange = (val) => {
        const roundedVal = Math.round(val);
        const color = roundedVal >= 0 ? '#16a34a' : '#dc2626';
        const arrow = roundedVal >= 0 ? '▲' : '▼';
        
        return (
            <Text style={[styles.percentText, { color }]}>
                {arrow} {Math.abs(roundedVal)}% This Week
            </Text>
        );
    };

    // Helper to determine unit display
    const getUnitText = () => {
        if (!stats?.package_unit) return '/lb';
        // Simple logic: if unit is short, use it, else generic? 
        // For now, use what API returns but keep it concise if possible.
        return `/${stats.package_unit}`;
    };

    return (
        <View style={styles.card}>
            <TouchableOpacity 
                style={styles.header} 
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <Text style={styles.title}>{item.commodity}</Text>
                <Ionicons 
                    name={expanded ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#475569" 
                />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.details}>
                    {/* Date Block Top Left */}
                    <View style={styles.dateBlock}>
                       <Text style={styles.dateText}>
                            {stats?.date ? new Date(stats.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Loading...'}
                        </Text>
                    </View>

                    <View style={styles.metricsContainer}>
                        {/* Retail Metric */}
                        {stats?.retail?.avg > 0 && (
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Retail: </Text>
                                <Text style={styles.metricValue}>
                                    {formatPrice(stats.retail.avg)}
                                    <Text style={styles.unitText}>{getUnitText()}</Text>
                                </Text>
                                {renderPercentChange(stats.retail.pct_change)}
                            </View>
                        )}

                        {/* Terminal Metric */}
                        {stats?.terminal?.avg > 0 && (
                             <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Terminal: </Text>
                                <Text style={[styles.metricValue, { color: '#dc2626' }]}>
                                    {formatPrice(stats.terminal.avg)}
                                    <Text style={styles.unitText}>{getUnitText()}</Text>
                                </Text>
                                {renderPercentChange(stats.terminal.pct_change)}
                            </View>
                        )}

                         {/* Shipping Metric */}
                         {stats?.shipping?.avg > 0 && (
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Shipping: </Text>
                                <Text style={[styles.metricValue, { color: '#16a34a' }]}>
                                    {formatPrice(stats.shipping.avg)}
                                    <Text style={styles.unitText}>{getUnitText()}</Text>
                                </Text>
                                {renderPercentChange(stats.shipping.pct_change)}
                            </View>
                         )}
                    </View>

                    <Text style={styles.marketNotes}>
                        <Text style={{fontWeight: 'bold'}}>Market Notes: </Text>
                        Demand Exceeds Supply
                    </Text>

                    <TouchableOpacity 
                        style={styles.dashboardButton}
                        onPress={onPressDashboard}
                    >
                        <Text style={styles.dashboardButtonText}>Go to Price Dashboard</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc', 
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    details: {
        padding: 16,
        paddingTop: 0,
        backgroundColor: '#f8fafc',
    },
    dateBlock: {
        marginBottom: 8,
    },
    dateText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    metricsContainer: {
        marginBottom: 12,
    },
    metricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    metricLabel: {
        fontWeight: 'bold',
        color: '#1e293b',
        fontSize: 14,
    },
    metricValue: {
        fontWeight: 'bold',
        color: '#16a34a', 
        fontSize: 14,
    },
    unitText: {
        color: '#16a34a', // Match price color for the unit too? Or keep gray? Mockup shows green.
        fontSize: 14,
        fontWeight: 'bold',
    },
    percentText: {
        fontSize: 10,
        marginLeft: 8,
        fontWeight: 'bold',
    },
    marketNotes: {
        fontSize: 13,
        color: '#334155',
        marginBottom: 16,
    },
    dashboardButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 10,
        borderRadius: 20, 
        alignItems: 'center',
         shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    dashboardButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
