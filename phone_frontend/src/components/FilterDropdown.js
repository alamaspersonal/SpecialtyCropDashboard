import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function FilterDropdown({ label, options, value, onChange, color }) {
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
                    itemStyle={styles.pickerItem}
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
        fontSize: 14,
    },
});
