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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getAllCategories, getAllBrands, insertProduct, Category, Brand } from "../../db/db";

const UOMS = ["kg", "Liter", "Pcs", "gm", "Pack", "Box", "Dozen"];

export default function AddProductScreen() {
    const navigation = useNavigation();
    const [name, setName] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedUom, setSelectedUom] = useState("Pcs");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [sellingPrice, setSellingPrice] = useState("");
    const [initialStock, setInitialStock] = useState("");
    const [minThreshold, setMinThreshold] = useState("5");
    const [saving, setSaving] = useState(false);
    const [hasPackSize, setHasPackSize] = useState(false);
    const [purchaseUom, setPurchaseUom] = useState("");
    const [unitsPerPack, setUnitsPerPack] = useState("");

    useFocusEffect(
        useCallback(() => {
            const cats = getAllCategories();
            const brnds = getAllBrands();
            setCategories(cats);
            setBrands(brnds);
            if (cats.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(cats[0].id);
            }
        }, [])
    );

    const renderChipSelector = (
        title: string,
        items: { id: string; label: string }[],
        selectedId: string | null,
        onSelect: (id: string) => void
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
            insertProduct({
                name: name.trim(),
                category_id: selectedCategoryId,
                brand_id: selectedBrandId,
                purchase_price: parseFloat(purchasePrice) || 0,
                selling_price: parseFloat(sellingPrice) || 0,
                stock_quantity: parseInt(initialStock) || 0,
                min_stock_threshold: parseInt(minThreshold) || 5,
                uom: selectedUom,
                purchase_uom: hasPackSize && purchaseUom.trim() ? purchaseUom.trim() : null,
                units_per_pack: hasPackSize && unitsPerPack ? parseInt(unitsPerPack) || null : null,
            });
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", "Could not save product. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Add New Product" showBack={true} />
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
                        setSelectedCategoryId
                    )}

                    {renderChipSelector(
                        "Brand",
                        brands.map((b) => ({ id: b.id, label: b.name })),
                        selectedBrandId,
                        setSelectedBrandId
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
                        <Text style={styles.label}>Initial Stock Quantity</Text>
                        <View style={styles.inputWithIcon}>
                            <Ionicons name="archive-outline" size={20} color="#6b7280" />
                            <TextInput
                                style={styles.flexInput}
                                placeholder="0"
                                value={initialStock}
                                onChangeText={setInitialStock}
                                keyboardType="numeric"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                        <Text style={styles.helperText}>Current quantity available in your store</Text>
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
                        UOMS.map((u) => ({ id: u, label: u })),
                        selectedUom,
                        setSelectedUom
                    )}

                    <View style={styles.separator} />

                    {/* Pack Size (Optional) */}
                    <Text style={styles.sectionTitle}>BULK / PACK SIZE (OPTIONAL)</Text>

                    <TouchableOpacity
                        style={styles.packToggleRow}
                        onPress={() => setHasPackSize((v) => !v)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.packToggleLeft}>
                            <Ionicons name="cube-outline" size={20} color={colors.primary} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
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
                        <>
                            <View style={styles.section}>
                                <Text style={styles.label}>Pack / Bulk Unit Name</Text>
                                <View style={styles.inputWithIcon}>
                                    <Ionicons name="pricetag-outline" size={20} color="#6b7280" />
                                    <TextInput
                                        style={styles.flexInput}
                                        placeholder="e.g. Box, Bag, Dozen, Crate"
                                        value={purchaseUom}
                                        onChangeText={setPurchaseUom}
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                                <Text style={styles.helperText}>What do you call the big unit? (shown on receipts)</Text>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.label}>
                                    {purchaseUom.trim() ? `${selectedUom}s per ${purchaseUom.trim()}` : `${selectedUom}s per pack`}
                                </Text>
                                <View style={styles.inputWithIcon}>
                                    <Ionicons name="layers-outline" size={20} color="#6b7280" />
                                    <TextInput
                                        style={styles.flexInput}
                                        placeholder="e.g. 12"
                                        value={unitsPerPack}
                                        onChangeText={setUnitsPerPack}
                                        keyboardType="numeric"
                                        placeholderTextColor="#9ca3af"
                                    />
                                </View>
                                <Text style={styles.helperText}>
                                    {purchaseUom.trim() && unitsPerPack
                                        ? `1 ${purchaseUom.trim()} = ${unitsPerPack} ${selectedUom}`
                                        : "How many base units fit in one pack?"}
                                </Text>
                            </View>
                        </>
                    )}

                    <View style={styles.alertBox}>
                        <Ionicons name="information-circle" size={24} color={colors.primary} />
                        <View style={styles.alertContent}>
                            <Text style={styles.alertTitle}>Stock Alerts</Text>
                            <Text style={styles.alertText}>
                                Pragati Bandhu will automatically notify you when this item reaches low stock.
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!name.trim() || saving}
                    >
                        <Ionicons name="save" size={20} color="#fff" />
                        <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Product"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scroll: { padding: spacing.md },
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
    alertBox: {
        backgroundColor: "#eff6ff",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        gap: 12,
        marginBottom: 40,
    },
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 2 },
    alertText: { fontSize: 12, color: "#4b5563", lineHeight: 18 },
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
    packToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#f8fafc",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    packToggleLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    packToggleTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    packToggleSubtitle: { fontSize: 12, color: "#6b7280", marginTop: 2 },
    toggleTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#d1d5db",
        padding: 2,
        justifyContent: "center",
    },
    toggleTrackActive: { backgroundColor: colors.primary },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#fff",
        alignSelf: "flex-start",
    },
    toggleThumbActive: { alignSelf: "flex-end" },
});
