import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';

export default function FilterDropdown({ label, options, value, onChange, color, disabled }) {
    const { colors, isDark } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    const displayValue = value || 'All';
    const accentColor = disabled ? colors.border : (color || colors.accent); // Gray out label if disabled

    // For Android, use a themed modal list instead of the native Picker.
    // The native Android dropdown popup is drawn by the OS theme (white background)
    // and can't be styled from JS, so in dark mode light item text is invisible.
    if (Platform.OS === 'android') {
        const allOptions = [{ label: 'All', value: '' }, ...(options || []).map((opt) => ({ label: opt, value: opt }))];

        const handleSelect = (val) => {
            onChange(val);
            setModalVisible(false);
        };

        return (
            <View style={styles.container}>
                <View style={[styles.labelContainer, { backgroundColor: accentColor }]}>
                    <Text style={styles.label}>{label}</Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.selectButton,
                        {
                            backgroundColor: disabled ? colors.background : colors.surface,
                            borderColor: colors.border,
                            opacity: disabled ? 0.7 : 1,
                        },
                    ]}
                    onPress={() => setModalVisible(true)}
                    disabled={disabled}
                >
                    <Text style={[styles.selectButtonText, { color: disabled ? colors.textMuted : colors.text }]}>
                        {displayValue}
                    </Text>
                    <Text style={[styles.chevron, { color: colors.textSecondary }]}>▼</Text>
                </TouchableOpacity>

                <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                    <TouchableOpacity
                        style={styles.androidModalOverlay}
                        activeOpacity={1}
                        onPress={() => setModalVisible(false)}
                    >
                        <View style={[styles.androidModalContent, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
                            </View>
                            <ScrollView style={styles.androidOptionList}>
                                {allOptions.map((opt) => {
                                    const selected = opt.value === (value || '');
                                    return (
                                        <TouchableOpacity
                                            key={opt.value || 'all'}
                                            style={[
                                                styles.androidOption,
                                                { borderBottomColor: colors.border },
                                                selected && { backgroundColor: colors.surfaceElevated },
                                            ]}
                                            onPress={() => handleSelect(opt.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.androidOptionText,
                                                    { color: selected ? accentColor : colors.text },
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                            {selected && (
                                                <Text style={[styles.androidCheck, { color: accentColor }]}>✓</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </View>
        );
    }

    // For iOS, use a modal-based picker so scrolling doesn't immediately select
    const handleOpen = () => {
        setTempValue(value);
        setModalVisible(true);
    };

    const handleConfirm = () => {
        onChange(tempValue);
        setModalVisible(false);
    };

    const handleCancel = () => {
        setTempValue(value);
        setModalVisible(false);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.labelContainer, { backgroundColor: accentColor }]}>
                <Text style={styles.label}>{label}</Text>
            </View>
            <TouchableOpacity 
                style={[
                    styles.selectButton, 
                    { 
                        backgroundColor: disabled ? colors.background : colors.surface, 
                        borderColor: colors.border,
                        opacity: disabled ? 0.7 : 1
                    }
                ]} 
                onPress={handleOpen}
                disabled={disabled}
            >
                <Text style={[styles.selectButtonText, { color: colors.text }]}>{displayValue}</Text>
                <Text style={[styles.chevron, { color: colors.textSecondary }]}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <TouchableOpacity onPress={handleCancel}>
                                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
                            <TouchableOpacity onPress={handleConfirm}>
                                <Text style={[styles.doneText, { color: accentColor }]}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <Picker
                            selectedValue={tempValue}
                            onValueChange={setTempValue}
                            style={styles.modalPicker}
                            itemStyle={[styles.pickerItem, { color: colors.text }]}
                        >
                            <Picker.Item label="All" value="" />
                            {options && options.map((opt) => (
                                <Picker.Item key={opt} label={opt} value={opt} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    labelContainer: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
    },
    label: {
        color: '#0f172a',
        fontSize: 12,
        fontWeight: '600',
    },
    pickerContainer: {
        borderWidth: 1,
        borderTopWidth: 0,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        overflow: 'hidden',
    },
    picker: {
        height: Platform.OS === 'ios' ? 120 : 44,
    },
    pickerItem: {
        fontSize: 16,
    },
    // iOS Select Button
    selectButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderTopWidth: 0,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 14,
    },
    selectButtonText: {
        fontSize: 16,
    },
    chevron: {
        fontSize: 12,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContent: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    cancelText: {
        fontSize: 17,
    },
    doneText: {
        fontSize: 17,
        fontWeight: '600',
    },
    modalPicker: {
        height: 216,
    },
    // Android themed modal list
    androidModalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    androidModalContent: {
        width: '85%',
        maxHeight: '70%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    androidOptionList: {
        flexGrow: 0,
    },
    androidOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    androidOptionText: {
        fontSize: 16,
    },
    androidCheck: {
        fontSize: 16,
        fontWeight: '700',
    },
});
