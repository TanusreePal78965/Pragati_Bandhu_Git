import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import PrimaryButton from "../../components/common/PrimaryButton";
import { useAuth } from "../../context/AuthContext";

export default function ShopDeactivatedScreen() {
    const { logout, phone } = useAuth();

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => { await logout(); },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="ban-outline" size={48} color={colors.error} />
                </View>

                {/* Heading */}
                <Text style={styles.title}>Shop Deactivated</Text>
                <Text style={styles.subtitle}>
                    Your shop has been deactivated by the administrator. You cannot access the app until it is reactivated.
                </Text>

                {/* Support card */}
                <View style={styles.supportCard}>
                    <Ionicons name="headset-outline" size={20} color={colors.primary} />
                    <View style={styles.supportText}>
                        <Text style={styles.supportLabel}>Need help?</Text>
                        <Text style={styles.supportValue}>Contact support at +91 7003354703</Text>
                        {phone && (
                            <Text style={styles.supportMeta}>Your registered number: +91 {phone}</Text>
                        )}
                    </View>
                </View>

                <PrimaryButton
                    title="Logout"
                    onPress={handleLogout}
                    style={styles.logoutButton}
                />
            </View>
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
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.error + "12",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.error + "30",
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: "800",
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: spacing.xxl,
    },
    supportCard: {
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.sm,
        width: "100%",
        marginBottom: spacing.xxl,
    },
    supportText: {
        flex: 1,
    },
    supportLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 2,
    },
    supportValue: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
    supportMeta: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 4,
    },
    logoutButton: {
        width: "100%",
        backgroundColor: colors.error,
    },
});
