import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';

export default function FilterDropdown({ label, options, value, onChange, color }) {
    const { colors, isDark } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    const displayValue = value || 'All';
    const accentColor = color || colors.accent;

    // For Android, use the native Picker
    if (Platform.OS === 'android') {
        return (
            <View style={styles.container}>
                <View style={[styles.labelContainer, { backgroundColor: accentColor }]}>
                    <Text style={styles.label}>{label}</Text>
                </View>
                <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Picker
                        selectedValue={value}
                        onValueChange={onChange}
                        style={[styles.picker, { color: colors.text }]}
                        dropdownIconColor={colors.textSecondary}
                    >
                        <Picker.Item label="All" value="" color={colors.text} />
                        {options && options.map((opt) => (
                            <Picker.Item key={opt} label={opt} value={opt} color={colors.text} />
                        ))}
                    </Picker>
                </View>
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
                style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]} 
                onPress={handleOpen}
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
});
