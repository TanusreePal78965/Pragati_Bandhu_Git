import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import TextInputField from "../../components/common/TextInputField";
import PrimaryButton from "../../components/common/PrimaryButton";

export default function AddProductScreen() {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [stock, setStock] = useState("");
    const [minThreshold, setMinThreshold] = useState("5");
    const [unit, setUnit] = useState("Pieces");
    const [lowStockAlert, setLowStockAlert] = useState(true);

    const handleSave = () => {
        // Implement save logic here
        console.log("Saving product...");
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <ScreenHeader title="Add New Product" showBack />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.form}>
                        <TextInputField
                            label="Product Name"
                            placeholder="e.g. Paracetamol 500mg"
                            value={name}
                            onChangeText={setName}
                        />

                        <TextInputField
                            label="Category"
                            placeholder="e.g. Medicine"
                            value={category}
                            onChangeText={setCategory}
                        />

                        <View style={styles.row}>
                            <TextInputField
                                label="Current Stock"
                                placeholder="0"
                                value={stock}
                                onChangeText={setStock}
                                keyboardType="numeric"
                                containerStyle={styles.flex1}
                            />
                            <View style={styles.spacer} />
                            <TextInputField
                                label="Unit"
                                placeholder="Pieces"
                                value={unit}
                                onChangeText={setUnit}
                                containerStyle={styles.flex1}
                            />
                        </View>

                        <TextInputField
                            label="Minimum Stock Threshold"
                            placeholder="5"
                            value={minThreshold}
                            onChangeText={setMinThreshold}
                            keyboardType="numeric"
                        />

                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>
                                We'll alert you via WhatsApp when stock drops below this
                                number.
                            </Text>
                        </View>

                        <View style={styles.alertToggle}>
                            <View>
                                <Text style={styles.toggleLabel}>Low Stock Alert</Text>
                                <Text style={styles.toggleDesc}>
                                    Enable automatic alerts for this item.
                                </Text>
                            </View>
                            <Switch
                                value={lowStockAlert}
                                onValueChange={setLowStockAlert}
                                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                                thumbColor={lowStockAlert ? colors.primary : colors.background}
                            />
                        </View>

                        <PrimaryButton
                            title="Save Product"
                            onPress={handleSave}
                            style={styles.saveButton}
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
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
    },
    form: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: spacing.roundness,
        borderWidth: 1,
        borderColor: colors.border,
    },
    row: {
        flexDirection: "row",
    },
    flex1: {
        flex: 1,
    },
    spacer: {
        width: spacing.md,
    },
    infoBox: {
        backgroundColor: colors.primary + "10",
        padding: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.lg,
    },
    infoText: {
        fontSize: typography.sizes.xs,
        color: colors.primary,
        fontWeight: "500",
        lineHeight: 18,
    },
    alertToggle: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginBottom: spacing.xl,
    },
    toggleLabel: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    toggleDesc: {
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    saveButton: {
        marginTop: spacing.sm,
    },
});
