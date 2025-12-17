import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PriceCard({ avgLowPrice, avgHighPrice, recordCount }) {
    return (
        <View style={styles.container}>
            <View style={styles.stat}>
                <Text style={styles.statLabel}>Avg. Low</Text>
                <Text style={styles.statValue}>${avgLowPrice}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
                <Text style={styles.statLabel}>Avg. High</Text>
                <Text style={styles.statValue}>${avgHighPrice}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
                <Text style={styles.statLabel}>Records</Text>
                <Text style={styles.statValue}>{recordCount}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#0d9488',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginBottom: 4,
    },
    statValue: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
    },
    divider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 8,
    },
});
