import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

interface ScreenHeaderProps {
    title?: string;
    showBack?: boolean;
    isMainTab?: boolean;
    shopName?: string;
    /** Pass pending sync count to show badge. Undefined = hide badge entirely. 0 = synced. >0 = pending. */
    syncPendingCount?: number;
    rightElement?: React.ReactNode;
    onNotificationPress?: () => void;
}

export default function ScreenHeader({
    title,
    showBack = false,
    isMainTab = false,
    shopName,
    syncPendingCount,
    rightElement,
    onNotificationPress,
}: ScreenHeaderProps) {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <View style={styles.left}>
                {isMainTab ? (
                    <View style={styles.brandingContainer}>
                        <View style={styles.shopIconContainer}>
                            <Ionicons name="storefront" size={22} color="#fff" />
                        </View>
                        <View style={styles.brandTextContainer}>
                            <Text style={styles.shopNameText}>
                                {shopName}
                            </Text>
                            <View style={styles.subtitleRow}>
                                <Text style={styles.poweredByText}>Powered by Pragati Bandhu</Text>
                                {syncPendingCount !== undefined && (
                                    <View style={styles.syncBadge}>
                                        <Ionicons
                                            name={syncPendingCount > 0 ? "sync" : "cloud-done"}
                                            size={11}
                                            color={syncPendingCount > 0 ? colors.warning : colors.success}
                                        />
                                        <Text style={[
                                            styles.syncText,
                                            { color: syncPendingCount > 0 ? colors.warning : colors.success },
                                        ]}>
                                            {syncPendingCount > 0 ? `${syncPendingCount} PENDING` : "SYNCED"}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                ) : (
                    <>
                        {showBack && (
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.backButton}
                            >
                                <Ionicons
                                    name="arrow-back"
                                    size={24}
                                    color={colors.text}
                                />
                            </TouchableOpacity>
                        )}
                        {title && <Text style={styles.title}>{title}</Text>}
                    </>
                )}
            </View>
            <View style={styles.right}>
                {rightElement ? (
                    rightElement
                ) : (
                    onNotificationPress !== undefined && (
                        <TouchableOpacity
                            style={styles.notificationButton}
                            onPress={() => navigation.navigate("Notifications" as never)}
                        >
                            <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
                            <View style={styles.notificationDot} />
                        </TouchableOpacity>
                    )
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    left: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    brandingContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        flex: 1,
        minWidth: 0,
    },
    shopIconContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    brandTextContainer: {
        justifyContent: "center",
        flexShrink: 1,
        minWidth: 0,
    },
    shopNameText: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    subtitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 1,
    },
    poweredByText: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: "400",
        flexShrink: 1,
    },
    syncBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
    },
    syncText: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    backButton: {
        padding: 4,
        marginRight: spacing.xs,
        marginLeft: -4,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
    },
    right: {
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 0,
    },
    notificationButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
    },
    notificationDot: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.error,
        borderWidth: 2,
        borderColor: "#fff",
    },
});

