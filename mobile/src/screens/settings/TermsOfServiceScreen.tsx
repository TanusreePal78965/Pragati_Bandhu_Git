import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../../components/common/ScreenHeader";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function TermsOfServiceScreen() {
    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader title="Terms of Service" showBack={true} />
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.lastUpdated}>Last Updated: April 14, 2026</Text>
                
                <Text style={styles.paragraph}>
                    By using the Pragati Bandhu app, you agree to the following terms and conditions. 
                    Please read them carefully before using our services.
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Nature of Service</Text>
                    <Text style={styles.paragraph}>
                        Pragati Bandhu is a shop management tool designed to help retail business owners track inventory, 
                        manage billing, and monitor customer credits (udhar). The service is provided "as is".
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Account & Eligibility</Text>
                    <Text style={styles.paragraph}>
                        To use the app, you must be a business owner or authorized representative. 
                        You are responsible for maintaining the confidentiality of your account access (OTP-based). 
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Subscription & Payments</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Service Plans:</Text> We offer Basic and Standard plans with different periodic fees.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Setup Fee:</Text> A one-time on-site setup fee may apply during onboarding.</Text>
                    <Text style={styles.bulletItem}>• <Text style={styles.bold}>Refunds:</Text> Subscription fees are generally non-refundable unless stated otherwise.</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Data Ownership</Text>
                    <Text style={styles.paragraph}>
                        You retain full ownership of the data you enter into the system (products, sales, customers). 
                        By enabling cloud sync, you grant us permission to store and move this data on your behalf to provide the service.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Usage Restrictions</Text>
                    <Text style={styles.paragraph}>
                        You agree not to use the app for any illegal activities or to store data that violates local laws. 
                        We reserve the right to deactivate accounts discovered to be involved in fraudulent activities.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
                    <Text style={styles.paragraph}>
                        While we strive for 100% accuracy, Pragati Bandhu is not liable for business losses, data loss (for offline users), 
                        or errors in AI suggestions. It is recommended to verify all AI-generated reorder suggestions before placing orders.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>7. Changes to Terms</Text>
                    <Text style={styles.paragraph}>
                        We may update these terms from time to time. Continued use of the app after such changes constitutes acceptance of the new terms.
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
