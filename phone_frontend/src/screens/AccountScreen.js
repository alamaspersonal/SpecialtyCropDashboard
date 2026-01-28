import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { getUserName, setUserName, getProfileImage, setProfileImage } from '../services/userStorage';

export default function AccountScreen({ navigation }) {
    const { colors, isDark, toggleTheme } = useTheme();
    const [userName, setUserNameState] = useState('');
    const [profileImage, setProfileImageState] = useState(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    useEffect(() => {
        const loadUserData = async () => {
            const [name, image] = await Promise.all([
                getUserName(),
                getProfileImage()
            ]);
            setUserNameState(name || 'User');
            setProfileImageState(image);
        };
        loadUserData();
    }, []);

    const handlePickImage = async () => {
        // Request permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to set a profile picture.');
            return;
        }

        // Pick image
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const uri = result.assets[0].uri;
            setProfileImageState(uri);
            await setProfileImage(uri);
        }
    };

    const startEditingName = () => {
        setTempName(userName);
        setIsEditingName(true);
    };

    const saveName = async () => {
        const trimmed = tempName.trim();
        if (trimmed.length >= 2) {
            setUserNameState(trimmed);
            await setUserName(trimmed);
        }
        setIsEditingName(false);
    };

    const cancelEditing = () => {
        setIsEditingName(false);
        setTempName('');
    };

    // Dynamic styles based on theme
    const dynamicStyles = {
        container: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surfaceElevated,
            justifyContent: 'center',
            alignItems: 'center',
        },
        headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
        avatarCircle: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.accentLight,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
            borderWidth: 3,
            borderColor: colors.accent,
            overflow: 'hidden',
        },
        userName: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
        settingsSection: {
            backgroundColor: colors.surface,
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
            borderBottomColor: colors.border,
        },
        settingsText: { flex: 1, marginLeft: 12, fontSize: 16, color: colors.text },
        appInfoText: { fontSize: 12, color: colors.textMuted },
        nameInput: {
            fontSize: 24,
            fontWeight: 'bold',
            color: colors.text,
            borderBottomWidth: 2,
            borderBottomColor: colors.accent,
            paddingVertical: 4,
            paddingHorizontal: 8,
            minWidth: 150,
            textAlign: 'center',
        },
    };

    return (
        <SafeAreaView style={dynamicStyles.container}>
            {/* Header with Back Button */}
            <View style={dynamicStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={dynamicStyles.headerTitle}>Account</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    {/* Profile Image */}
                    <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
                        <View style={dynamicStyles.avatarCircle}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={styles.profileImage} />
                            ) : (
                                <Ionicons name="person" size={48} color={colors.accent} />
                            )}
                        </View>
                        <View style={styles.editBadge}>
                            <Ionicons name="camera" size={14} color="white" />
                        </View>
                    </TouchableOpacity>

                    {/* Editable Name */}
                    {isEditingName ? (
                        <View style={styles.nameEditContainer}>
                            <TextInput
                                style={dynamicStyles.nameInput}
                                value={tempName}
                                onChangeText={setTempName}
                                autoFocus
                                maxLength={30}
                                onSubmitEditing={saveName}
                            />
                            <View style={styles.nameEditButtons}>
                                <TouchableOpacity onPress={cancelEditing} style={styles.nameEditBtn}>
                                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={saveName} style={[styles.nameEditBtn, { backgroundColor: colors.accent }]}>
                                    <Ionicons name="checkmark" size={20} color="#0f172a" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={startEditingName} style={styles.nameContainer}>
                            <Text style={dynamicStyles.userName}>{userName}</Text>
                            <Ionicons name="pencil" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Settings - Only Dark Mode */}
                <View style={dynamicStyles.settingsSection}>
                    <View style={[dynamicStyles.settingsItem, { borderBottomWidth: 0 }]}>
                        <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color={colors.textSecondary} />
                        <Text style={dynamicStyles.settingsText}>Dark Mode</Text>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: colors.border, true: colors.accent }}
                            thumbColor={'#ffffff'}
                            ios_backgroundColor={colors.border}
                        />
                    </View>
                </View>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={dynamicStyles.appInfoText}>SpecialtyCrop Dashboard v1.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 24,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    editBadge: {
        position: 'absolute',
        bottom: 12,
        right: -4,
        backgroundColor: '#22c55e',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameEditContainer: {
        alignItems: 'center',
    },
    nameEditButtons: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 12,
    },
    nameEditBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(100,100,100,0.2)',
    },
    appInfo: {
        alignItems: 'center',
        marginTop: 32,
    },
});
