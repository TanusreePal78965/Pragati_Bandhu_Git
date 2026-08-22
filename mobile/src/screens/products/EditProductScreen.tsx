import React, { useState, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getAllCategories, getAllBrands, updateProduct, getPurchaseLogsByProduct, Product, Category, Brand, PurchaseLog } from "../../db/db";
import UomSelector from "../../components/products/UomSelector";
import { toUtcDate } from "../../utils/dateUtils";
import { useAlert } from "../../context/AlertContext";
import { haptics } from "../../utils/haptics";

export default function EditProductScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { showAlert } = useAlert();
    const product: Product = route.params?.product;

    const [name, setName] = useState(product?.name ?? "");
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
        product?.category_id ?? null
    );
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
        product?.brand_id ?? null
    );
    const [selectedUom, setSelectedUom] = useState(product?.uom ?? "Pcs");
    const [purchasePrice, setPurchasePrice] = useState(
        product?.purchase_price > 0 ? String(product.purchase_price) : ""
    );
    const [sellingPrice, setSellingPrice] = useState(
        product?.selling_price > 0 ? String(product.selling_price) : ""
    );
    const [stockQuantity, setStockQuantity] = useState(
        product?.stock_quantity != null ? String(product.stock_quantity) : "0"
    );
    const [minThreshold, setMinThreshold] = useState(
        product?.min_stock_threshold != null ? String(product.min_stock_threshold) : "5"
    );
    const [hasPackSize, setHasPackSize] = useState(!!product?.purchase_uom);
    const [purchaseUom, setPurchaseUom] = useState(product?.purchase_uom ?? "");
    const [unitsPerPack, setUnitsPerPack] = useState(
        product?.units_per_pack != null ? String(product.units_per_pack) : ""
    );
    const [saving, setSaving] = useState(false);
    const [purchaseLogs, setPurchaseLogs] = useState<PurchaseLog[]>([]);

    useFocusEffect(
        useCallback(() => {
            setCategories(getAllCategories());
            setBrands(getAllBrands());
            if (product?.id) {
                setPurchaseLogs(getPurchaseLogsByProduct(product.id));
            }
        }, [product?.id])
    );

    if (!product) {
        return (
            <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
                <ScreenHeader title="Edit Product" showBack={true} />
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Product not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderChipSelector = (
        title: string,
        items: { id: string; label: string }[],
        selectedId: string | null,
        onSelect: (id: string | null) => void
    ) => (
        <View style={styles.section}>
            <Text style={styles.label}>{title}</Text>
            {items.length === 0 ? (
                <Text style={styles.noItemsText}>
                    No {title.toLowerCase()} found.
                </Text>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipScroll}
                    keyboardShouldPersistTaps="handled"
                >
                    {items.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.chip, selectedId === item.id && styles.activeChip]}
                            onPress={() => onSelect(selectedId === item.id ? null : item.id)}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    selectedId === item.id && styles.activeChipText,
                                ]}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );

    const handleSave = () => {
        if (!name.trim()) {
            showAlert("Validation", "Product name is required.", undefined, "warning");
            return;
        }
        if (!sellingPrice || isNaN(Number(sellingPrice))) {
            showAlert("Validation", "Please enter a valid selling price.", undefined, "warning");
            return;
        }
        setSaving(true);
        haptics.success();
        try {
            updateProduct(product.id, {
                name: name.trim(),
                category_id: selectedCategoryId || null,
                brand_id: selectedBrandId || null,
                purchase_price: parseFloat(purchasePrice) || 0,
                selling_price: parseFloat(sellingPrice) || 0,
                stock_quantity: parseInt(stockQuantity) || 0,
                min_stock_threshold: parseInt(minThreshold) || 5,
                uom: selectedUom,
                purchase_uom: hasPackSize && purchaseUom.trim() ? purchaseUom.trim() : null,
                units_per_pack: hasPackSize && unitsPerPack ? parseInt(unitsPerPack) || null : null,
            });
            showAlert({
                title: "Updated!",
                message: `"${name.trim()}" has been updated.`,
                type: "success",
                buttons: [
                    { text: "OK", onPress: () => navigation.goBack() },
                ],
            });
        } catch (e) {
            showAlert("Error", "Could not update product. Please try again.", undefined, "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Edit Product" showBack={true} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Card 1: Basic Information */}
                    <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>BASIC INFORMATION</Text>

                        <View style={styles.section}>
                            <Text style={styles.label}>Product Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter product name"
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor="#9ca3af"
                            />
                        </View>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.columnFlex}>
                                {renderChipSelector(
                                    "Category",
                                    categories.map((c) => ({ id: c.id, label: c.name })),
                                    selectedCategoryId,
                                    setSelectedCategoryId
                                )}
                            </View>

                            <View style={styles.columnFlex}>
                                {renderChipSelector(
                                    "Brand",
                                    brands.map((b) => ({ id: b.id, label: b.name })),
                                    selectedBrandId,
                                    setSelectedBrandId
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Card 2: Pricing & Inventory */}
                    <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>PRICING & INVENTORY</Text>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.columnFlex}>
                                <Text style={styles.label}>Purchase Price</Text>
                                <View style={styles.inputWithIcon}>
                                    <Ionicons name="card-outline" size={16} color="#64748b" />
                                    <TextInput
                                        style={styles.flexInput}
                                        placeholder="₹ 0.00"
                                        value={purchasePrice}
                                        onChangeText={setPurchasePrice}
                                        keyboardType="numeric"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            </View>

                            <View style={styles.columnFlex}>
                                <Text style={styles.label}>Selling Price *</Text>
                                <View style={[styles.inputWithIcon, styles.inputActive]}>
                                    <Ionicons name="pricetag" size={16} color={colors.primary} />
                                    <TextInput
                                        style={styles.flexInput}
                                        placeholder="₹ 0.00"
                                        value={sellingPrice}
                                        onChangeText={setSellingPrice}
                                        keyboardType="numeric"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.columnFlex}>
                                <Text style={styles.label}>Current Stock</Text>
                                <View style={styles.inputWithIcon}>
                                    <Ionicons name="archive-outline" size={16} color="#64748b" />
                                    <TextInput
                                        style={styles.flexInput}
                                        placeholder="0"
                                        value={stockQuantity}
                                        onChangeText={setStockQuantity}
                                        keyboardType="numeric"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            </View>

                            <View style={styles.columnFlex}>
                                <Text style={styles.label}>Low Alert Min</Text>
                                <View style={styles.inputWithIcon}>
                                    <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                                    <TextInput
                                        style={styles.flexInput}
                                        placeholder="5"
                                        value={minThreshold}
                                        onChangeText={setMinThreshold}
                                        keyboardType="numeric"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={{ marginTop: 2 }}>
                            <Text style={styles.label}>Unit of Measurement (UOM) *</Text>
                            <UomSelector selectedUom={selectedUom} onSelect={setSelectedUom} />
                        </View>
                    </View>

                    {/* Card 3: Bulk Packaging */}
                    <View style={styles.card}>
                        <TouchableOpacity
                            style={styles.packToggleRow}
                            onPress={() => setHasPackSize((v) => !v)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.packToggleLeft}>
                                <Ionicons name="cube-outline" size={16} color={colors.primary} />
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.packToggleTitle}>Sells in packs / boxes / bags?</Text>
                                    <Text style={styles.packToggleSubtitle}>
                                        Enable if you buy in bulk (e.g. 1 Box = 12 Pcs)
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.toggleTrack, hasPackSize && styles.toggleTrackActive]}>
                                <View style={[styles.toggleThumb, hasPackSize && styles.toggleThumbActive]} />
                            </View>
                        </TouchableOpacity>

                        {hasPackSize && (
                            <View style={styles.twoColumnRow}>
                                <View style={styles.columnFlex}>
                                    <Text style={styles.label}>Pack Unit Name</Text>
                                    <View style={styles.inputWithIcon}>
                                        <Ionicons name="pricetag-outline" size={16} color="#64748b" />
                                        <TextInput
                                            style={styles.flexInput}
                                            placeholder="Box, Bag, Dozen"
                                            value={purchaseUom}
                                            onChangeText={setPurchaseUom}
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>

                                <View style={styles.columnFlex}>
                                    <Text style={styles.label}>Units Per Pack</Text>
                                    <View style={styles.inputWithIcon}>
                                        <Ionicons name="layers-outline" size={16} color="#64748b" />
                                        <TextInput
                                            style={styles.flexInput}
                                            placeholder="12"
                                            value={unitsPerPack}
                                            onChangeText={setUnitsPerPack}
                                            keyboardType="numeric"
                                            placeholderTextColor="#9ca3af"
                                        />
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Card 4: Purchase / Restock History */}
                    <View style={styles.card}>
                        <Text style={styles.cardHeaderTitle}>PURCHASE / RESTOCK HISTORY</Text>

                        {purchaseLogs.length === 0 ? (
                            <View style={styles.emptyHistory}>
                                <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                                <Text style={styles.emptyHistoryText}>No restocking history recorded yet</Text>
                            </View>
                        ) : (
                            <View style={styles.historyList}>
                                {purchaseLogs.map((log, index) => {
                                    const formatDateTime = (dateStr: string) => {
                                        try {
                                            const d = toUtcDate(dateStr);
                                            const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                                            const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                                            return `${date} · ${time}`;
                                        } catch (_) {
                                            return dateStr;
                                        }
                                    };
                                    return (
                                        <View
                                            key={log.id}
                                            style={[
                                                styles.historyRow,
                                                index === purchaseLogs.length - 1 && { borderBottomWidth: 0 },
                                            ]}
                                        >
                                            <View style={styles.historyIcon}>
                                                <Ionicons name="add" size={16} color={colors.primary} />
                                            </View>
                                            <View style={styles.historyInfo}>
                                                <Text style={styles.historyDate}>{formatDateTime(log.created_at)}</Text>
                                                <Text style={styles.historyMeta}>
                                                    Cost: ₹{log.purchase_price.toFixed(2)} · Selling: ₹{log.selling_price.toFixed(2)}
                                                </Text>
                                            </View>
                                            <View style={styles.historyRight}>
                                                <Text style={styles.historyQty}>+{log.qty} {selectedUom}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    {/* Save Button */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={!name.trim() || saving}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                            <Text style={styles.saveButtonText}>{saving ? "Updating..." : "Update Product"}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 16 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scroll: { paddingHorizontal: spacing.xs, paddingTop: 2, paddingBottom: 12 },
    errorContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    errorText: { fontSize: 16, color: colors.textSecondary },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    cardHeaderTitle: {
        fontSize: 10,
        fontWeight: "800",
        color: "#64748b",
        letterSpacing: 0.6,
        marginBottom: 8,
        textTransform: "uppercase",
    },
    section: { marginBottom: 8 },
    twoColumnRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    columnFlex: { flex: 1 },
    label: { fontSize: 11, fontWeight: "700", color: "#334155", marginBottom: 3 },
    noItemsText: { fontSize: 11, color: colors.textSecondary, fontStyle: "italic" },
    input: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 0,
        height: 40,
        fontSize: 14,
        color: colors.text,
    },
    inputWithIcon: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 0,
        height: 40,
        flexDirection: "row",
        alignItems: "center",
    },
    inputActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
    flexInput: { flex: 1, marginLeft: 6, fontSize: 14, color: colors.text, paddingVertical: 0 },
    chipScroll: { gap: 4 },
    chip: { backgroundColor: "#e2e8f0", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    activeChip: { backgroundColor: colors.primary },
    chipText: { fontSize: 11, fontWeight: "600", color: "#334155" },
    activeChipText: { color: "#fff" },
    packToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    packToggleLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    packToggleTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
    packToggleSubtitle: { fontSize: 10, color: "#64748b", marginTop: 1 },
    toggleTrack: {
        width: 36,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#cbd5e1",
        padding: 2,
        justifyContent: "center",
    },
    toggleTrackActive: { backgroundColor: colors.primary },
    toggleThumb: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#fff",
        alignSelf: "flex-start",
    },
    toggleThumbActive: { alignSelf: "flex-end" },
    emptyHistory: { alignItems: "center", paddingVertical: spacing.md, gap: 4 },
    emptyHistoryText: { fontSize: 12, color: colors.textSecondary, textAlign: "center" },
    historyList: {
        backgroundColor: "#f8fafc",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        overflow: "hidden",
    },
    historyRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    historyIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "#e0f2fe",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    historyInfo: { flex: 1 },
    historyDate: { fontSize: 12, fontWeight: "600", color: colors.text },
    historyMeta: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
    historyRight: { flexDirection: "row", alignItems: "center" },
    historyQty: { fontSize: 13, fontWeight: "700", color: colors.primary },
    footer: {
        marginTop: 4,
        marginBottom: 8,
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 42,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },
    saveButtonDisabled: {
        backgroundColor: "#e2e8f0",
        borderColor: "transparent",
    },
    saveButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
});
