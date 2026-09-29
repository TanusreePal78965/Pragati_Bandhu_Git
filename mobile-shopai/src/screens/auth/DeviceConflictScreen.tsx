import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import PrimaryButton from "../../components/common/PrimaryButton";
import { useAuth } from "../../context/AuthContext";

export default function DeviceConflictScreen() {
    const { claimSession, logout, phone } = useAuth();
    const [claiming, setClaiming] = useState(false);

    const handleUseHere = () => {
        Alert.alert(
            "Use on This Device",
            "This will sign out the other device. Your data is safe in the cloud.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Use Here",
                    onPress: async () => {
                        setClaiming(true);
                        await claimSession();
                        setClaiming(false);
                    },
                },
            ]
        );
    };

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
            <StatusBar style="dark" backgroundColor="#F8FAFC" />
            <View style={styles.content}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="phone-portrait-outline" size={48} color={colors.warning} />
                </View>

                {/* Heading */}
                <Text style={styles.title}>Active on Another Device</Text>
                <Text style={styles.subtitle}>
                    Your account is currently active on another device. Only one device can be active at a time.
                </Text>

                {/* Info card */}
                <View style={styles.infoCard}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                    <View style={styles.infoText}>
                        <Text style={styles.infoLabel}>Your data is safe</Text>
                        <Text style={styles.infoValue}>
                            All your shop data is backed up in the cloud. Switching devices will not affect your data.
                        </Text>
                        {phone && (
                            <Text style={styles.infoMeta}>Account: +91 {phone}</Text>
                        )}
                    </View>
                </View>

                <PrimaryButton
                    title={claiming ? "Switching…" : "Use on This Device"}
                    onPress={handleUseHere}
                    style={styles.primaryButton}
                    disabled={claiming}
                />

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
        backgroundColor: colors.warning + "18",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.warning + "40",
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
    infoCard: {
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
    infoText: {
        flex: 1,
    },
    infoLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    infoMeta: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 4,
    },
    primaryButton: {
        width: "100%",
        marginBottom: spacing.md,
    },
    logoutButton: {
        width: "100%",
        backgroundColor: colors.error,
    },
});
