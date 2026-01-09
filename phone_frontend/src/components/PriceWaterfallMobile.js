import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';

const PackageSelector = ({ options, selectedValue, onValueChange, isDark }) => {
    const [modalVisible, setModalVisible] = useState(false);

    if (!options || options.length === 0) return null;

    const textColor = isDark ? 'black' : 'white';
    const bgColor = isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';

    // Truncate long package names
    const displayValue = selectedValue?.length > 20
        ? selectedValue.substring(0, 18) + '...'
        : selectedValue || 'Select';

    return (
        <>
            <TouchableOpacity
                style={[styles.selectorPill, { backgroundColor: bgColor }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={[styles.selectorText, { color: textColor }]} numberOfLines={1}>
                    📦 {displayValue}
                </Text>
                <Text style={[styles.chevron, { color: textColor }]}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Package</Text>
                        <FlatList
                            data={options}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        selectedValue === item && styles.optionItemSelected
                                    ]}
                                    onPress={() => {
                                        onValueChange(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        selectedValue === item && styles.optionTextSelected
                                    ]}>
                                        {item}
                                    </Text>
                                    {selectedValue === item && (
                                        <Text style={styles.checkmark}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            style={styles.optionsList}
                        />
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const PriceBlock = ({ label, lowPrice, highPrice, bg, options, selectedValue, onValueChange }) => {
    const isDark = bg === '#facc15' || bg === '#fdba74';
    const textColor = isDark ? 'black' : 'white';
    const subTextColor = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';

    return (
        <View style={styles.blockRow}>
            <View style={[styles.card, { backgroundColor: bg }]}>
                <Text style={[styles.blockLabel, { color: textColor }]}>{label}</Text>

                <View style={styles.priceRow}>
                    <View style={styles.priceColumn}>
                        <Text style={[styles.priceSubLabel, { color: subTextColor }]}>Low</Text>
                        <Text style={[styles.blockPrice, { color: textColor }]}>${lowPrice}</Text>
                    </View>
                    <Text style={[styles.priceDivider, { color: subTextColor }]}>–</Text>
                    <View style={styles.priceColumn}>
                        <Text style={[styles.priceSubLabel, { color: subTextColor }]}>High</Text>
                        <Text style={[styles.blockPrice, { color: textColor }]}>${highPrice}</Text>
                    </View>
                </View>

                <PackageSelector
                    options={options}
                    selectedValue={selectedValue}
                    onValueChange={onValueChange}
                    isDark={isDark}
                />
            </View>
            <View style={styles.connector} />
        </View>
    );
};

export default function PriceWaterfallMobile({ stats, costs, packageData, actions }) {
    if (!stats) return null;

    const terminalLow = stats.terminal_low_avg;
    const terminalHigh = stats.terminal_high_avg;
    const shippingLow = stats.shipping_low_avg;
    const shippingHigh = stats.shipping_high_avg;

    // Derived prices
    const retailLow = (terminalLow * 1.4).toFixed(2);
    const retailHigh = (terminalHigh * 1.4).toFixed(2);
    const totalCosts = Object.values(costs).reduce((a, b) => a + parseFloat(b), 0);
    const farmLow = (shippingLow - totalCosts).toFixed(2);
    const farmHigh = (shippingHigh - totalCosts).toFixed(2);

    return (
        <View style={styles.container}>
            <View style={styles.timelineLine} />

            <PriceBlock
                label="National Retail"
                lowPrice={retailLow}
                highPrice={retailHigh}
                bg="#d946ef"
            />

            <PriceBlock
                label="Terminal Market"
                lowPrice={terminalLow.toFixed(2)}
                highPrice={terminalHigh.toFixed(2)}
                bg="#0ea5e9"
                options={packageData?.terminal}
                selectedValue={actions?.selectedPackages?.terminal}
                onValueChange={(v) => actions?.setPackage('terminal', v)}
            />

            <PriceBlock
                label="Shipping Point"
                lowPrice={shippingLow.toFixed(2)}
                highPrice={shippingHigh.toFixed(2)}
                bg="#fdba74"
                options={packageData?.shipping}
                selectedValue={actions?.selectedPackages?.shipping}
                onValueChange={(v) => actions?.setPackage('shipping', v)}
            />

            <PriceBlock
                label="Reference Farm"
                lowPrice={farmLow}
                highPrice={farmHigh}
                bg="#facc15"
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
        marginBottom: 12,
    },
    card: {
        width: '70%',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        alignItems: 'center'
    },
    blockLabel: {
        fontWeight: '600',
        marginBottom: 8,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.9
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    priceColumn: {
        alignItems: 'center',
    },
    priceSubLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginBottom: 2,
    },
    priceDivider: {
        fontSize: 18,
        fontWeight: '300',
        marginHorizontal: 4,
    },
    blockPrice: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    connector: {
        width: 2,
        height: 8,
        backgroundColor: '#cbd5e1',
    },

    // Package Selector Pill
    selectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginTop: 8,
        gap: 4,
    },
    selectorText: {
        fontSize: 11,
        fontWeight: '500',
    },
    chevron: {
        fontSize: 8,
        marginLeft: 4,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        width: '100%',
        maxHeight: '70%',
        padding: 0,
        overflow: 'hidden',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        color: '#1f2937',
    },
    optionsList: {
        maxHeight: 300,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    optionItemSelected: {
        backgroundColor: '#f0fdf4',
    },
    optionText: {
        fontSize: 15,
        color: '#374151',
        flex: 1,
    },
    optionTextSelected: {
        color: '#059669',
        fontWeight: '600',
    },
    checkmark: {
        fontSize: 16,
        color: '#059669',
        fontWeight: 'bold',
    },
    cancelButton: {
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
});
