import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    StatusBar,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import ScreenHeader from "../../components/common/ScreenHeader";
import { useAuth } from "../../context/AuthContext";
import { getShopInfo, StoredShopInfo } from "../../utils/storage";
import { getPendingSyncCount } from "../../db/syncQueue";

const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
);

const SettingsItem = ({
    icon,
    title,
    value,
    onPress,
    showChevron = true,
}: {
    icon: string;
    title: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
}) => (
    <TouchableOpacity
        style={styles.settingsItem}
        onPress={onPress}
        disabled={!onPress}
    >
        <View style={styles.settingsItemLeft}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon as any} size={22} color={colors.primary} />
            </View>
            <Text style={styles.settingsItemTitle}>{title}</Text>
        </View>
        <View style={styles.settingsItemRight}>
            {value && <Text style={styles.settingsItemValue}>{value}</Text>}
            {showChevron && (
                <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                />
            )}
        </View>
    </TouchableOpacity>
);

const SettingsInfoRow = ({
    label,
    value,
    isOptional = false,
}: {
    label: string;
    value: string;
    isOptional?: boolean;
}) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>
            {label} {isOptional && "(OPTIONAL)"}
        </Text>
        <Text style={styles.infoValue}>{value}</Text>
    </View>
);

export default function SettingsScreen() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [shopInfo, setShopInfo] = useState<StoredShopInfo | null>(null);
    const [syncPendingCount, setSyncPendingCount] = useState(0);
    const navigation = useNavigation();
    const { logout, phone } = useAuth();

    useFocusEffect(
        useCallback(() => {
            getShopInfo().then(info => {
                setShopInfo(info);
                setSyncPendingCount(getPendingSyncCount());
            });
        }, [])
    );

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
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />

            <ScreenHeader
                isMainTab={true}
                shopName={shopInfo?.shopName ?? "—"}
                syncPendingCount={shopInfo?.aiConsent ? syncPendingCount : undefined}
                onNotificationPress={() => { }}
            />
            <View style={styles.titleSection}>
                <Text style={styles.titleText}>Settings</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileCard}>
                    <View style={styles.profileInfo}>
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={40} color="#fbbf24" />
                        </View>
                        <View style={styles.profileText}>
                            <Text style={styles.profileName}>{shopInfo?.ownerName ?? "—"}</Text>
                            <Text style={styles.profilePhone}>
                                {phone ? `+91 ${phone}` : "—"}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => (navigation as any).navigate("EditShop")}>
                        <Text style={styles.editProfileLink}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* App Preferences */}
                <SectionHeader title="APP PREFERENCES" />
                <SettingsItem icon="language" title="Language" value="English" />
                <View style={styles.settingsItem}>
                    <View style={styles.settingsItemLeft}>
                        <View style={styles.iconContainer}>
                            <Ionicons
                                name="moon"
                                size={22}
                                color={colors.primary}
                            />
                        </View>
                        <Text style={styles.settingsItemTitle}>Dark Mode</Text>
                    </View>
                    <Switch
                        value={isDarkMode}
                        onValueChange={setIsDarkMode}
                        trackColor={{
                            false: "#e5e7eb",
                            true: colors.primary,
                        }}
                        thumbColor="#ffffff"
                    />
                </View>
                <SettingsItem icon="notifications" title="Notification Settings" />

                {/* Business Info */}
                <SectionHeader title="BUSINESS INFO" />
                <View style={styles.infoContainer}>
                    <SettingsInfoRow
                        label="SHOP NAME"
                        value={shopInfo?.shopName ?? "—"}
                    />
                    <SettingsInfoRow
                        label="BUSINESS CATEGORY"
                        value={shopInfo?.category || "Not Provided"}
                        isOptional={true}
                    />
                    <SettingsInfoRow
                        label="WHATSAPP NUMBER"
                        value={shopInfo?.whatsappNumber || "Not Provided"}
                        isOptional={true}
                    />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>CLOUD BACKUP</Text>
                        <View style={styles.badgeRow}>
                            <View style={[
                                styles.badge,
                                shopInfo?.aiConsent ? styles.badgeActive : styles.badgeInactive,
                            ]}>
                                <Ionicons
                                    name={shopInfo?.aiConsent ? "cloud-done-outline" : "phone-portrait-outline"}
                                    size={12}
                                    color={shopInfo?.aiConsent ? colors.success : colors.textSecondary}
                                />
                                <Text style={[
                                    styles.badgeText,
                                    { color: shopInfo?.aiConsent ? colors.success : colors.textSecondary },
                                ]}>
                                    {shopInfo?.aiConsent ? "Enabled" : "This Device Only"}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Inventory Settings */}
                <SectionHeader title="INVENTORY SETTINGS" />
                <SettingsItem
                    icon="apps"
                    title="Manage Categories"
                    onPress={() => (navigation as any).navigate("ManageCategories")}
                />
                <SettingsItem
                    icon="pricetag"
                    title="Manage Brands"
                    onPress={() => (navigation as any).navigate("ManageBrands")}
                />

                {/* Support & Info */}
                <SectionHeader title="SUPPORT & INFO" />
                <SettingsItem icon="help-circle" title="Help Center" />
                <SettingsItem icon="shield-checkmark" title="Privacy Policy" />
                <SettingsItem icon="document-text" title="Terms of Service" />
                <SettingsItem
                    icon="information-circle"
                    title="App Version"
                    value="v1.0.4"
                    showChevron={false}
                />

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons
                        name="log-out-outline"
                        size={24}
                        color={colors.error}
                    />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={{ height: spacing.tabBarOffset }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    titleSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    titleText: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.text,
    },
    profileCard: {
        backgroundColor: colors.surface,
        margin: spacing.md,
        padding: spacing.md,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    profileInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#f5f8ff",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e0e7ff",
    },
    profileText: {
        marginLeft: spacing.md,
    },
    profileName: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        color: colors.text,
    },
    profilePhone: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    editProfileLink: {
        color: colors.primary,
        fontWeight: "600",
        fontSize: typography.sizes.sm,
    },
    sectionHeader: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: "#f3f4f6",
    },
    sectionHeaderTitle: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textSecondary,
        letterSpacing: 0.5,
    },
    settingsItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    settingsItemLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 32,
        alignItems: "center",
    },
    settingsItemTitle: {
        fontSize: typography.sizes.md,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    settingsItemRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    settingsItemValue: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginRight: spacing.xs,
    },
    infoContainer: {
        backgroundColor: colors.surface,
    },
    infoRow: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoLabel: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: "600",
        marginBottom: 4,
    },
    infoValue: {
        fontSize: typography.sizes.md,
        color: colors.text,
        fontWeight: "500",
    },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fef2f2",
        margin: spacing.md,
        padding: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#fee2e2",
    },
    logoutText: {
        color: colors.error,
        fontWeight: "700",
        marginLeft: spacing.sm,
        fontSize: typography.sizes.md,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        gap: 4,
    },
    badgeActive: {
        backgroundColor: colors.success + "18",
    },
    badgeInactive: {
        backgroundColor: colors.border,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
});
