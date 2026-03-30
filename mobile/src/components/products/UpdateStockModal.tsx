import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface UpdateStockModalProps {
    isVisible: boolean;
    onClose: () => void;
    selectedCount: number;
    selectedItemsNames: string[];
    onUpdate: (quantity: number, mode: "add" | "reduce") => void;
}

export default function UpdateStockModal({
    isVisible,
    onClose,
    selectedCount,
    selectedItemsNames,
    onUpdate,
}: UpdateStockModalProps) {
    const [mode, setMode] = useState<"add" | "reduce">("add");
    const [quantity, setQuantity] = useState(10);

    const handleIncrement = () => setQuantity((q) => q + 1);
    const handleDecrement = () => setQuantity((q) => Math.max(0, q - 1));

    const itemDots = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.content}>
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Title */}
                    <Text style={styles.title}>Update Stock</Text>

                    {/* Selection Badge */}
                    <View style={styles.selectionBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={styles.selectionBadgeText}>
                            {selectedCount} Items Selected
                        </Text>
                    </View>

                    {/* Mode Selector */}
                    <View style={styles.modeSelector}>
                        <TouchableOpacity
                            style={[
                                styles.modeTab,
                                mode === "add" && styles.activeModeTab,
                            ]}
                            onPress={() => setMode("add")}
                        >
                            <Ionicons
                                name="add-circle"
                                size={20}
                                color={mode === "add" ? colors.primary : colors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.modeTabText,
                                    mode === "add" && styles.activeModeTabText,
                                ]}
                            >
                                Add Stock
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.modeTab,
                                mode === "reduce" && styles.activeModeTab,
                            ]}
                            onPress={() => setMode("reduce")}
                        >
                            <Ionicons
                                name="remove-circle"
                                size={20}
                                color={mode === "reduce" ? colors.primary : colors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.modeTabText,
                                    mode === "reduce" && styles.activeModeTabText,
                                ]}
                            >
                                Reduce Stock
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Quantity Selector */}
                    <Text style={styles.label}>New Quantity per Item</Text>
                    <View style={styles.quantitySelector}>
                        <TouchableOpacity style={styles.stepButton} onPress={handleDecrement}>
                            <Ionicons name="remove" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <TouchableOpacity style={styles.stepButton} onPress={handleIncrement}>
                            <Ionicons name="add" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.helperText}>
                        This quantity will be applied to all {selectedCount} selected products.
                    </Text>

                    {/* Selected Items Chips */}
                    <View style={styles.chipsRow}>
                        {selectedItemsNames.map((name, index) => (
                            <View key={name} style={styles.chip}>
                                <View
                                    style={[
                                        styles.dot,
                                        { backgroundColor: itemDots[index % itemDots.length] },
                                    ]}
                                />
                                <Text style={styles.chipText}>{name}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Actions */}
                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={() => onUpdate(quantity, mode)}
                    >
                        <Text style={styles.updateButtonText}>Update Stock</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    content: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
        alignItems: "center",
    },
    handle: {
        width: 48,
        height: 5,
        backgroundColor: "#e5e7eb",
        borderRadius: 2.5,
        marginTop: 12,
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 8,
    },
    selectionBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#edf2ff",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 6,
        marginBottom: 24,
    },
    selectionBadgeText: {
        color: colors.primary,
        fontWeight: "600",
        fontSize: 14,
    },
    modeSelector: {
        flexDirection: "row",
        backgroundColor: "#f3f4f6",
        padding: 4,
        borderRadius: 12,
        marginBottom: 24,
        width: "100%",
    },
    modeTab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    activeModeTab: {
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    modeTabText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    activeModeTabText: {
        color: colors.primary,
    },
    label: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 12,
        alignSelf: "flex-start",
    },
    quantitySelector: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        width: "100%",
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    stepButton: {
        padding: 4,
    },
    quantityValue: {
        fontSize: 28,
        fontWeight: "800",
        color: colors.text,
    },
    helperText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 24,
    },
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        marginBottom: 32,
        paddingHorizontal: spacing.md,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#f3f4f6",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    chipText: {
        fontSize: 13,
        fontWeight: "500",
        color: colors.text,
    },
    updateButton: {
        backgroundColor: colors.primary,
        width: "100%",
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 12,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    updateButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    cancelButton: {
        width: "100%",
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontWeight: "700",
        fontSize: 16,
    },
});
