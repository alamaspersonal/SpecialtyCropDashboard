import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AccountScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            {/* Header with Back Button */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarCircle}>
                        <Ionicons name="person" size={48} color="#22c55e" />
                    </View>
                    <Text style={styles.userName}>Anthony</Text>
                    <Text style={styles.userEmail}>anthony@example.com</Text>
                </View>

                {/* Settings Options */}
                <View style={styles.settingsSection}>
                    <TouchableOpacity style={styles.settingsItem}>
                        <Ionicons name="notifications-outline" size={22} color="#64748b" />
                        <Text style={styles.settingsText}>Notifications</Text>
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingsItem}>
                        <Ionicons name="heart-outline" size={22} color="#64748b" />
                        <Text style={styles.settingsText}>Favorites</Text>
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingsItem}>
                        <Ionicons name="settings-outline" size={22} color="#64748b" />
                        <Text style={styles.settingsText}>Preferences</Text>
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingsItem}>
                        <Ionicons name="help-circle-outline" size={22} color="#64748b" />
                        <Text style={styles.settingsText}>Help & Support</Text>
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.chevron} />
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>SpecialtyCrop Dashboard v1.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    content: {
        padding: 24,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#dcfce7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: '#22c55e',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#64748b',
    },
    settingsSection: {
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    settingsText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#1e293b',
    },
    chevron: {
        marginLeft: 'auto',
    },
    appInfo: {
        alignItems: 'center',
        marginTop: 32,
    },
    appInfoText: {
        fontSize: 12,
        color: '#94a3b8',
    },
});
