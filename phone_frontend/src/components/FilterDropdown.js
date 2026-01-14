import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function FilterDropdown({ label, options, value, onChange, color }) {
    const [modalVisible, setModalVisible] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    const displayValue = value || 'All';

    // For Android, use the native Picker directly
    if (Platform.OS === 'android') {
        return (
            <View style={styles.container}>
                <View style={[styles.labelContainer, { backgroundColor: color }]}>
                    <Text style={styles.label}>{label}</Text>
                </View>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={value}
                        onValueChange={onChange}
                        style={styles.picker}
                    >
                        <Picker.Item label="All" value="" />
                        {options && options.map((opt) => (
                            <Picker.Item key={opt} label={opt} value={opt} />
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
            <View style={[styles.labelContainer, { backgroundColor: color }]}>
                <Text style={styles.label}>{label}</Text>
            </View>
            <TouchableOpacity style={styles.selectButton} onPress={handleOpen}>
                <Text style={styles.selectButtonText}>{displayValue}</Text>
                <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={handleCancel}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{label}</Text>
                            <TouchableOpacity onPress={handleConfirm}>
                                <Text style={styles.doneText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <Picker
                            selectedValue={tempValue}
                            onValueChange={setTempValue}
                            style={styles.modalPicker}
                            itemStyle={styles.pickerItem}
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
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderTopWidth: 0,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        backgroundColor: 'white',
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
        borderColor: '#d1d5db',
        borderTopWidth: 0,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        backgroundColor: 'white',
        paddingHorizontal: 12,
        paddingVertical: 14,
    },
    selectButtonText: {
        fontSize: 16,
        color: '#1f2937',
    },
    chevron: {
        fontSize: 12,
        color: '#6b7280',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContent: {
        backgroundColor: 'white',
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
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1f2937',
    },
    cancelText: {
        fontSize: 17,
        color: '#6b7280',
    },
    doneText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0f766e',
    },
    modalPicker: {
        height: 216,
    },
});
