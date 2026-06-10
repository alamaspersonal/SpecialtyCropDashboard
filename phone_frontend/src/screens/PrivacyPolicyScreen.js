import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const LAST_UPDATED = 'June 3, 2025';

const sections = [
    {
        title: 'Overview',
        body: 'SpecialtyCrop Dashboard is a tool for viewing USDA specialty crop pricing data. This policy explains what information is collected, how it is used, and your rights.',
    },
    {
        title: 'Information We Collect',
        body: 'We collect only the minimum information needed to personalize your experience:\n\n• Display name — stored locally on your device and never transmitted to our servers.\n• Profile image — stored locally on your device.\n• Theme preference (dark/light mode) — stored locally.\n• Saved favorites and watchlist — stored locally.\n\nWe do not collect your email address, location, device identifiers, or any other personal information.',
    },
    {
        title: 'How Your Information Is Used',
        body: 'All personal preferences (name, profile image, theme, favorites) remain on your device and are used only to personalize the interface. They are never uploaded to our servers, shared with third parties, or used for advertising.',
    },
    {
        title: 'USDA Market Data',
        body: 'Crop pricing data is sourced from the USDA Agricultural Marketing Service (AMS) public API and stored in our Supabase database. This data is entirely public and contains no personal information.',
    },
    {
        title: 'AI Market Insights (Cerebras)',
        body: 'When you request an AI-generated market summary, anonymized crop market notes from the USDA report are sent to the Cerebras AI inference API. No personal information is ever included in these requests.',
    },
    {
        title: 'Analytics and Tracking',
        body: 'We do not use analytics, crash reporting services, or any third-party tracking SDKs. No usage data is collected about how you interact with the app.',
    },
    {
        title: 'Your Rights',
        body: 'You can clear all locally stored data at any time by deleting and reinstalling the app. This removes your name, profile image, favorites, and preferences from your device.',
    },
    {
        title: 'Changes to This Policy',
        body: 'If this privacy policy changes materially, the app will be updated with the new policy. We encourage you to review it periodically.',
    },
    {
        title: 'Contact',
        body: 'If you have questions about this privacy policy, please reach out via the project\'s GitHub repository.',
    },
];

export default function PrivacyPolicyScreen({ navigation }) {
    const { colors } = useTheme();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Last updated */}
                <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>Last updated: {LAST_UPDATED}</Text>

                {/* Sections */}
                {sections.map((section) => (
                    <View key={section.title} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                        <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.body}</Text>
                    </View>
                ))}

                <Text style={[styles.footer, { color: colors.textMuted }]}>SpecialtyCrop Dashboard — USDA Market Data</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    lastUpdated: {
        fontSize: 12,
        marginBottom: 16,
        textAlign: 'center',
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    sectionBody: {
        fontSize: 14,
        lineHeight: 22,
    },
    footer: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
});
