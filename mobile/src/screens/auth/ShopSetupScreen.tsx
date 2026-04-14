import React, { useState } from "react";
import {
    Alert,
    View,
    Text,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import TextInputField from "../../components/common/TextInputField";
import PrimaryButton from "../../components/common/PrimaryButton";
import { useNavigation } from "@react-navigation/native";
import { setHasConsent, setShopInfo } from "../../utils/storage";
import { useAuth } from "../../context/AuthContext";
import { insertShop } from "../../db/db";
import { flushSyncQueue } from "../../db/syncQueue";

export default function ShopSetupScreen() {
    const { completeSetup, phone, logout } = useAuth();
    const navigation = useNavigation();
    const [shopName, setShopName] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [category, setCategory] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [aiConsent, setAiConsent] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const handleCompleteSetup = async () => {
        if (!shopName.trim() || !ownerName.trim()) return;
        setIsSaving(true);
        try {
            const shopPhone = phone ?? '';

            // Persist consent flag
            await setHasConsent(aiConsent);

            // Persist shop info to AsyncStorage (fast reads across app)
            await setShopInfo({ shopName, ownerName, phone: shopPhone, category, whatsappNumber, aiConsent });

            // Persist to SQLite + enqueue sync to Supabase
            insertShop({ shopName, ownerName, phone: shopPhone, category, whatsappNumber, aiConsent });

            // Flip AuthContext — local save is enough to proceed; sync is best-effort
            completeSetup();

            // Flush sync queue in background — don't block navigation on network
            flushSyncQueue().catch((e) => console.warn('ShopSetup sync flush failed:', e));
        } catch (e) {
            console.error("ShopSetup save error:", e);
            Alert.alert(
                "Setup Failed",
                "Could not save your shop to the server. Please check your connection and try again.",
                [{ text: "OK" }]
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" backgroundColor={colors.background} />
            <View style={styles.headerNav}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => logout()}
                    activeOpacity={0.7}
                >
                    <View style={styles.backButtonIcon}>
                        <Ionicons name="chevron-back" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.backButtonText}>Change Number</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Progress Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="storefront-outline" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Setup Your Shop</Text>
                        <Text style={styles.subtitle}>
                            Just a few details to get your digital inventory started.
                        </Text>
                    </View>

                    {/* Form Section */}
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

                        {/* Privacy & Setup Choice */}
                        <Text style={styles.sectionTitle}>App Experience</Text>

                        <TouchableOpacity
                            style={[styles.consentCard, !aiConsent && styles.consentCardActive]}
                            onPress={() => setAiConsent(false)}
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
                                <Text style={styles.consentSub}>All data stays on this device. No cloud backup, no AI features.</Text>
                            </View>
                            <Ionicons
                                name={!aiConsent ? "radio-button-on" : "radio-button-off"}
                                size={22}
                                color={!aiConsent ? colors.primary : colors.border}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.consentCard, aiConsent && styles.consentCardActive]}
                            onPress={() => setAiConsent(true)}
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
                                <Text style={styles.consentSub}>Products, sales & customers backed up online. AI reorder suggestions included. (Recommended)</Text>
                            </View>
                            <Ionicons
                                name={aiConsent ? "radio-button-on" : "radio-button-off"}
                                size={22}
                                color={aiConsent ? colors.primary : colors.border}
                            />
                        </TouchableOpacity>



                        {/* Pricing */}
                        <Text style={styles.sectionTitle}>Pricing</Text>

                        <View style={[styles.planRow, !aiConsent && styles.planRowActive]}>
                            <View style={styles.planLeft}>
                                <Text style={styles.planName}>Basic</Text>
                                <Text style={styles.planDesc}>Stock, billing, udhar, SMS alerts</Text>
                            </View>
                            <Text style={styles.planPrice}>₹299<Text style={styles.planPer}>/mo</Text></Text>
                        </View>

                        <View style={[styles.planRow, aiConsent && styles.planRowActive]}>
                            <View style={styles.planLeft}>
                                <Text style={styles.planName}>Standard</Text>
                                <Text style={styles.planDesc}>+ Cloud backup, WhatsApp, AI suggestions</Text>
                            </View>
                            <Text style={styles.planPrice}>₹499<Text style={styles.planPer}>/mo</Text></Text>
                        </View>

                        <View style={styles.setupFeeRow}>
                            <Ionicons name="storefront-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.setupFeeText}>
                                One-time setup fee: <Text style={styles.setupFeeAmount}>₹500 – ₹1,000 Optional!</Text>
                            </Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
                            <Text style={styles.infoText}>
                                Your shop name and phone number are always saved for account recovery. Cloud Backup also secures your inventory, sales, and customer data.
                            </Text>
                        </View>

                        <PrimaryButton
                            title={isSaving ? "Saving..." : "Create My Shop"}
                            onPress={handleCompleteSetup}
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
        backgroundColor: colors.background,
    },
    headerNav: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 10,
    },
    backButtonIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    backButtonText: {
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        flexGrow: 1,
        justifyContent: "center",
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.primary + "15",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: "800",
        color: colors.text,
        textAlign: "center",
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        textAlign: "center",
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
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
        backgroundColor: colors.background,
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
    planRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.background,
        marginBottom: spacing.sm,
    },
    planRowActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + "05",
    },
    planLeft: {
        flex: 1,
        marginRight: spacing.md,
    },
    planName: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
    },
    planDesc: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    planPrice: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.primary,
    },
    planPer: {
        fontSize: 12,
        fontWeight: "500",
        color: colors.textSecondary,
    },
    setupFeeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: spacing.md,
        paddingHorizontal: 2,
    },
    setupFeeText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    setupFeeAmount: {
        fontWeight: "600",
        color: colors.text,
    },
    optional: {
        // new line

    }
});
