import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { insertBrand } from "../../db/db";

const BRAND_COLORS = [
    "#fef3c7",
    "#f3f4f6",
    "#f1f5f9",
    "#dcfce7",
    "#fee2e2",
    "#e0e7ff",
    "#f5f3ff",
    "#ffffff",
];

export default function AddBrandScreen() {
    const navigation = useNavigation();
    const [name, setName] = useState("");
    const [selectedColor, setSelectedColor] = useState(BRAND_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            insertBrand(name.trim(), selectedColor);
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", "Could not save brand. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Brand</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView
                    style={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Brand Preview */}
                    <View style={styles.previewContainer}>
                        <View style={[styles.previewLogo, { backgroundColor: selectedColor }]}>
                            {name ? (
                                <Text style={styles.previewLogoText}>
                                    {name.substring(0, 5).toUpperCase()}
                                </Text>
                            ) : (
                                <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
                            )}
                        </View>
                        <Text style={styles.previewLabel}>Logo Preview</Text>
                    </View>

                    {/* Brand Name Input */}
                    <View style={styles.inputSection}>
                        <Text style={styles.label}>Brand Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Britannia"
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    {/* Color Selection */}
                    <View style={styles.selectionSection}>
                        <Text style={styles.label}>Logo Background Color</Text>
                        <View style={styles.colorGrid}>
                            {BRAND_COLORS.map((color, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && styles.selectedColorOption,
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                >
                                    {selectedColor === color && (
                                        <Ionicons
                                            name="checkmark"
                                            size={20}
                                            color={color === "#ffffff" ? colors.text : "#fff"}
                                        />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.infoCard}>
                        <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
                        <Text style={styles.infoText}>
                            After creating a brand, you can assign it to products in the inventory section.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={!name.trim() || saving}
                >
                    <Ionicons name="checkmark-done" size={24} color="#fff" />
                    <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Create Brand"}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: { padding: 4, marginRight: spacing.sm },
    headerTitle: { fontSize: typography.sizes.xl, fontWeight: "700", color: colors.text },
    keyboardView: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg },
    previewContainer: {
        alignItems: "center",
        marginBottom: spacing.xl,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    previewLogo: {
        width: 100,
        height: 100,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    previewLogoText: { fontSize: 12, fontWeight: "900", color: colors.text, textAlign: "center", paddingHorizontal: 8 },
    previewLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    inputSection: { marginBottom: spacing.xl },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: "700",
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 56,
        fontSize: typography.sizes.md,
        color: colors.text,
    },
    selectionSection: { marginBottom: spacing.xl },
    colorGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    colorOption: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectedColorOption: { borderWidth: 3, borderColor: colors.primary },
    infoCard: {
        flexDirection: "row",
        gap: spacing.md,
        backgroundColor: "#eff6ff",
        padding: spacing.md,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    infoText: { flex: 1, fontSize: 13, color: "#1e40af", lineHeight: 18 },
    footer: {
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    saveButtonDisabled: { backgroundColor: colors.tabInactive, shadowOpacity: 0, elevation: 0 },
    saveButtonText: { color: "#fff", fontSize: typography.sizes.lg, fontWeight: "700" },
});
