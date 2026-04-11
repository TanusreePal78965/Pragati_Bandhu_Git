import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import TextInputField from "../../components/common/TextInputField";
import PrimaryButton from "../../components/common/PrimaryButton";
import { setHasConsent, setShopInfo } from "../../utils/storage";
import { useAuth } from "../../context/AuthContext";
import { insertShop } from "../../db/db";

export default function ShopSetupScreen() {
    const navigation = useNavigation<any>();
    const { completeSetup } = useAuth();
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
            // Persist consent flag
            await setHasConsent(aiConsent);

            // Persist shop info to AsyncStorage (fast reads across app)
            await setShopInfo({ shopName, ownerName, category, whatsappNumber, aiConsent });

            // Persist to SQLite (available for sync queue later)
            insertShop({ shopName, ownerName, category, whatsappNumber, aiConsent });

            // Flip AuthContext → RootNavigator shows MainTabs
            completeSetup();
        } catch (e) {
            console.error("ShopSetup save error:", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
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
                            style={[styles.consentCard, aiConsent && styles.consentCardActive]}
                            onPress={() => setAiConsent(true)}
                        >
                            <View style={styles.consentIcon}>
                                <Ionicons 
                                    name="sparkles" 
                                    size={20} 
                                    color={aiConsent ? colors.primary : colors.textSecondary} 
                                />
                            </View>
                            <View style={styles.consentTextCont}>
                                <Text style={[styles.consentTitle, aiConsent && styles.consentTitleActive]}>
                                    Need AI suggestions
                                </Text>
                                <Text style={styles.consentSub}>Smart reordering & analytics (Recommended)</Text>
                            </View>
                            <Ionicons 
                                name={aiConsent ? "radio-button-on" : "radio-button-off"} 
                                size={22} 
                                color={aiConsent ? colors.primary : colors.border} 
                            />
                        </TouchableOpacity>

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
                                    Only on my phone
                                </Text>
                                <Text style={styles.consentSub}>Basic stock tracking only, no internet data share</Text>
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
                                Your privacy is important. We never share your shop's location or name with third parties.
                            </Text>
                        </View>

                        <PrimaryButton
                            title={isSaving ? "Saving..." : "Create My Shop"}
                            onPress={handleCompleteSetup}
                            style={styles.button}
                            disabled={isSaving || !shopName.trim() || !ownerName.trim()}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.skipText}>Not now, go back</Text>
                    </TouchableOpacity>
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
    skipButton: {
        marginTop: spacing.xl,
        alignItems: "center",
    },
    skipText: {
        color: colors.textSecondary,
        fontSize: typography.sizes.sm,
        fontWeight: "600",
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
});
