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
    Alert,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { insertCategory } from "../../db/db";
import ScreenHeader from "../../components/common/ScreenHeader";

const AVAILABLE_ICONS = [
    { name: "cart", type: "Ionicons" },
    { name: "water", type: "Ionicons" },
    { name: "coffee", type: "MCI" },
    { name: "cookie", type: "MCI" },
    { name: "content-cut", type: "MCI" },
    { name: "briefcase", type: "Ionicons" },
    { name: "fast-food", type: "Ionicons" },
    { name: "shirt", type: "Ionicons" },
    { name: "car", type: "Ionicons" },
    { name: "construct", type: "Ionicons" },
    { name: "flask", type: "Ionicons" },
    { name: "hardware-chip", type: "Ionicons" },
];

const AVAILABLE_COLORS = [
    "#1a57db",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#6b7280",
];

const renderIcon = (type: string, name: string, color: string, size = 24) => {
    if (type === "MCI") {
        return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
    }
    return <Ionicons name={name as any} size={size} color={color} />;
};

export default function AddCategoryScreen() {
    const navigation = useNavigation();
    const [name, setName] = useState("");
    const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);
    const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            // Store as "Type:iconName" so ManageCategories can parse it
            insertCategory(name.trim(), `${selectedIcon.type}:${selectedIcon.name}`, selectedColor);
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", "Could not save category. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Add New Category" showBack={true} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
            >
                <ScrollView
                    style={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Preview */}
                    <View style={styles.previewContainer}>
                        <View style={[styles.previewIcon, { backgroundColor: selectedColor + "15" }]}>
                            {renderIcon(selectedIcon.type, selectedIcon.name, selectedColor, 40)}
                        </View>
                        <Text style={styles.previewLabel}>Category Preview</Text>
                    </View>

                    {/* Name Input */}
                    <View style={styles.inputSection}>
                        <Text style={styles.label}>Category Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Beverages"
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    {/* Icon Selection */}
                    <View style={styles.selectionSection}>
                        <Text style={styles.label}>Select Icon</Text>
                        <View style={styles.iconGrid}>
                            {AVAILABLE_ICONS.map((icon, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.iconOption,
                                        selectedIcon.name === icon.name && styles.selectedIconOption,
                                    ]}
                                    onPress={() => setSelectedIcon(icon)}
                                >
                                    {renderIcon(
                                        icon.type,
                                        icon.name,
                                        selectedIcon.name === icon.name ? colors.primary : colors.textSecondary
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Color Selection */}
                    <View style={styles.selectionSection}>
                        <Text style={styles.label}>Select Color Theme</Text>
                        <View style={styles.colorGrid}>
                            {AVAILABLE_COLORS.map((color, index) => (
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
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!name.trim() || saving}
                    >
                        <Ionicons name="checkmark-circle" size={24} color="#fff" />
                        <Text style={styles.saveButtonText}>
                            {saving ? "Saving..." : "Create Category"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
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
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    previewIcon: {
        width: 80,
        height: 80,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
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
    iconGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconOption: {
        width: 50,
        height: 50,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6",
    },
    selectedIconOption: {
        backgroundColor: colors.primary + "15",
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
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
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    selectedColorOption: {
        borderWidth: 3,
        borderColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
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
    saveButtonDisabled: {
        backgroundColor: colors.tabInactive,
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: { color: "#fff", fontSize: typography.sizes.lg, fontWeight: "700" },
});
