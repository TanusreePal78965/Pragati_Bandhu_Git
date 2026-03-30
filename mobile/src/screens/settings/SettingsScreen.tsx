import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

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
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />
            
            {/* Custom Header to match other screen styles */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileCard}>
                    <View style={styles.profileInfo}>
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={40} color="#fbbf24" />
                        </View>
                        <View style={styles.profileText}>
                            <Text style={styles.profileName}>John Doe</Text>
                            <Text style={styles.profilePhone}>
                                +91 9876543210
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity>
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
                        value="Pragati General Store"
                    />
                    <SettingsInfoRow
                        label="GSTIN"
                        value="Not Provided"
                        isOptional={true}
                    />
                    <SettingsInfoRow
                        label="SHOP ADDRESS"
                        value="123, Market Street, Delhi, 110001"
                    />
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
                <TouchableOpacity style={styles.logoutButton}>
                    <Ionicons
                        name="log-out-outline"
                        size={24}
                        color={colors.error}
                    />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    backButton: {
        padding: spacing.xs,
        marginRight: spacing.sm,
        marginLeft: -spacing.xs,
    },
    title: {
        fontSize: typography.sizes.xxl,
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
});
