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

export default function ShopSetupScreen() {
    const navigation = useNavigation<any>();
    const [shopName, setShopName] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [category, setCategory] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");

    const handleCompleteSetup = () => {
        // Logic to save to Supabase/Firebase goes here
        console.log("Setup complete:", { shopName, ownerName, category });

        // After saving, navigate to the main app flow
        navigation.navigate("MainTabs" as any); 
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

                        <View style={styles.infoBox}>
                            <Ionicons name="information-circle" size={18} color={colors.primary} />
                            <Text style={styles.infoText}>
                                This information will appear on your digital bills.
                            </Text>
                        </View>

                        <PrimaryButton
                            title="Create My Shop"
                            onPress={handleCompleteSetup}
                            style={styles.button}
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
});
