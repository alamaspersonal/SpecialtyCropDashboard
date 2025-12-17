import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Text style={styles.emoji}>🥬</Text>
                </View>

                <Text style={styles.title}>Specialty Crop Dashboard</Text>
                <Text style={styles.subtitle}>USDA Market Pricing Data</Text>

                <Text style={styles.description}>
                    Compare terminal market prices for specialty crops across different dates and locations.
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('Filters')}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Data sourced from USDA Market News</Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f766e',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    logoContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emoji: {
        fontSize: 60,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#99f6e4',
        marginBottom: 24,
    },
    description: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    button: {
        backgroundColor: 'white',
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 12,
    },
    buttonText: {
        color: '#0f766e',
        fontSize: 18,
        fontWeight: '600',
    },
    footer: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        textAlign: 'center',
        paddingBottom: 20,
    },
});
