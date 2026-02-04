import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const DropdownSelector = ({ label, options, selectedValue, onValueChange, isCardDark }) => {
    const { colors, isDark } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);

    if (!options || options.length === 0) return null;

    const textColor = isCardDark ? 'black' : 'white';
    const bgColor = isCardDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';

    // Truncate long names
    const displayValue = selectedValue?.length > 15
        ? selectedValue.substring(0, 13) + '...'
        : selectedValue || 'All';

    return (
        <>
            <TouchableOpacity
                style={[styles.selectorPill, { backgroundColor: bgColor }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={[styles.selectorText, { color: textColor }]} numberOfLines={1}>
                    {label}: {displayValue}
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
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, borderBottomColor: colors.border }]}>Select {label}</Text>
                        <FlatList
                            data={['All', ...options]}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        { borderBottomColor: colors.border },
                                        (selectedValue === item || (item === 'All' && !selectedValue)) && { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#f0fdf4' }
                                    ]}
                                    onPress={() => {
                                        onValueChange(item === 'All' ? '' : item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        { color: colors.text },
                                        (selectedValue === item || (item === 'All' && !selectedValue)) && { color: colors.accent, fontWeight: '600' }
                                    ]}>
                                        {item}
                                    </Text>
                                    {(selectedValue === item || (item === 'All' && !selectedValue)) && (
                                        <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            style={styles.optionsList}
                        />
                        <TouchableOpacity
                            style={[styles.cancelButton, { borderTopColor: colors.border }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const PriceBlock = ({ 
    label, 
    avgPrice, 
    bg, 
    packageOptions, 
    selectedPackage, 
    onPackageChange,
    originOptions,
    selectedOrigin,
    onOriginChange,
    districtOptions,
    selectedDistrict,
    onDistrictChange,
    weightLbs, 
    units 
}) => {
    const isCardDark = bg === '#facc15' || bg === '#fdba74';
    const textColor = isCardDark ? 'black' : 'white';
    const subTextColor = isCardDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';

    // Check if we have valid price data
    const priceValue = parseFloat(avgPrice) || 0;
    const hasData = priceValue > 0;

    // Calculate price per lb or per unit
    const pricePerUnit = (() => {
        if (!hasData) return null;
        if (weightLbs && weightLbs > 0) {
            return { value: (priceValue / weightLbs).toFixed(2), unit: 'lb' };
        }
        if (units && units > 0) {
            return { value: (priceValue / units).toFixed(2), unit: 'unit' };
        }
        return null;
    })();

    return (
        <View style={styles.blockRow}>
            <View style={[styles.card, { backgroundColor: bg }]}>
                <Text style={[styles.blockLabel, { color: textColor }]}>
                    {label}
                </Text>

                {/* Price Display */}
                <View style={styles.priceContainer}>
                    {hasData ? (
                        <>
                            <Text style={[styles.priceSubLabel, { color: subTextColor }]}>Avg Price</Text>
                            <Text style={[styles.blockPrice, { color: textColor }]}>${avgPrice}</Text>
                        </>
                    ) : (
                        <Text style={[styles.noDataText, { color: subTextColor }]}>No Price Data</Text>
                    )}
                </View>

                {/* Price per unit */}
                {pricePerUnit && (
                    <Text style={[styles.pricePerUnit, { color: subTextColor }]}>
                        ${pricePerUnit.value}/{pricePerUnit.unit}
                    </Text>
                )}

                {/* Package Selector */}
                <DropdownSelector
                    label="Package"
                    options={packageOptions}
                    selectedValue={selectedPackage}
                    onValueChange={onPackageChange}
                    isCardDark={isCardDark}
                />

                {/* Origin Selector */}
                {originOptions && originOptions.length > 0 && (
                    <DropdownSelector
                        label="Origin"
                        options={originOptions}
                        selectedValue={selectedOrigin}
                        onValueChange={onOriginChange}
                        isCardDark={isCardDark}
                    />
                )}

                {/* District Selector */}
                {districtOptions && districtOptions.length > 0 && (
                    <DropdownSelector
                        label="District"
                        options={districtOptions}
                        selectedValue={selectedDistrict}
                        onValueChange={onDistrictChange}
                        isCardDark={isCardDark}
                    />
                )}
            </View>
            <View style={styles.connector} />
        </View>
    );
};

export default function PriceWaterfallMobile({ stats, costs, packageData, actions, weightData, originData, districtData }) {
    if (!stats) return null;

    // Helper to safely format numbers
    const formatPrice = (val) => (val ?? 0).toFixed(2);

    // Calculate total user cost
    const totalUserCost = Object.values(costs || {}).reduce((sum, val) => {
        const num = parseFloat(val) || 0;
        return sum + num;
    }, 0);

    // Check if user has configured any costs (not just defaults)
    const hasConfiguredCosts = totalUserCost > 0;

    return (
        <View style={styles.container}>
            <View style={styles.timelineLine} />

            <PriceBlock
                label="National Retail"
                avgPrice={formatPrice(stats.retail_avg)}
                bg="#d946ef"
                packageOptions={packageData?.retail}
                selectedPackage={actions?.selectedPackages?.retail}
                onPackageChange={(v) => actions?.setPackage('retail', v)}
                originOptions={originData?.retail}
                selectedOrigin={actions?.selectedOrigins?.retail}
                onOriginChange={(v) => actions?.setOrigin('retail', v)}
                districtOptions={districtData?.retail}
                selectedDistrict={actions?.selectedDistricts?.retail}
                onDistrictChange={(v) => actions?.setDistrict('retail', v)}
                weightLbs={weightData?.retail?.weight_lbs}
                units={weightData?.retail?.units}
            />

            <PriceBlock
                label="Terminal Market"
                avgPrice={formatPrice(stats.terminal_avg)}
                bg="#0ea5e9"
                packageOptions={packageData?.terminal}
                selectedPackage={actions?.selectedPackages?.terminal}
                onPackageChange={(v) => actions?.setPackage('terminal', v)}
                originOptions={originData?.terminal}
                selectedOrigin={actions?.selectedOrigins?.terminal}
                onOriginChange={(v) => actions?.setOrigin('terminal', v)}
                districtOptions={districtData?.terminal}
                selectedDistrict={actions?.selectedDistricts?.terminal}
                onDistrictChange={(v) => actions?.setDistrict('terminal', v)}
                weightLbs={weightData?.terminal?.weight_lbs}
                units={weightData?.terminal?.units}
            />

            <PriceBlock
                label="Shipping Point"
                avgPrice={formatPrice(stats.shipping_avg)}
                bg="#fdba74"
                packageOptions={packageData?.shipping}
                selectedPackage={actions?.selectedPackages?.shipping}
                onPackageChange={(v) => actions?.setPackage('shipping', v)}
                originOptions={originData?.shipping}
                selectedOrigin={actions?.selectedOrigins?.shipping}
                onOriginChange={(v) => actions?.setOrigin('shipping', v)}
                districtOptions={districtData?.shipping}
                selectedDistrict={actions?.selectedDistricts?.shipping}
                onDistrictChange={(v) => actions?.setDistrict('shipping', v)}
                weightLbs={weightData?.shipping?.weight_lbs}
                units={weightData?.shipping?.units}
            />

            {/* Your Cost Block - shown when costs are configured */}
            {hasConfiguredCosts && (
                <View style={styles.blockRow}>
                    <View style={[styles.card, styles.yourCostCard]}>
                        <Text style={styles.yourCostLabel}>YOUR COST</Text>
                        <View style={styles.priceContainer}>
                            <Text style={styles.yourCostSubLabel}>Total Costs</Text>
                            <Text style={styles.yourCostPrice}>${formatPrice(totalUserCost)}</Text>
                        </View>
                        <View style={styles.costBreakdown}>
                            {Object.entries(costs || {}).map(([key, val]) => {
                                const numVal = parseFloat(val) || 0;
                                if (numVal === 0) return null;
                                return (
                                    <Text key={key} style={styles.costItem}>
                                        {key.charAt(0).toUpperCase() + key.slice(1)}: ${numVal.toFixed(2)}
                                    </Text>
                                );
                            })}
                        </View>
                    </View>
                </View>
            )}

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
        width: '75%',
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
    priceContainer: {
        alignItems: 'center',
        marginBottom: 4,
    },
    priceSubLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginBottom: 2,
    },
    blockPrice: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    pricePerUnit: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
        marginBottom: 8,
        textAlign: 'center',
    },
    noDataText: {
        fontSize: 16,
        fontWeight: '600',
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    connector: {
        width: 2,
        height: 8,
        backgroundColor: '#cbd5e1',
    },

    // Dropdown Selector Pill
    selectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginTop: 6,
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

    // Your Cost Block Styles
    yourCostCard: {
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#16a34a',
    },
    yourCostLabel: {
        fontWeight: '600',
        marginBottom: 8,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'white',
        opacity: 0.9,
    },
    yourCostSubLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginBottom: 2,
        color: 'rgba(255,255,255,0.8)',
    },
    yourCostPrice: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    costBreakdown: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.3)',
        width: '100%',
    },
    costItem: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        marginBottom: 2,
    },
});
