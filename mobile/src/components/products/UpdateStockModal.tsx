import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable,
    TextInput,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { Product } from "../../db/db";

interface UpdateStockModalProps {
    isVisible: boolean;
    onClose: () => void;
    selectedProducts: Product[];
    onUpdate: (
        quantity: number,
        mode: "add" | "reduce",
        isPackMode: boolean,
        purchasePrice?: number,
        sellingPrice?: number,
        strategy?: "average" | "batch" | "replace",
        batchName?: string
    ) => void;
}

export default function UpdateStockModal({
    isVisible,
    onClose,
    selectedProducts,
    onUpdate,
}: UpdateStockModalProps) {
    const [mode, setMode] = useState<"add" | "reduce">("add");
    const [quantityInput, setQuantityInput] = useState("1");
    const [isPackMode, setIsPackMode] = useState(false);

    // Pricing States for single product restock
    const [purchasePriceInput, setPurchasePriceInput] = useState("");
    const [sellingPriceInput, setSellingPriceInput] = useState("");
    const [strategy, setStrategy] = useState<"average" | "batch" | "replace">("average");
    const [batchName, setBatchName] = useState("");

    const selectedCount = selectedProducts.length;
    const singleProduct = selectedCount === 1 ? selectedProducts[0] : null;

    // Reset state variables when modal becomes visible or selection changes
    useEffect(() => {
        if (isVisible) {
            setMode("add");
            setQuantityInput("1");
            setIsPackMode(false);
            if (singleProduct) {
                setPurchasePriceInput(singleProduct.purchase_price > 0 ? String(singleProduct.purchase_price) : "");
                setSellingPriceInput(singleProduct.selling_price > 0 ? String(singleProduct.selling_price) : "");
                setStrategy("average");
                setBatchName(singleProduct.name ? `${singleProduct.name} - Batch 2` : "");
            } else {
                setPurchasePriceInput("");
                setSellingPriceInput("");
                setStrategy("average");
                setBatchName("");
            }
        }
    }, [isVisible, selectedProducts]);

    // Pack mode available if at least one selected product has pack config
    const anyHasPack = selectedProducts.some(
        (p) => p.units_per_pack != null && p.units_per_pack > 0
    );

    const quantity = parseFloat(quantityInput) || 0;

    const handleIncrement = () => {
        const current = parseFloat(quantityInput) || 0;
        setQuantityInput(String(current + 1));
    };
    const handleDecrement = () => {
        const current = parseFloat(quantityInput) || 0;
        setQuantityInput(String(Math.max(1, current - 1)));
    };

    const getPreviewLabel = (product: Product) => {
        if (isPackMode && product.units_per_pack && product.purchase_uom) {
            const base = quantity * product.units_per_pack;
            return `${quantity} ${product.purchase_uom} = ${base} ${product.uom}`;
        }
        return `${quantity} ${product.uom}`;
    };

    // Live Margin & Weighted Cost Math
    const oldStock = singleProduct?.stock_quantity ?? 0;
    const oldCost = singleProduct?.purchase_price ?? 0;
    const oldSelling = singleProduct?.selling_price ?? 0;

    const newCost = parseFloat(purchasePriceInput) || 0;
    const newSelling = parseFloat(sellingPriceInput) || 0;
    const isCostChanged = newCost !== oldCost;

    const currentMarginPct = newSelling > 0 ? ((newSelling - newCost) / newSelling) * 100 : 0;
    const originalMarginPct = oldSelling > 0 ? ((oldSelling - oldCost) / oldSelling) * 100 : 0;

    const addedBaseQty = singleProduct && isPackMode && singleProduct.units_per_pack
        ? quantity * singleProduct.units_per_pack
        : quantity;

    const totalStock = oldStock + addedBaseQty;
    const weightedAvgCost = totalStock > 0
        ? ((oldStock * oldCost) + (addedBaseQty * newCost)) / totalStock
        : newCost;

    // Suggest new selling price to keep original margin:
    const originalMarginFactor = 1 - (originalMarginPct / 100);
    const recommendedSellingPrice = originalMarginFactor > 0 && originalMarginFactor < 1
        ? weightedAvgCost / originalMarginFactor
        : weightedAvgCost * 1.25;

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

                    <View style={styles.headerRow}>
                        <Text style={styles.title}>Update Stock</Text>
                        <TouchableOpacity style={styles.closeIconBtn} onPress={onClose} activeOpacity={0.7}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

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

                    {/* Pack Mode Toggle */}
                    {anyHasPack && (
                        <TouchableOpacity
                            style={styles.packToggleRow}
                            onPress={() => { setIsPackMode((v) => !v); setQuantityInput("1"); }}
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
                        <TextInput
                            style={styles.quantityInput}
                            value={quantityInput}
                            onChangeText={setQuantityInput}
                            keyboardType="numeric"
                            selectTextOnFocus
                            textAlign="center"
                        />
                        <TouchableOpacity style={styles.stepButton} onPress={handleIncrement}>
                            <Ionicons name="add" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.helperText}>
                        {isPackMode
                            ? "Each item's pack size will be used to calculate base units."
                            : `This quantity will be applied to all ${selectedCount} selected products.`}
                    </Text>

                    {/* Pricing Inputs (Only for single product restocks) */}
                    {singleProduct && mode === "add" && (
                        <View style={styles.pricingSection}>
                            <View style={styles.pricingRow}>
                                <View style={styles.pricingInputContainer}>
                                    <Text style={styles.pricingInputLabel}>New Purchase Price</Text>
                                    <View style={styles.pricingInputBox}>
                                        <Text style={styles.currencySymbol}>₹</Text>
                                        <TextInput
                                            style={styles.pricingTextInput}
                                            value={purchasePriceInput}
                                            onChangeText={setPurchasePriceInput}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>

                                <View style={styles.pricingInputContainer}>
                                    <Text style={styles.pricingInputLabel}>New Selling Price</Text>
                                    <View style={styles.pricingInputBox}>
                                        <Text style={styles.currencySymbol}>₹</Text>
                                        <TextInput
                                            style={styles.pricingTextInput}
                                            value={sellingPriceInput}
                                            onChangeText={setSellingPriceInput}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.marginPreview}>
                                Expected Margin: {currentMarginPct.toFixed(1)}% {originalMarginPct > 0 && `(Prev: ${originalMarginPct.toFixed(1)}%)`}
                            </Text>
                        </View>
                    )}

                    {/* Pricing Strategy Selector (If purchase cost changed) */}
                    {singleProduct && isCostChanged && mode === "add" && (
                        <View style={styles.strategyContainer}>
                            <Text style={styles.strategyLabel}>Cost price changed. Choose pricing strategy:</Text>
                            
                            <View style={styles.strategyOptions}>
                                <TouchableOpacity
                                    style={[styles.strategyOption, strategy === "average" && styles.strategyOptionActive]}
                                    onPress={() => setStrategy("average")}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.radioDot, strategy === "average" && styles.radioDotActive]} />
                                    <View style={styles.strategyTextContent}>
                                        <Text style={styles.strategyOptionTitle}>Average Cost (Mix)</Text>
                                        <Text style={styles.strategyOptionDesc}>
                                            New average cost: ₹{weightedAvgCost.toFixed(2)}. Suggest selling at ₹{recommendedSellingPrice.toFixed(2)}.
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.strategyOption, strategy === "replace" && styles.strategyOptionActive]}
                                    onPress={() => setStrategy("replace")}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.radioDot, strategy === "replace" && styles.radioDotActive]} />
                                    <View style={styles.strategyTextContent}>
                                        <Text style={styles.strategyOptionTitle}>Replacement (Update All)</Text>
                                        <Text style={styles.strategyOptionDesc}>
                                            Set all {totalStock} {singleProduct.uom} to restock purchase price ₹{newCost.toFixed(2)}.
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.strategyOption, strategy === "batch" && styles.strategyOptionActive]}
                                    onPress={() => setStrategy("batch")}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.radioDot, strategy === "batch" && styles.radioDotActive]} />
                                    <View style={styles.strategyTextContent}>
                                        <Text style={styles.strategyOptionTitle}>Create New Batch</Text>
                                        <Text style={styles.strategyOptionDesc}>
                                            Keep old {oldStock} {singleProduct.uom} at old price. Create a new listing for new batch.
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {strategy === "batch" && (
                                <View style={styles.batchNameContainer}>
                                    <Text style={styles.batchNameLabel}>New Batch Name Suffix</Text>
                                    <TextInput
                                        style={styles.batchNameInput}
                                        value={batchName}
                                        onChangeText={setBatchName}
                                        placeholder="e.g. Minikit - Batch 2"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            )}
                        </View>
                    )}

                    {/* Selected Items preview */}
                    {!singleProduct && (
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
                    )}

                    <TouchableOpacity
                        style={styles.updateButton}
                        onPress={() => {
                            if (quantity <= 0) {
                                Alert.alert("Validation", "Please enter a valid quantity greater than 0.");
                                return;
                            }
                            if (singleProduct && mode === "add") {
                                if (strategy === "batch" && !batchName.trim()) {
                                    Alert.alert("Validation", "Please provide a suffix or name for the new batch.");
                                    return;
                                }
                                onUpdate(
                                    quantity,
                                    mode,
                                    isPackMode,
                                    newCost,
                                    newSelling,
                                    strategy,
                                    strategy === "batch" ? batchName.trim() : undefined
                                );
                            } else {
                                onUpdate(quantity, mode, isPackMode);
                            }
                        }}
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
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 8,
    },
    closeIconBtn: {
        padding: 4,
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
    quantityInput: {
        fontSize: 28,
        fontWeight: "800",
        color: colors.text,
        minWidth: 100,
        textAlign: "center",
        paddingVertical: 0,
    },
    helperText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 20,
        textAlign: "center",
    },
    pricingSection: {
        width: "100%",
        marginBottom: 16,
        backgroundColor: "#f8fafc",
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    pricingRow: {
        flexDirection: "row",
        gap: 12,
    },
    pricingInputContainer: {
        flex: 1,
    },
    pricingInputLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textSecondary,
        marginBottom: 6,
    },
    pricingInputBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 40,
    },
    currencySymbol: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748b",
        marginRight: 4,
    },
    pricingTextInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        fontWeight: "600",
        padding: 0,
    },
    marginPreview: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.primary,
        marginTop: 8,
        textAlign: "right",
    },
    strategyContainer: {
        width: "100%",
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#fffbeb",
        borderWidth: 1,
        borderColor: "#fde68a",
    },
    strategyLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#92400e",
        marginBottom: 10,
    },
    strategyOptions: {
        gap: 8,
    },
    strategyOption: {
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 10,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#fcd34d",
        borderRadius: 8,
        gap: 10,
    },
    strategyOptionActive: {
        borderColor: "#d97706",
        backgroundColor: "#fffbeb",
    },
    radioDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: "#94a3b8",
        marginTop: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    radioDotActive: {
        borderColor: "#d97706",
        backgroundColor: "#d97706",
    },
    strategyTextContent: {
        flex: 1,
    },
    strategyOptionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.text,
    },
    strategyOptionDesc: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    batchNameContainer: {
        marginTop: 12,
        backgroundColor: "#fff",
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#fcd34d",
    },
    batchNameLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: colors.textSecondary,
        marginBottom: 4,
    },
    batchNameInput: {
        height: 32,
        fontSize: 13,
        color: colors.text,
        fontWeight: "600",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        padding: 0,
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
