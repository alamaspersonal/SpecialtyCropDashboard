import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getStats } from '../services/supabaseApi';
import { useTheme } from '../context/ThemeContext';

export default function WatchlistAccordionItem({ item, expanded, onToggle, onPressDashboard }) {
    const { colors } = useTheme();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (expanded && !stats) {
            getStats(item.commodity).then(setStats).catch(console.error);
        }
    }, [expanded, item.commodity]);

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity 
                style={[styles.header, { backgroundColor: colors.surface }]} 
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <Text style={[styles.title, { color: colors.text }]}>{item.commodity}</Text>
                <Ionicons 
                    name={expanded ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color={colors.textSecondary} 
                />
            </TouchableOpacity>

            {expanded && (
                <View style={[styles.details, { backgroundColor: colors.surface }]}>
                    {/* Date Block Top Left */}
                    <View style={styles.dateBlock}>
                       <Text style={[styles.dateText, { color: colors.text }]}>
                            {stats?.date ? new Date(stats.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Loading...'}
                        </Text>
                    </View>

                    <Text style={[styles.marketNotes, { color: colors.textSecondary }]}>
                        <Text style={{fontWeight: 'bold'}}>Market Notes: </Text>
                        Demand Exceeds Supply
                    </Text>

                    <TouchableOpacity 
                        style={[styles.dashboardButton, { backgroundColor: colors.accent }]}
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
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    details: {
        padding: 16,
        paddingTop: 0,
    },
    dateBlock: {
        marginBottom: 8,
    },
    dateText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    marketNotes: {
        fontSize: 13,
        marginBottom: 16,
    },
    dashboardButton: {
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
        color: '#0f172a',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
