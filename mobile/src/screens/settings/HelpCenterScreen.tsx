import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../../components/common/ScreenHeader";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function HelpCenterScreen() {
    const handleCallSupport = () => {
        Linking.openURL("tel:7003354703");
    };

    const handleWhatsAppSupport = () => {
        Linking.openURL("whatsapp://send?phone=917003354703&text=Hi Pragati Bandhu Support, I need help with...");
    };

    const faqItems = [
        {
            question: "What items are synced to the cloud?",
            answer: "If you have enabled Cloud Backup, your products, categories, brands, customers, bills, and sales history are securely backed up. Basic shop info is always synced for account recovery."
        },
        {
            question: "Does the app work without internet?",
            answer: "Yes! Pragati Bandhu is offline-first. You can create bills, manage stock, and add customers without internet. Data will sync automatically once you're back online (if cloud backup is on)."
        },
        {
            question: "What is AI Reorder Suggestion?",
            answer: "Our AI analyzes your sales patterns to predict when you'll run out of stock and suggests how much to reorder. It helps you avoid losing sales and prevents over-ordering."
        },
        {
            question: "Is my customer data shared with anyone?",
            answer: "No. Your privacy is our priority. Customer names and phone numbers are never shared with third parties. AI suggestions use anonymized sales data only."
        }
    ];

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScreenHeader title="Help Center" showBack={true} />
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.helpCard}>
                    <Text style={styles.helpTitle}>How can we help you?</Text>
                    <Text style={styles.helpSubtitle}>Our support team is available from 10 AM to 8 PM.</Text>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleCallSupport}>
                            <View style={[styles.iconBox, { backgroundColor: "#f0fdf4" }]}>
                                <Ionicons name="call" size={24} color="#16a34a" />
                            </View>
                            <Text style={styles.actionText}>Call Support</Text>
                            <Text style={styles.actionText}>7003354703</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleWhatsAppSupport}>
                            <View style={[styles.iconBox, { backgroundColor: "#ecfdf5" }]}>
                                <Ionicons name="logo-whatsapp" size={24} color="#059669" />
                            </View>
                            <Text style={styles.actionText}>WhatsApp</Text>
                            <Text style={styles.actionText}>7003354703</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    {faqItems.map((item, index) => (
                        <View key={index} style={styles.faqItem}>
                            <Text style={styles.faqQuestion}>{item.question}</Text>
                            <Text style={styles.faqAnswer}>{item.answer}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Pragati Bandhu v1.0.4</Text>
                    <Text style={styles.footerText}>Made with ❤️ for Indian Shopkeepers</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    helpCard: {
        backgroundColor: colors.surface,
        margin: spacing.md,
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
    },
    helpTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 8,
    },
    helpSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 24,
    },
    actionRow: {
        flexDirection: "row",
        gap: spacing.lg,
    },
    actionButton: {
        alignItems: "center",
        flex: 1,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    section: {
        padding: spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    faqItem: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    faqQuestion: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 6,
    },
    faqAnswer: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    footer: {
        padding: spacing.xl,
        alignItems: "center",
        opacity: 0.5,
    },
    footerText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
});
