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
import { Product } from "../../db/db";

interface UpdateStockModalProps {
    isVisible: boolean;
    onClose: () => void;
    selectedProducts: Product[];
    onUpdate: (quantity: number, mode: "add" | "reduce", isPackMode: boolean) => void;
}

export default function UpdateStockModal({
    isVisible,
    onClose,
    selectedProducts,
    onUpdate,
}: UpdateStockModalProps) {
    const [mode, setMode] = useState<"add" | "reduce">("add");
    const [quantity, setQuantity] = useState(1);
    const [isPackMode, setIsPackMode] = useState(false);

    const selectedCount = selectedProducts.length;
    const selectedItemsNames = selectedProducts.map((p) => p.name);

    // Pack mode available if at least one selected product has pack config
    const anyHasPack = selectedProducts.some(
        (p) => p.units_per_pack != null && p.units_per_pack > 0
    );

    const handleIncrement = () => setQuantity((q) => q + 1);
    const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));

    const getBaseQty = (product: Product) => {
        if (isPackMode && product.units_per_pack) {
            return quantity * product.units_per_pack;
        }
        return quantity;
    };

    const getPreviewLabel = (product: Product) => {
        if (isPackMode && product.units_per_pack && product.purchase_uom) {
            const base = quantity * product.units_per_pack;
            return `${quantity} ${product.purchase_uom} = ${base} ${product.uom}`;
        }
        return `${quantity} ${product.uom}`;
    };

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
                    <View style={styles.handle} />

                    <Text style={styles.title}>Update Stock</Text>

                    <View style={styles.selectionBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={styles.selectionBadgeText}>
                            {selectedCount} Items Selected
                        </Text>
                    </View>

                    {/* Mode Selector */}
                    <View style={styles.modeSelector}>
                        <TouchableOpacity
                            style={[styles.modeTab, mode === "add" && styles.activeModeTab]}
                            onPress={() => setMode("add")}
                        >
                            <Ionicons
                                name="add-circle"
                                size={20}
                                color={mode === "add" ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.modeTabText, mode === "add" && styles.activeModeTabText]}>
                                Add Stock
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeTab, mode === "reduce" && styles.activeModeTab]}
                            onPress={() => setMode("reduce")}
                        >
                            <Ionicons
                                name="remove-circle"
                                size={20}
                                color={mode === "reduce" ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.modeTabText, mode === "reduce" && styles.activeModeTabText]}>
                                Reduce Stock
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Pack Mode Toggle — only shown if any product has pack config */}
                    {anyHasPack && (
                        <TouchableOpacity
                            style={styles.packToggleRow}
                            onPress={() => { setIsPackMode((v) => !v); setQuantity(1); }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.packToggleLeft}>
                                <Ionicons name="cube-outline" size={18} color={colors.primary} />
                                <Text style={styles.packToggleText}>Enter quantity in packs/boxes</Text>
                            </View>
                            <View style={[styles.toggleTrack, isPackMode && styles.toggleTrackActive]}>
                                <View style={[styles.toggleThumb, isPackMode && styles.toggleThumbActive]} />
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Quantity Selector */}
                    <Text style={styles.label}>
                        {isPackMode ? "Packs / Boxes Received" : "Quantity per Item"}
                    </Text>
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
                        {isPackMode
                            ? "Each item's pack size will be used to calculate base units."
                            : `This quantity will be applied to all ${selectedCount} selected products.`}
                    </Text>

                    {/* Selected Items with per-item preview */}
                    <View style={styles.chipsRow}>
                        {selectedProducts.map((product, index) => (
                            <View key={product.id} style={styles.chip}>
                                <View
                                    style={[
                                        styles.dot,
                                        { backgroundColor: itemDots[index % itemDots.length] },
                                    ]}
                                />
                                <View>
                                    <Text style={styles.chipText}>{product.name}</Text>
                                    {isPackMode && (
                                        <Text style={styles.chipSubText}>
                                            {getPreviewLabel(product)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={() => onUpdate(quantity, mode, isPackMode)}
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
        marginBottom: 16,
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
    packToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#f0f9ff",
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        width: "100%",
        borderWidth: 1,
        borderColor: "#bae6fd",
    },
    packToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    packToggleText: { fontSize: 13, fontWeight: "600", color: colors.text },
    toggleTrack: {
        width: 40,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#d1d5db",
        padding: 2,
        justifyContent: "center",
    },
    toggleTrackActive: { backgroundColor: colors.primary },
    toggleThumb: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#fff",
        alignSelf: "flex-start",
    },
    toggleThumbActive: { alignSelf: "flex-end" },
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
    stepButton: { padding: 4 },
    quantityValue: {
        fontSize: 28,
        fontWeight: "800",
        color: colors.text,
    },
    helperText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 20,
        textAlign: "center",
    },
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        marginBottom: 28,
        paddingHorizontal: spacing.md,
    },
    chip: {
        flexDirection: "row",
        alignItems: "flex-start",
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
        marginTop: 4,
    },
    chipText: {
        fontSize: 13,
        fontWeight: "500",
        color: colors.text,
    },
    chipSubText: {
        fontSize: 11,
        color: colors.primary,
        fontWeight: "600",
        marginTop: 2,
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
