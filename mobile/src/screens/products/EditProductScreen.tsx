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
    Alert,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getAllCategories, getAllBrands, updateProduct, Product, Category, Brand } from "../../db/db";

const UOMS = ["kg", "Liter", "Pcs", "gm", "Pack", "Box", "Dozen"];

export default function EditProductScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
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
    // Include the product's UOM even if not in the default list
    const uomList = React.useMemo(() => {
        if (product?.uom && !UOMS.includes(product.uom)) {
            return [...UOMS, product.uom];
        }
        return UOMS;
    }, [product?.uom]);
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
    const [saving, setSaving] = useState(false);

    useFocusEffect(
        useCallback(() => {
            setCategories(getAllCategories());
            setBrands(getAllBrands());
        }, [])
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
        onSelect: (id: string) => void,
        allowNone?: boolean
    ) => (
        <View style={styles.section}>
            <Text style={styles.label}>{title}</Text>
            {items.length === 0 ? (
                <Text style={styles.noItemsText}>
                    No {title.toLowerCase()} found. Add one in Settings first.
                </Text>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipScroll}
                >
                    {allowNone && (
                        <TouchableOpacity
                            style={[styles.chip, selectedId === null && styles.activeChip]}
                            onPress={() => onSelect("")}
                        >
                            <Text style={[styles.chipText, selectedId === null && styles.activeChipText]}>
                                None
                            </Text>
                        </TouchableOpacity>
                    )}
                    {items.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.chip, selectedId === item.id && styles.activeChip]}
                            onPress={() => onSelect(item.id)}
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
            Alert.alert("Validation", "Product name is required.");
            return;
        }
        if (!sellingPrice || isNaN(Number(sellingPrice))) {
            Alert.alert("Validation", "Please enter a valid selling price.");
            return;
        }
        setSaving(true);
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
            });
            Alert.alert("Updated!", `"${name.trim()}" has been updated.`, [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert("Error", "Could not update product. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Edit Product" showBack={true} />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Basic Information */}
                    <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>

                    <View style={styles.section}>
                        <Text style={styles.label}>Product Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Basmati Rice"
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    {renderChipSelector(
                        "Category",
                        categories.map((c) => ({ id: c.id, label: c.name })),
                        selectedCategoryId,
                        (id) => setSelectedCategoryId(id || null),
                        true
                    )}

                    {renderChipSelector(
                        "Brand",
                        brands.map((b) => ({ id: b.id, label: b.name })),
                        selectedBrandId,
                        (id) => setSelectedBrandId(id || null),
                        true
                    )}

                    <View style={styles.separator} />

                    {/* Pricing & Inventory */}
                    <Text style={styles.sectionTitle}>PRICING & INVENTORY</Text>

                    <View style={styles.section}>
                        <Text style={styles.label}>Purchase Price</Text>
                        <View style={styles.inputWithIcon}>
                            <Ionicons name="card-outline" size={20} color="#6b7280" />
                            <TextInput
                                style={styles.flexInput}
                                placeholder="₹ 0.00"
                                value={purchasePrice}
                                onChangeText={setPurchasePrice}
                                keyboardType="numeric"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <Text style={styles.helperText}>Used to calculate your actual profit margin in reports</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Selling Price *</Text>
                        <View style={[styles.inputWithIcon, styles.inputActive]}>
                            <Ionicons name="pricetag" size={20} color={colors.primary} />
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

                    <View style={styles.section}>
                        <Text style={styles.label}>Current Stock Quantity</Text>
                        <View style={styles.inputWithIcon}>
                            <Ionicons name="archive-outline" size={20} color="#6b7280" />
                            <TextInput
                                style={styles.flexInput}
                                placeholder="0"
                                value={stockQuantity}
                                onChangeText={setStockQuantity}
                                keyboardType="numeric"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <Text style={styles.helperText}>Correct this if the opening stock was entered incorrectly</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Low Stock Alert Threshold</Text>
                        <View style={styles.inputWithIcon}>
                            <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                            <TextInput
                                style={styles.flexInput}
                                placeholder="5"
                                value={minThreshold}
                                onChangeText={setMinThreshold}
                                keyboardType="numeric"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <Text style={styles.helperText}>Alert when stock falls below this number</Text>
                    </View>

                    {renderChipSelector(
                        "Unit of Measurement (UOM)",
                        uomList.map((u) => ({ id: u, label: u })),
                        selectedUom,
                        setSelectedUom
                    )}

                    <View style={{ height: 24 }} />
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!name.trim() || saving}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.saveButtonText}>{saving ? "Updating..." : "Update Product"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scroll: { padding: spacing.md },
    errorContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    errorText: { fontSize: 16, color: colors.textSecondary },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#6b7280",
        letterSpacing: 0.5,
        marginBottom: 16,
        marginTop: 8,
    },
    section: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
    noItemsText: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic" },
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 48,
        fontSize: 16,
        color: colors.text,
    },
    inputWithIcon: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 48,
        flexDirection: "row",
        alignItems: "center",
    },
    inputActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
    flexInput: { flex: 1, marginLeft: 12, fontSize: 16, color: colors.text },
    helperText: { fontSize: 12, color: "#6b7280", marginTop: 4 },
    chipScroll: { gap: 8 },
    chip: { backgroundColor: "#e5e7eb", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    activeChip: { backgroundColor: colors.primary },
    chipText: { fontSize: 14, fontWeight: "500", color: colors.text },
    activeChipText: { color: "#fff" },
    separator: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },
    footer: {
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    saveButtonDisabled: { backgroundColor: colors.tabInactive },
    saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
