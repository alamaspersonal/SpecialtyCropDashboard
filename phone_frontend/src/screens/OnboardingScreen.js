/**
 * Onboarding Screen - One-time name input for personalization
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { setUserName, setOnboardingComplete } from '../services/userStorage';

export default function OnboardingScreen({ navigation }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleContinue = async () => {
        const trimmedName = name.trim();
        
        if (!trimmedName) {
            setError('Please enter your name');
            return;
        }
        
        if (trimmedName.length < 2) {
            setError('Name must be at least 2 characters');
            return;
        }

        // Save name and mark onboarding complete
        await setUserName(trimmedName);
        await setOnboardingComplete();
        
        // Navigate to Home and reset navigation stack
        navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
        });
    };

    return (
        <LinearGradient
            colors={['#0f172a', '#1e293b', '#334155']}
            style={styles.gradient}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        {/* Welcome Text */}
                        <Text style={styles.title}>Welcome!</Text>
                        <Text style={styles.subtitle}>
                            Let's personalize your experience
                        </Text>

                        {/* Name Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>What should we call you?</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#64748b"
                                    value={name}
                                    onChangeText={(text) => {
                                        setName(text);
                                        setError('');
                                    }}
                                    autoCapitalize="words"
                                    autoCorrect={false}
                                    maxLength={30}
                                />
                            </View>
                            {error ? (
                                <Text style={styles.errorText}>{error}</Text>
                            ) : null}
                        </View>

                        {/* Continue Button */}
                        <TouchableOpacity
                            style={[styles.button, !name.trim() && styles.buttonDisabled]}
                            onPress={handleContinue}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Let's Go</Text>
                            <Ionicons name="arrow-forward" size={20} color="#0f172a" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <Text style={styles.footer}>
                        USDA Specialty Crop Dashboard
                    </Text>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    logoContainer: {
        marginBottom: 32,
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4ade80',
    },
    emoji: {
        fontSize: 48,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#f1f5f9',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginBottom: 48,
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 32,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 18,
        color: '#f1f5f9',
    },
    errorText: {
        color: '#f87171',
        fontSize: 13,
        marginTop: 8,
        marginLeft: 4,
    },
    button: {
        flexDirection: 'row',
        backgroundColor: '#4ade80',
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#4ade80',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#0f172a',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        color: '#475569',
        fontSize: 12,
        textAlign: 'center',
        paddingBottom: 20,
    },
});
