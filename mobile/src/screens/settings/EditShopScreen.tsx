import React, { useState, useEffect } from "react";
import {
    Alert,
    View,
    Text,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import TextInputField from "../../components/common/TextInputField";
import PrimaryButton from "../../components/common/PrimaryButton";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getShopInfo, setShopInfo, setHasConsent } from "../../utils/storage";
import { useAuth } from "../../context/AuthContext";
import { updateShop } from "../../db/db";
import { flushSyncQueue } from "../../db/syncQueue";
import { supabase } from "../../lib/supabase";

export default function EditShopScreen() {
    const navigation = useNavigation();
    const { uuid } = useAuth();

    const [shopName, setShopName] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [category, setCategory] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [aiConsent, setAiConsent] = useState(true);
    const [phone, setPhone] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getShopInfo().then((info) => {
            if (info) {
                setShopName(info.shopName ?? "");
                setOwnerName(info.ownerName ?? "");
                setCategory(info.category ?? "");
                setWhatsappNumber(info.whatsappNumber ?? "");
                setAiConsent(info.aiConsent ?? true);
                setPhone(info.phone ?? "");
            }
            setIsLoading(false);
        });
    }, []);

    const handleConsentChange = (newValue: boolean) => {
        if (newValue === aiConsent) return;

        if (!newValue) {
            Alert.alert(
                "Turn Off Cloud Backup?",
                "Your data will no longer be backed up. If you lose this device, your inventory and sales history cannot be recovered.",
                [
                    { text: "Keep Cloud Backup", style: "cancel" },
                    {
                        text: "Turn Off",
                        style: "destructive",
                        onPress: () => setAiConsent(false),
                    },
                ]
            );
        } else {
            Alert.alert(
                "Enable Cloud Backup?",
                "Your products, sales, and customer data will be securely backed up to the cloud.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Enable", onPress: () => setAiConsent(true) },
                ]
            );
        }
    };

    const handleSave = async () => {
        if (!shopName.trim() || !ownerName.trim()) return;
        setIsSaving(true);
        try {
            // 1. Update consent flag
            await setHasConsent(aiConsent);

            // 2. Update AsyncStorage (fast reads across app)
            await setShopInfo({
                shopName: shopName.trim(),
                ownerName: ownerName.trim(),
                category: category.trim(),
                whatsappNumber: whatsappNumber.trim(),
                aiConsent,
            });

            // 3. Update SQLite + enqueue sync to backend
            updateShop({
                shopName: shopName.trim(),
                ownerName: ownerName.trim(),
                category: category.trim(),
                whatsappNumber: whatsappNumber.trim(),
                aiConsent,
            });

            // 4. Push ai_consent directly — the sync queue UPDATE path omits it to prevent
            //    stale local values from overwriting Supabase on other devices.
            if (uuid) {
                const updateConsent = async () => {
                    try {
                        await supabase.from('shops').update({ ai_consent: aiConsent }).eq('id', uuid);
                    } catch (_) {}
                };
                updateConsent();
            }

            // 5. Flush queue immediately — don't wait for the next foreground/network event
            await flushSyncQueue();

            Alert.alert("Saved", "Your shop details have been updated.", [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            console.error("EditShop save error:", e);
            Alert.alert("Save Failed", "Could not save your changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar style="dark" backgroundColor={colors.background} />
            <ScreenHeader
                title="Edit Shop"
                showBack={true}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Form */}
                    <View style={styles.form}>
                        <TextInputField
                            label="Shop Name"
                            placeholder="e.g. Maa Tara Medical Hall"
                            value={shopName}
                            onChangeText={setShopName}
                        />

                        <TextInputField
                            label="Owner Name"
                            placeholder="Your full name"
                            value={ownerName}
                            onChangeText={setOwnerName}
                        />

                        <TextInputField
                            label="Business Category"
                            placeholder="e.g. Pharmacy, Grocery, etc."
                            value={category}
                            onChangeText={setCategory}
                        />

                        <TextInputField
                            label="WhatsApp Number for Alerts"
                            placeholder="10-digit mobile number"
                            value={whatsappNumber}
                            onChangeText={setWhatsappNumber}
                            keyboardType="phone-pad"
                        />

                        {/* AI / Cloud Consent */}
                        <Text style={styles.sectionTitle}>App Experience</Text>

                        <TouchableOpacity
                            style={[styles.consentCard, aiConsent && styles.consentCardActive]}
                            onPress={() => handleConsentChange(true)}
                        >
                            <View style={styles.consentIcon}>
                                <Ionicons
                                    name="cloud-upload-outline"
                                    size={20}
                                    color={aiConsent ? colors.primary : colors.textSecondary}
                                />
                            </View>
                            <View style={styles.consentTextCont}>
                                <Text style={[styles.consentTitle, aiConsent && styles.consentTitleActive]}>
                                    Cloud Backup + AI Features
                                </Text>
                                <Text style={styles.consentSub}>
                                    Products, sales & customers backed up online. AI reorder suggestions included.
                                </Text>
                            </View>
                            <Ionicons
                                name={aiConsent ? "radio-button-on" : "radio-button-off"}
                                size={22}
                                color={aiConsent ? colors.primary : colors.border}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.consentCard, !aiConsent && styles.consentCardActive]}
                            onPress={() => handleConsentChange(false)}
                        >
                            <View style={styles.consentIcon}>
                                <Ionicons
                                    name="phone-portrait-outline"
                                    size={20}
                                    color={!aiConsent ? colors.primary : colors.textSecondary}
                                />
                            </View>
                            <View style={styles.consentTextCont}>
                                <Text style={[styles.consentTitle, !aiConsent && styles.consentTitleActive]}>
                                    This Phone Only
                                </Text>
                                <Text style={styles.consentSub}>
                                    All data stays on this device. No cloud backup, no AI features.
                                </Text>
                            </View>
                            <Ionicons
                                name={!aiConsent ? "radio-button-on" : "radio-button-off"}
                                size={22}
                                color={!aiConsent ? colors.primary : colors.border}
                            />
                        </TouchableOpacity>

                        <View style={styles.infoBox}>
                            <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
                            <Text style={styles.infoText}>
                                Your phone number is always saved for account recovery and cannot be changed here.
                            </Text>
                        </View>

                        <PrimaryButton
                            title={isSaving ? "Saving..." : "Save Changes"}
                            onPress={handleSave}
                            style={styles.button}
                            disabled={isSaving || !shopName.trim() || !ownerName.trim()}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingTop: spacing.md,
        flexGrow: 1,
    },
    form: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: spacing.roundness * 2,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 5,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    consentCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.border,
        marginBottom: spacing.sm,
        gap: 12,
    },
    consentCardActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + "05",
    },
    consentIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    consentTextCont: {
        flex: 1,
    },
    consentTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    consentTitleActive: {
        color: colors.text,
        fontWeight: "700",
    },
    consentSub: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    infoBox: {
        flexDirection: "row",
        backgroundColor: colors.primary + "08",
        padding: spacing.md,
        borderRadius: 12,
        alignItems: "center",
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: colors.primary,
        fontWeight: "500",
    },
    button: {
        height: 56,
    },
});
