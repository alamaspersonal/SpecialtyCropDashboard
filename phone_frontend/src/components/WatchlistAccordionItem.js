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
