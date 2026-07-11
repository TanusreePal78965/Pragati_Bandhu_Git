import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../../components/common/ScreenHeader";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function PrivacyPolicyScreen() {
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader title="Privacy Policy" showBack={true} />
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.lastUpdated}>Last Updated: April 14, 2026</Text>
                
                <Text style={styles.paragraph}>
                    At Pragati Bandhu, we value your privacy and are committed to protecting your shop's data. 
                    This Privacy Policy explains how we collect, use, and protect your information.
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Data We Collect</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Shop Information:</Text> Shop name, owner name, category, and WhatsApp number.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Inventory & Sales:</Text> Product details, stock levels, billing history, and sales patterns.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Customer Data:</Text> Names, phone numbers, and credit (udhar) balances for your customers.</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. How We Use Your Data</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Operations:</Text> To provide inventory management, billing, and udhar tracking services.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Cloud Backup:</Text> If enabled, your data is synced to our secure servers to prevent data loss.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>AI Insights:</Text> To provide reorder suggestions. We only use anonymized sales patterns for this feature.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Communication:</Text> To send OTPs and low-stock alerts via WhatsApp or SMS.</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Data Privacy & AI</Text>
                    <Text style={styles.paragraph}>
                        We never share your personal information, shop location, or customer contact details with third parties for marketing purposes.
                    </Text>
                    <Text style={styles.paragraph}>
                        For AI-powered features, we send anonymized statistical patterns (e.g., "Product A sold 10 units") to secure AI services like Claude API. 
                        No identifying names or phones are ever included in these requests.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Your Control</Text>
                    <Text style={styles.paragraph}>
                        You have full control over your data sync options. You can choose to keep your data "This Phone Only" or enable "Cloud Backup" at any time in the settings.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about this Privacy Policy, please contact us at support@pragatibandhu.com or call 7003354703.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2026 Pragati Bandhu</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
    },
    lastUpdated: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 15,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: 12,
    },
    bulletItem: {
        fontSize: 15,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: 8,
        paddingLeft: 4,
    },
    bold: {
        fontWeight: "600",
        color: colors.text,
    },
    footer: {
        marginTop: spacing.xl,
        paddingBottom: spacing.xl,
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.lg,
    },
    footerText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});
