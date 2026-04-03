import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Detailed Modal Metric Card (Extracted from PriceOverTimeChart) ──
function DetailedMetricCard({ label, color, price, meta, colors }) {
    if (!meta) return null;
    
    const pkgEntries = Object.entries(meta.packagesCount || {}).sort((a, b) => b[1] - a[1]);
    const orgEntries = Object.entries(meta.originsCount || {}).sort((a, b) => b[1] - a[1]);
    const varEntries = Object.entries(meta.varietiesCount || {}).sort((a, b) => b[1] - a[1]);

    const renderList = (title, entries) => {
        if (!entries || entries.length === 0) return null;
        return (
            <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#f8fafc', marginBottom: 4 }}>{title}</Text>
                {entries.map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, paddingLeft: 8 }}>
                        <Text style={{ fontSize: 13, color: '#cbd5e1' }}>{k}</Text>
                        <Text style={{ fontSize: 13, color: '#cbd5e1', fontWeight: '500' }}>{v}</Text>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <View style={{ marginBottom: 16, backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, marginRight: 8 }} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#f8fafc' }}>{label}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: color }}>${Number(price).toFixed(2)}</Text>
                    <Text style={{ fontSize: 12, color: '#94a3b8' }}>{meta.pointCount} readings</Text>
                </View>
            </View>
            <View style={{ padding: 12 }}>
                {renderList('Varieties', varEntries)}
                {renderList('Origins', orgEntries)}
                {renderList('Packages', pkgEntries)}
            </View>
        </View>
    );
}

export default function ExpandableBottomSheet({
    displayTooltip,
    seriesVisibility,
    seriesConfig,
    colors,
    formatMonthLabel
}) {
    // 80px shows the drag handle + date + 1 line of metrics
    const MINIMIZED_HEIGHT = 80;
    const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.7; // 70% of screen height
    const SCROLL_THRESHOLD = 50;

    const [expanded, setExpanded] = useState(false);
    const panY = useRef(new Animated.Value(EXPANDED_HEIGHT - MINIMIZED_HEIGHT)).current;

    const resetPositionAnim = Animated.spring(panY, {
        toValue: expanded ? 0 : EXPANDED_HEIGHT - MINIMIZED_HEIGHT,
        useNativeDriver: true,
        bounciness: 0,
        speed: 12,
    });

    useEffect(() => {
        resetPositionAnim.start();
    }, [expanded]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            // Only set pan responder on move if it is primarily vertical to prevent capturing horizontal scroll gestures (if any exist)
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
            onPanResponderGrant: () => {
                panY.extractOffset();
            },
            onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gestureState) => {
                panY.flattenOffset();
                if (gestureState.dy > SCROLL_THRESHOLD) {
                    setExpanded(false);
                } else if (gestureState.dy < -SCROLL_THRESHOLD) {
                    setExpanded(true);
                } else {
                    if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
                        setExpanded(prev => !prev);
                    } else {
                        resetPositionAnim.start();
                    }
                }
            },
        })
    ).current;

    const animatedStyle = {
        transform: [
            {
                translateY: panY.interpolate({
                    inputRange: [0, EXPANDED_HEIGHT - MINIMIZED_HEIGHT],
                    outputRange: [0, EXPANDED_HEIGHT - MINIMIZED_HEIGHT],
                    extrapolate: 'clamp',
                }),
            },
        ],
    };

    if (!displayTooltip) return null;

    // Determine primary string to show in minimized state
    let primaryPriceStr = 'No reading available';
    let primaryReadingStr = '';
    let primaryColor = colors.text;

    const keys = ['retail', 'terminal', 'shipping'];
    let selectedKey = null;
    for (const key of keys) {
        if (seriesVisibility[key] && displayTooltip[key] != null) {
            selectedKey = key;
            break;
        }
    }

    if (selectedKey) {
        primaryPriceStr = `${seriesConfig[selectedKey].label}: $${Number(displayTooltip[selectedKey]).toFixed(2)}`;
        primaryReadingStr = `${displayTooltip[`${selectedKey}Meta`]?.pointCount || 0} readings`;
        primaryColor = seriesConfig[selectedKey].color;
    }

    return (
        <Animated.View style={[styles.container, { backgroundColor: '#0f172a', borderTopColor: '#334155' }, animatedStyle]}>
            {/* Drag Handle & Minimized Header */}
            <View {...panResponder.panHandlers} style={styles.headerArea}>
                <View style={[styles.dragHandle, { backgroundColor: '#475569' }]} />
                <View style={styles.minimizedContent}>
                    <Text style={[styles.dateText, { color: '#f8fafc' }]}>{formatMonthLabel(displayTooltip.date)}</Text>
                    {expanded ? (
                        <Text style={[styles.swipeText, { color: '#94a3b8' }]}>Swipe down to minimize view</Text>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {selectedKey && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor }} />}
                            <Text style={[styles.priceText, { color: primaryColor }]}>{primaryPriceStr}</Text>
                            <Text style={[styles.readingText, { color: '#94a3b8' }]}>{primaryReadingStr}</Text>
                        </View>
                    )}
                </View>
                {!expanded && <Ionicons name="chevron-up" size={20} color="#94a3b8" style={{ position: 'absolute', right: 24, top: 32 }} />}
            </View>

            {/* Expanded Scrollable Details */}
            <ScrollView style={styles.expandedContent} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                {keys.map((key) => {
                    if (seriesVisibility[key] && displayTooltip[key] != null) {
                        return (
                            <DetailedMetricCard
                                key={key}
                                label={seriesConfig[key].label}
                                color={seriesConfig[key].color}
                                price={displayTooltip[key]}
                                meta={displayTooltip[`${key}Meta`]}
                                colors={colors}
                            />
                        );
                    }
                    return null;
                })}
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: Dimensions.get('window').height * 0.7,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 9999, // Floating on top of EVERYTHING
    },
    headerArea: {
        height: 80,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 10,
        paddingHorizontal: 20,
        backgroundColor: 'transparent',
    },
    dragHandle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 10,
        opacity: 0.5,
    },
    minimizedContent: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    dateText: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    swipeText: {
        fontSize: 13,
    },
    priceText: {
        fontSize: 15,
        fontWeight: '700',
    },
    readingText: {
        fontSize: 12,
    },
    expandedContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
});
