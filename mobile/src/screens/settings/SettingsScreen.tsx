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
    ActivityIndicator,
    Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import ScreenHeader from "../../components/common/ScreenHeader";
import { useAuth } from "../../context/AuthContext";
import { getShopInfo, setShopInfo as persistShopInfo, StoredShopInfo, clearShopInfo, setHasConsent } from "../../utils/storage";
import { getPendingSyncCount, flushSyncQueue } from "../../db/syncQueue";
import { exportAsSql, queueAllLocalData, updateShop, getShop } from "../../db/db";
import { exportAsJson, importFromJson, clearAllLocalData } from "../../db/backup";
import { restoreFromCloud, deleteFromCloud } from "../../services/restoreService";
import { startSyncService } from "../../services/syncService";

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
    const [shopInfo, setShopInfoState] = useState<StoredShopInfo | null>(null);
    const [syncPendingCount, setSyncPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isEnablingCloud, setIsEnablingCloud] = useState(false);
    const [cloudUploadText, setCloudUploadText] = useState('Enabling…');
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [versionClicks, setVersionClicks] = useState(0);
    const [showExport, setShowExport] = useState(false);
    const navigation = useNavigation();
    const { logout, phone } = useAuth();

    useFocusEffect(
        useCallback(() => {
            getShopInfo().then(info => {
                setShopInfoState(info);
                setSyncPendingCount(getPendingSyncCount());
            });
        }, [])
    );

    const handleSyncNow = async () => {
        setIsSyncing(true);
        const beforeCount = getPendingSyncCount();
        try {
            await flushSyncQueue();
        } finally {
            const afterCount = getPendingSyncCount();
            setSyncPendingCount(afterCount);
            setIsSyncing(false);
            const synced = beforeCount - afterCount;
            if (synced > 0 && afterCount === 0) {
                Alert.alert("Synced", `All ${synced} item${synced > 1 ? "s" : ""} uploaded successfully.`);
            } else if (synced > 0 && afterCount > 0) {
                Alert.alert("Partially Synced", `${synced} item${synced > 1 ? "s" : ""} uploaded. ${afterCount} still pending — they will retry automatically.`);
            } else if (beforeCount === 0) {
                Alert.alert("All Caught Up", "Nothing to sync.");
            } else {
                Alert.alert("Sync Failed", `${afterCount} item${afterCount > 1 ? "s" : ""} could not be uploaded. Check your connection and try again.`);
            }
        }
    };

    const handleExport = () => {
        const rawPhone = shopInfo?.phone ?? phone ?? '';
        if (!rawPhone) {
            Alert.alert("Export Failed", "Could not determine shop phone number.");
            return;
        }
        const shopId = rawPhone.slice(-10);
        const sql = exportAsSql(shopId);
        Share.share({ message: sql, title: `Pragati Bandhu export — ${shopId}` });
    };

    const handleVersionPress = () => {
        const nextClicks = versionClicks + 1;
        setVersionClicks(nextClicks);
        if (nextClicks >= 5 && !showExport) {
            setShowExport(true);
            Alert.alert("Debug Mode", "Export Local Data button is now visible.");
        }
    };

    // ── Enable Cloud Backup ────────────────────────────────────────────────────
    const handleEnableCloudBackup = () => {
        Alert.alert(
            "Enable Cloud Backup?",
            "All your existing data — products, customers, bills — will be uploaded to the cloud. You can restore it on any device after reinstalling.\n\nThis cannot be undone (you can disable sync later but cloud data remains).",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Enable",
                    onPress: async () => {
                        setCloudUploadText('Enabling…');
                        setIsEnablingCloud(true);
                        try {
                            // 1. Update local shop record
                            const localShop = getShop();
                            if (localShop) {
                                updateShop({ ...localShop, aiConsent: true });
                            }

                            // 2. Update AsyncStorage consent flags
                            const currentInfo = await getShopInfo();
                            if (currentInfo) {
                                await persistShopInfo({ ...currentInfo, aiConsent: true });
                            }
                            await setHasConsent(true);

                            // 3. Queue ALL existing local data for upload
                            queueAllLocalData();

                            // 4. Show item count so the user knows something is happening (C10)
                            const totalItems = getPendingSyncCount();
                            setCloudUploadText(`Uploading ${totalItems} item${totalItems !== 1 ? 's' : ''}…`);

                            // 5. Start the sync service — it flushes the queue internally
                            //    when consent is detected (no separate flush needed). (C12)
                            await startSyncService(() => { });

                            // 5. Refresh UI
                            const refreshed = await getShopInfo();
                            setShopInfoState(refreshed);
                            setSyncPendingCount(getPendingSyncCount());

                            Alert.alert(
                                "Cloud Backup Enabled",
                                "Your data has been uploaded. Future changes will sync automatically."
                            );
                        } catch (e: any) {
                            Alert.alert("Failed", e?.message ?? "Could not enable cloud backup. Try again.");
                        } finally {
                            setIsEnablingCloud(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Cloud Restore ──────────────────────────────────────────────────────────
    const handleRestoreFromCloud = () => {
        Alert.alert(
            "Restore from Cloud",
            "This will download all your cloud data onto this device. Existing local data with the same ID will be updated.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    onPress: async () => {
                        setIsRestoring(true);
                        const result = await restoreFromCloud();
                        setIsRestoring(false);
                        if (result.success && result.summary) {
                            const s = result.summary;
                            Alert.alert(
                                "Restore Complete",
                                `Restored:\n• ${s.products} products\n• ${s.customers} customers\n• ${s.categories} categories\n• ${s.brands} brands\n• ${s.bills} bills`
                            );
                        } else {
                            Alert.alert("Restore Failed", result.error ?? "Could not connect to cloud. Check your internet connection and try again.");
                        }
                    },
                },
            ]
        );
    };

    // ── Export Backup ──────────────────────────────────────────────────────────
    const handleExportJson = () => {
        // C5: Warn the user that the file contains sensitive data before sharing.
        Alert.alert(
            "Privacy Notice",
            "The backup file contains sensitive information including customer names, phone numbers, and transaction history.\n\nOnly share it with trusted services (e.g. your own cloud storage or email).",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Export Anyway",
                    onPress: async () => {
                        setIsExporting(true);
                        try {
                            const data = exportAsJson();
                            const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                            const fileName = `pragati_bandhu_backup_${date}.json`;
                            const filePath = `${FileSystem.cacheDirectory}${fileName}`;
                            await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2));
                            const canShare = await Sharing.isAvailableAsync();
                            if (canShare) {
                                await Sharing.shareAsync(filePath, { mimeType: "application/json", dialogTitle: "Save Backup File" });
                            } else {
                                Alert.alert("Export Failed", "Sharing is not available on this device.");
                            }
                        } catch (e: any) {
                            Alert.alert("Export Failed", e?.message ?? "Something went wrong.");
                        } finally {
                            setIsExporting(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Import Backup ──────────────────────────────────────────────────────────
    const handleImportJson = async () => {
        try {
            // C4: Include text/plain so Android file managers that mislabel .json
            // files as plain text still show up in the picker.
            const result = await DocumentPicker.getDocumentAsync({
                type: ["application/json", "text/plain"],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) return;

            const fileUri = result.assets[0].uri;
            const raw = await FileSystem.readAsStringAsync(fileUri);
            const parsed = JSON.parse(raw);

            if (!parsed.version || !parsed.exportedAt) {
                Alert.alert("Invalid File", "This file is not a valid Pragati Bandhu backup.");
                return;
            }

            // C6: Validate that the backup belongs to the current shop before importing.
            // Mixing data from two different shops would corrupt balances and history.
            const currentPhone = (phone ?? shopInfo?.phone ?? '').slice(-10);
            const backupPhone = (parsed.shop?.phone ?? parsed.shop?.id ?? '').slice(-10);
            if (backupPhone && currentPhone && backupPhone !== currentPhone) {
                Alert.alert(
                    "Wrong Shop Backup",
                    `This backup belongs to shop ${backupPhone}, but you are logged in as ${currentPhone}.\n\nImporting it may mix data from two different shops. Are you sure?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Import Anyway",
                            style: "destructive",
                            onPress: () => proceedWithImport(parsed),
                        },
                    ]
                );
                return;
            }

            proceedWithImport(parsed);
        } catch (e: any) {
            Alert.alert("Import Failed", e?.message ?? "Could not read the file.");
        }
    };

    const proceedWithImport = async (parsed: any) => {
        const s = parsed;
        const hasConsent = shopInfo?.aiConsent ?? false;
        const cloudNote = hasConsent ? "\n\nYour cloud backup will be updated automatically." : "";
        Alert.alert(
            "Import Backup?",
            `Found:\n• ${s.products?.length ?? 0} products\n• ${s.customers?.length ?? 0} customers\n• ${s.categories?.length ?? 0} categories\n• ${s.brands?.length ?? 0} brands\n• ${s.bills?.length ?? 0} bills\n\nThis will merge with your existing data.${cloudNote}`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Import",
                    onPress: async () => {
                        const summary = importFromJson(parsed);
                        // For cloud users: re-queue all imported rows so Supabase
                        // reflects the restored state. This also cancels any stale
                        // DELETE queue entries for the same IDs.
                        if (hasConsent) {
                            queueAllLocalData();
                            await flushSyncQueue();
                        }
                        Alert.alert(
                            "Import Complete",
                            `Imported:\n• ${summary.products} products\n• ${summary.customers} customers\n• ${summary.categories} categories\n• ${summary.brands} brands\n• ${summary.bills} bills`
                        );
                    },
                },
            ]
        );
    };

    // ── Delete All Data ────────────────────────────────────────────────────────
    const handleDeleteAllData = () => {
        const hasConsent = shopInfo?.aiConsent ?? false;

        if (hasConsent) {
            // Cloud user: offer two paths
            Alert.alert(
                "Delete All Data",
                "Choose what to delete:",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Local Only",
                        onPress: confirmDeleteLocal,
                    },
                    {
                        text: "Local + Cloud",
                        style: "destructive",
                        onPress: confirmDeleteEverything,
                    },
                ]
            );
        } else {
            // Offline user: only local data to delete
            confirmDeleteLocal();
        }
    };

    const confirmDeleteLocal = () => {
        Alert.alert(
            "Delete Local Data?",
            "All products, customers, bills and settings will be permanently removed from this device. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        clearAllLocalData();
                        await clearShopInfo();
                        await setHasConsent(false);
                        setIsDeleting(false);
                        await logout();
                    },
                },
            ]
        );
    };

    const confirmDeleteEverything = () => {
        Alert.alert(
            "Delete Everything?",
            "This will permanently delete ALL your data — products, customers, bills — from this device AND the cloud. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Delete Everything",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        const cloudResult = await deleteFromCloud();
                        if (!cloudResult.success) {
                            setIsDeleting(false);
                            Alert.alert("Cloud Delete Failed", cloudResult.error ?? "Could not delete cloud data. Check your connection and try again.");
                            return;
                        }
                        clearAllLocalData();
                        await clearShopInfo();
                        await setHasConsent(false);
                        setIsDeleting(false);
                        await logout();
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
                    <TouchableOpacity
                        style={styles.editProfileButton}
                        activeOpacity={0.7}
                        onPress={() => (navigation as any).navigate("EditShop")}
                    >
                        <Ionicons name="create-outline" size={28} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* App Preferences */}
                <SectionHeader title="APP PREFERENCES" />
                <SettingsItem icon="language" title="Language" value="English" />
                {/* <View style={styles.settingsItem}>
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
                </View> */}
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
                        <Text style={styles.infoLabel}>CLOUD BACKUP & AI CONSENT</Text>
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

                {shopInfo?.aiConsent && (
                    <TouchableOpacity
                        style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
                        onPress={handleSyncNow}
                        disabled={isSyncing}
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                        )}
                        <Text style={styles.syncButtonText}>
                            {isSyncing
                                ? "Syncing..."
                                : syncPendingCount > 0
                                    ? `Sync Now (${syncPendingCount} pending)`
                                    : "Sync Now"}
                        </Text>
                    </TouchableOpacity>
                )}

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

                {/* Data & Backup */}
                <SectionHeader title="DATA & BACKUP" />

                {!shopInfo?.aiConsent && (
                    <TouchableOpacity
                        style={styles.enableCloudButton}
                        onPress={handleEnableCloudBackup}
                        disabled={isEnablingCloud}
                    >
                        {isEnablingCloud ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
                        )}
                        <Text style={styles.enableCloudText}>
                            {isEnablingCloud ? cloudUploadText : "Enable Cloud Backup"}
                        </Text>
                    </TouchableOpacity>
                )}

                {shopInfo?.aiConsent && (
                    <SettingsItem
                        icon="cloud-download-outline"
                        title="Restore from Cloud"
                        onPress={handleRestoreFromCloud}
                        showChevron={false}
                    />
                )}
                {isRestoring && (
                    <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.inlineLoaderText}>Restoring from cloud…</Text>
                    </View>
                )}

                <SettingsItem
                    icon="share-outline"
                    title="Export Backup (.json)"
                    onPress={handleExportJson}
                    showChevron={false}
                />
                {isExporting && (
                    <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.inlineLoaderText}>Preparing backup file…</Text>
                    </View>
                )}

                <SettingsItem
                    icon="folder-open-outline"
                    title="Import from Backup"
                    onPress={handleImportJson}
                    showChevron={false}
                />

                <TouchableOpacity style={styles.deleteDataButton} onPress={handleDeleteAllData} disabled={isDeleting}>
                    {isDeleting ? (
                        <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                    )}
                    <Text style={styles.deleteDataText}>
                        {isDeleting ? "Deleting…" : "Delete All Data"}
                    </Text>
                </TouchableOpacity>

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
                    onPress={handleVersionPress}
                />

                {/* Export Button */}
                {showExport && (
                    <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
                        <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.exportText}>Export Local Data (SQL)</Text>
                    </TouchableOpacity>
                )}

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
        backgroundColor: colors.surface,
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
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
        elevation: 4,
    },
    profileInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#f0f7ff",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
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
    editProfileButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f0f7ff",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e0e7ff",
    },
    editProfileText: {
        color: colors.primary,
        fontWeight: "600",
        fontSize: 13,
        marginLeft: 4,
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
    syncButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        margin: spacing.md,
        marginTop: spacing.sm,
        padding: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: colors.primary + "0f",
    },
    syncButtonDisabled: {
        opacity: 0.5,
    },
    syncButtonText: {
        color: colors.primary,
        fontWeight: "600",
        fontSize: typography.sizes.sm,
    },
    exportButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 16,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        padding: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    exportText: {
        color: colors.textSecondary,
        fontWeight: "600",
        fontSize: typography.sizes.sm,
    },
    enableCloudButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        padding: spacing.sm,
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    enableCloudText: {
        color: "#ffffff",
        fontWeight: "700",
        fontSize: typography.sizes.sm,
    },
    deleteDataButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        padding: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#fee2e2",
        backgroundColor: "#fef2f2",
    },
    deleteDataText: {
        color: colors.error,
        fontWeight: "600",
        fontSize: typography.sizes.sm,
    },
    inlineLoader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: colors.surface,
    },
    inlineLoaderText: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
});
