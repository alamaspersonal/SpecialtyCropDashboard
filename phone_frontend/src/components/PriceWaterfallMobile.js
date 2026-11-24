import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatReportDate } from '../shared/dates';
import { unitInfo } from '../shared/priceEntries';

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

// Change vs the prior period in the same unit, or null when there is nothing
// to compare (no prior price, or no change to the cent).
function priceChange(avg, priorAvg, isCardDark) {
    if (avg == null || priorAvg == null || !(priorAvg > 0)) return null;
    if (avg.toFixed(2) === priorAvg.toFixed(2)) return null;
    const isUp = avg > priorAvg;
    return {
        arrow: isUp ? '▲' : '▼',
        percent: ((Math.abs(avg - priorAvg) / priorAvg) * 100).toFixed(0),
        color: isUp ? (isCardDark ? '#065f46' : '#a7f3d0') : (isCardDark ? '#991b1b' : '#fecaca'),
    };
}

// Packages priced per each / per package listed under the headline price
// before collapsing into "+N more".
const MAX_OTHER_PRICES = 5;

const PriceBlock = ({
    label,
    bg,
    market,
    packageOptions,
    selectedPackage,
    onPackageChange,
    originOptions,
    selectedOrigin,
    onOriginChange,
    districtOptions,
    selectedDistrict,
    onDistrictChange,
    varietyOptions,
    selectedVariety,
    onVarietyChange,
    timeRange,
    cpiAdjusted,
}) => {
    const isCardDark = bg === '#facc15' || bg === '#fdba74';
    const textColor = isCardDark ? 'black' : 'white';
    const subTextColor = isCardDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
    const dividerColor = isCardDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';

    // groups[0] is the headline: the $/lb average across every package with a
    // known weight, or — when nothing is sold by weight — the most-reported
    // package. The rest are packages priced per each / per package, which
    // can't be averaged with other sizes, so each is listed on its own.
    const groups = market?.groups || [];
    const [headline, ...others] = groups;
    const dateRange = market?.dateRange;
    const priorDateRange = market?.priorDateRange;
    const reportCount = market?.reportCount;
    const showChange = timeRange !== 'custom';

    // Format date for display (in UTC — report dates are midnight-UTC days).
    // An edge from monthly data is only known to the month ("Oct 2026").
    const formatDate = (dateStr, isMonth = false) => (isMonth
        ? formatReportDate(dateStr, { month: 'short', year: 'numeric' })
        : formatReportDate(dateStr));

    const dateLabel = (() => {
        if (!dateRange) return null;
        const start = formatDate(dateRange.start, dateRange.startIsMonth);
        const end = formatDate(dateRange.end, dateRange.endIsMonth);
        return start === end ? start : `${start} – ${end}`;
    })();

    // Which packages the headline covers
    const headlineCaption = (() => {
        if (!headline) return null;
        if (headline.basis === 'lb' && headline.packages.length > 1) {
            return `Avg of ${headline.packages.length} packages`;
        }
        return selectedPackage ? null : headline.packages[0] || null;
    })();

    const headlineChange = (() => {
        const change = showChange && headline ? priceChange(headline.avg, headline.priorAvg, isCardDark) : null;
        if (!change) return null;
        const isPeriod = timeRange === '7day' || timeRange === '30day';
        const dateStr = (() => {
            if (!priorDateRange || !priorDateRange.end) return '';
            if (isPeriod && priorDateRange.start && priorDateRange.start !== priorDateRange.end) {
                return ` on ${formatDate(priorDateRange.start)} to ${formatDate(priorDateRange.end)}`;
            }
            return ` on ${formatDate(priorDateRange.end)}`;
        })();
        const observationWord = isPeriod ? 'observations' : 'observation';
        return { text: `${change.arrow} ${change.percent}% from last ${observationWord}${dateStr}`, color: change.color };
    })();

    return (
        <View style={styles.blockRow}>
            <View style={[styles.card, { backgroundColor: bg }]}>
                <Text style={[styles.blockLabel, { color: textColor }]}>
                    {label}
                </Text>
                {(selectedVariety || (!selectedVariety && varietyOptions?.length === 1)) ? (
                    <Text style={{ fontSize: 12, color: subTextColor, textAlign: 'center', marginTop: -4, marginBottom: 4 }}>
                        {selectedVariety || varietyOptions[0]}
                    </Text>
                ) : null}

                {/* Price Display */}
                <View style={styles.priceContainer}>
                    {headline ? (
                        <>
                            <Text style={[styles.priceSubLabel, { color: subTextColor }]}>
                                {unitInfo(headline.basis).title}
                            </Text>
                            <Text style={[styles.blockPrice, { color: textColor }]}>
                                ${headline.avg.toFixed(2)}
                            </Text>
                            {headlineCaption && (
                                <Text style={[styles.priceCaption, { color: subTextColor }]} numberOfLines={2}>
                                    {headlineCaption}
                                </Text>
                            )}
                            {cpiAdjusted && (
                                <Text style={{ fontSize: 9, color: subTextColor, textAlign: 'center', marginTop: 2, opacity: 0.75 }}>
                                    Adjusted for inflation
                                </Text>
                            )}
                        </>
                    ) : (
                        <Text style={[styles.noDataText, { color: subTextColor }]}>No Price Data</Text>
                    )}
                </View>

                {/* Timeline Differential Ticker */}
                {headlineChange && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: headlineChange.color, marginBottom: 4, textAlign: 'center' }}>
                        {headlineChange.text}
                    </Text>
                )}

                {/* Package price, for a single package priced by weight */}
                {headline?.basis === 'lb' && headline.packages.length === 1 && headline.packageAvg != null && (
                    <Text style={[styles.pricePerUnit, { color: subTextColor }]}>
                        ${headline.packageAvg.toFixed(2)} per package
                    </Text>
                )}

                {/* Packages priced per each / per package, kept separate */}
                {others.length > 0 && (
                    <View style={[styles.otherPrices, { borderTopColor: dividerColor }]}>
                        <Text style={[styles.otherPricesTitle, { color: subTextColor }]}>
                            {headline.basis === 'lb' ? 'Not sold by weight' : 'Other packages'}
                        </Text>
                        {others.slice(0, MAX_OTHER_PRICES).map(g => {
                            const change = showChange ? priceChange(g.avg, g.priorAvg, isCardDark) : null;
                            return (
                                <View key={g.key} style={styles.otherPriceRow}>
                                    <Text style={[styles.otherPriceLabel, { color: subTextColor }]} numberOfLines={2}>
                                        {g.packages[0] || 'Package not listed'}
                                    </Text>
                                    <Text style={[styles.otherPriceValue, { color: textColor }]}>
                                        ${g.avg.toFixed(2)}{unitInfo(g.basis).suffix}
                                        {change && (
                                            <Text style={{ color: change.color }}>{` ${change.arrow}${change.percent}%`}</Text>
                                        )}
                                    </Text>
                                </View>
                            );
                        })}
                        {others.length > MAX_OTHER_PRICES && (
                            <Text style={[styles.otherPricesMore, { color: subTextColor }]}>
                                +{others.length - MAX_OTHER_PRICES} more · pick a package to see it
                            </Text>
                        )}
                    </View>
                )}

                {/* Date Range & Report Count */}
                {(dateLabel || reportCount != null) && (
                    <View style={styles.metadataContainer}>
                        {dateLabel && (
                            <Text style={[styles.metadataText, { color: subTextColor }]}>
                                {dateLabel}
                            </Text>
                        )}
                        {reportCount != null && reportCount > 0 && (
                            <Text style={[styles.metadataText, { color: subTextColor }]}>
                                Based on {reportCount} report{reportCount !== 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>
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

                {/* Variety Selector */}
                {varietyOptions && varietyOptions.length > 1 && (
                    <DropdownSelector
                        label="Variety"
                        options={varietyOptions}
                        selectedValue={selectedVariety}
                        onValueChange={onVarietyChange}
                        isCardDark={isCardDark}
                    />
                )}
            </View>
            <View style={styles.connector} />
        </View>
    );
};

const BLOCKS = [
    { type: 'retail', label: 'National Retail', bg: '#d946ef' },
    { type: 'terminal', label: 'Terminal Market', bg: '#0ea5e9' },
    { type: 'shipping', label: 'Shipping Point', bg: '#fdba74' },
];

export default function PriceWaterfallMobile({ stats, packageData, actions, originData, districtData, varietyData, cpiAdjusted }) {
    if (!stats) return null;

    return (
        <View style={styles.container}>
            <View style={styles.timelineLine} />

            {BLOCKS.map(({ type, label, bg }) => (
                <PriceBlock
                    key={type}
                    label={label}
                    bg={bg}
                    market={stats.markets?.[type]}
                    packageOptions={packageData?.[type]}
                    selectedPackage={actions?.selectedPackages?.[type]}
                    onPackageChange={(v) => actions?.setPackage(type, v)}
                    originOptions={originData?.[type]}
                    selectedOrigin={actions?.selectedOrigins?.[type]}
                    onOriginChange={(v) => actions?.setOrigin(type, v)}
                    districtOptions={districtData?.[type]}
                    selectedDistrict={actions?.selectedDistricts?.[type]}
                    onDistrictChange={(v) => actions?.setDistrict(type, v)}
                    varietyOptions={varietyData?.[type]}
                    selectedVariety={actions?.selectedVarieties?.[type]}
                    onVarietyChange={(v) => actions?.setVariety(type, v)}
                    timeRange={stats.timeRange}
                    cpiAdjusted={cpiAdjusted}
                />
            ))}
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
        marginBottom: 4,
        textAlign: 'center',
    },
    priceCaption: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 2,
        textAlign: 'center',
    },
    otherPrices: {
        width: '100%',
        borderTopWidth: 1,
        paddingTop: 6,
        marginBottom: 6,
    },
    otherPricesTitle: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        textAlign: 'center',
        marginBottom: 4,
    },
    otherPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 2,
    },
    otherPriceLabel: {
        flex: 1,
        fontSize: 11,
    },
    otherPriceValue: {
        fontSize: 12,
        fontWeight: '700',
    },
    otherPricesMore: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
        fontStyle: 'italic',
    },
    metadataContainer: {
        alignItems: 'center',
        marginBottom: 6,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
        width: '100%',
    },
    metadataText: {
        fontSize: 10,
        fontWeight: '400',
        textAlign: 'center',
        marginTop: 2,
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

});
