import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PriceBlock = ({ label, price, bg, align = 'right' }) => (
    <View style={styles.blockRow}>
        <View style={[styles.card, { backgroundColor: bg, alignItems: align === 'right' ? 'center' : 'center' }]}>
            <Text style={[styles.blockLabel, { color: bg === '#facc15' ? 'black' : 'white' }]}>{label}</Text>
            <Text style={[styles.blockPrice, { color: bg === '#facc15' ? 'black' : 'white' }]}>${price}</Text>
        </View>
        {/* Connector Line to show "stack" visually? */}
        <View style={styles.connector} />
    </View>
);

export default function PriceWaterfallMobile({ stats, costs }) {
    if (!stats) return null;

    const terminalPrice = stats.current_terminal_avg;
    const shippingPrice = stats.current_shipping_avg;

    // Derived
    const retailPrice = (terminalPrice * 1.4).toFixed(2);
    const totalCosts = Object.values(costs).reduce((a, b) => a + parseFloat(b), 0);
    const farmPrice = (shippingPrice - totalCosts).toFixed(2);

    return (
        <View style={styles.container}>
            {/* Main Blue Bar in background representing the chain? Or just separate Cards. 
                Mobile is better with vertical stack of Cards.
            */}
            <View style={styles.timelineLine} />

            <PriceBlock
                label="National Retail"
                price={retailPrice}
                bg="#d946ef" // Purple 
            />

            <PriceBlock
                label="Terminal Market"
                price={terminalPrice.toFixed(2)}
                bg="#0ea5e9" // Blue 
            />

            <PriceBlock
                label="Shipping Point"
                price={shippingPrice.toFixed(2)}
                bg="#fdba74" // Orange (Darker text handled in component) 
            />

            <PriceBlock
                label="Reference Farm"
                price={farmPrice}
                bg="#facc15" // Yellow 
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
        alignItems: 'center',
        position: 'relative'
    },
    timelineLine: {
        position: 'absolute',
        width: 4,
        height: '100%',
        backgroundColor: '#cbd5e1',
        left: '50%',
        zIndex: -1
    },
    blockRow: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
    },
    card: {
        width: '60%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        alignItems: 'center'
    },
    blockLabel: {
        fontWeight: 'bold',
        marginBottom: 4,
        fontSize: 12,
        textAlign: 'center'
    },
    blockPrice: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center'
    }
});
