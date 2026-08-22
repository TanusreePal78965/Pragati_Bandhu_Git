import React, { useState, useCallback, useRef } from "react";
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
    Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { haptics } from "../../utils/haptics";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import ScreenHeader from "../../components/common/ScreenHeader";
import {
    getAllCategories,
    getAllBrands,
    getAllProducts,
    insertProduct,
    insertProductsBatch,
    Category,
    Brand,
} from "../../db/db";
import UomSelector from "../../components/products/UomSelector";
import { useAlert } from "../../context/AlertContext";

export type Mode = "single" | "batch";

interface BatchRow {
    id: string;
    name: string;
    categoryId: string | null;
    brandId?: string | null;
    purchasePrice: string;
    sellingPrice: string;
    stock: string;
    uom: string;
}

export default function AddProductScreen() {
    const navigation = useNavigation<any>();
    const { showAlert } = useAlert();
    const [mode, setMode] = useState<Mode>("single");
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);

    // ─── Single Mode States ───────────────────────────────────────────────────
    const [name, setName] = useState("");
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
    const [successBanner, setSuccessBanner] = useState<string | null>(null);
    const nameInputRef = useRef<TextInput>(null);

    // ─── Dynamic Express Batch Mode States ────────────────────────────────────
    const [batchRows, setBatchRows] = useState<BatchRow[]>([
        { id: "1", name: "", categoryId: null, purchasePrice: "", sellingPrice: "", stock: "", uom: "Pcs" },
        { id: "2", name: "", categoryId: null, purchasePrice: "", sellingPrice: "", stock: "", uom: "Pcs" },
        { id: "3", name: "", categoryId: null, purchasePrice: "", sellingPrice: "", stock: "", uom: "Pcs" },
    ]);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const batchInputsRef = useRef<Record<string, TextInput | null>>({});

    useFocusEffect(
        useCallback(() => {
            const cats = getAllCategories();
            const brnds = getAllBrands();
            const prods = getAllProducts();
            setCategories(cats);
            setBrands(brnds);

            // Auto-select the most used UOM from shop inventory
            if (prods.length > 0) {
                const uomCounts: Record<string, number> = {};
                prods.forEach((p) => {
                    if (p.uom) {
                        uomCounts[p.uom] = (uomCounts[p.uom] || 0) + 1;
                    }
                });
                let topUom = "Pcs";
                let maxCount = 0;
                Object.entries(uomCounts).forEach(([uom, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        topUom = uom;
                    }
                });
                setSelectedUom(topUom);
            }
        }, [])
    );

    // ─── Single Mode Logic ────────────────────────────────────────────────────
    const handleSaveSingle = (addAnother = false) => {
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
            const savedName = name.trim();
            insertProduct({
                name: savedName,
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

            if (addAnother) {
                setName("");
                setPurchasePrice("");
                setSellingPrice("");
                setInitialStock("");
                setSuccessBanner(`✓ "${savedName}" saved! Ready for next product.`);
                setTimeout(() => setSuccessBanner(null), 4000);
                nameInputRef.current?.focus();
            } else {
                navigation.goBack();
            }
        } catch (e) {
            showAlert("Error", "Could not save product. Please try again.", undefined, "error");
        } finally {
            setSaving(false);
        }
    };

    // ─── Dynamic Batch Mode Logic ─────────────────────────────────────────────
    const addBatchRow = (autoFocus = false) => {
        const newId = Date.now().toString();
        const newRow: BatchRow = {
            id: newId,
            name: "",
            categoryId: selectedCategoryId || null,
            brandId: selectedBrandId || null,
            purchasePrice: "",
            sellingPrice: "",
            stock: "",
            uom: selectedUom || "Pcs",
        };

        setBatchRows((prev) => [...prev, newRow]);

        if (autoFocus) {
            setTimeout(() => {
                batchInputsRef.current[newId]?.focus();
            }, 100);
        }
    };

    const duplicateBatchRow = (id: string) => {
        const rowToDup = batchRows.find((r) => r.id === id);
        if (!rowToDup) return;
        const newId = Date.now().toString();
        const newRow: BatchRow = {
            ...rowToDup,
            id: newId,
            name: `${rowToDup.name} (Copy)`,
        };
        const index = batchRows.findIndex((r) => r.id === id);
        const newRows = [...batchRows];
        newRows.splice(index + 1, 0, newRow);
        setBatchRows(newRows);
    };

    const removeBatchRow = (id: string) => {
        if (batchRows.length <= 1) {
            showAlert("Notice", "You need at least one row.", undefined, "warning");
            return;
        }
        setBatchRows((prev) => prev.filter((r) => r.id !== id));
    };

    const updateBatchRow = (id: string, field: keyof BatchRow, value: string | null) => {
        setBatchRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleImportPastedText = () => {
        if (!pasteText.trim()) {
            showAlert("Validation", "Paste or type product lines first.", undefined, "warning");
            return;
        }

        const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
        const newRows: BatchRow[] = [];

        lines.forEach((line, idx) => {
            const parts = line.split(/[,;\t]/).map((p) => p.trim());
            if (parts.length > 0 && parts[0]) {
                newRows.push({
                    id: (Date.now() + idx).toString(),
                    name: parts[0],
                    purchasePrice: parts[1] && !isNaN(Number(parts[1])) ? parts[1] : "",
                    sellingPrice: parts[2] && !isNaN(Number(parts[2])) ? parts[2] : (parts[1] && !isNaN(Number(parts[1])) ? parts[1] : ""),
                    stock: parts[3] && !isNaN(Number(parts[3])) ? parts[3] : "10",
                    categoryId: selectedCategoryId || null,
                    brandId: selectedBrandId || null,
                    uom: selectedUom || "Pcs",
                });
            }
        });

        if (newRows.length > 0) {
            setBatchRows((prev) => [...prev.filter((r) => r.name.trim().length > 0), ...newRows]);
            setPasteText("");
            setShowPasteModal(false);
            showAlert("Success", `Imported ${newRows.length} rows into express table!`, undefined, "success");
        } else {
            showAlert("Error", "Could not parse lines. Use format: Name, BuyPrice, SellPrice, Stock", undefined, "error");
        }
    };

    const handleSaveBatch = () => {
        const validRows = batchRows.filter(
            (r) => r.name.trim().length > 0 && r.sellingPrice && !isNaN(Number(r.sellingPrice))
        );

        if (validRows.length === 0) {
            showAlert(
                "Validation",
                "Please enter at least one product with a Name and Selling Price.",
                undefined,
                "warning"
            );
            return;
        }

        setSaving(true);
        try {
            const productsToInsert = validRows.map((r) => ({
                name: r.name.trim(),
                category_id: r.categoryId || selectedCategoryId,
                brand_id: r.brandId || selectedBrandId,
                purchase_price: parseFloat(r.purchasePrice) || 0,
                selling_price: parseFloat(r.sellingPrice) || 0,
                stock_quantity: parseInt(r.stock) || 0,
                min_stock_threshold: 5,
                uom: selectedUom || r.uom || "Pcs",
            }));

            insertProductsBatch(productsToInsert);
            showAlert({
                title: "Success",
                message: `Saved ${validRows.length} products to inventory!`,
                type: "success",
                buttons: [
                    { text: "OK", onPress: () => navigation.goBack() },
                ],
            });
        } catch (e) {
            showAlert("Error", "Could not save batch products.", undefined, "error");
        } finally {
            setSaving(false);
        }
    };

    const renderChipSelector = (
        title: string,
        items: { id: string; label: string }[],
        selectedId: string | null,
        onSelect: (id: string | null) => void
    ) => (
        <View style={styles.compactSection}>
            <Text style={styles.label}>{title}</Text>
            {items.length === 0 ? (
                <Text style={styles.noItemsText}>
                    None set
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

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Add New Products" showBack={true} />

            {/* Mode Switcher Tabs */}
            <View style={styles.segmentedContainer}>
                <TouchableOpacity
                    style={[styles.segmentedTab, mode === "single" && styles.segmentedTabActive]}
                    onPress={() => setMode("single")}
                >
                    <Ionicons
                        name="create-outline"
                        size={15}
                        color={mode === "single" ? colors.primary : "#64748b"}
                    />
                    <Text style={[styles.segmentedTabText, mode === "single" && styles.segmentedTabTextActive]}>
                        Single Product
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.segmentedTab, mode === "batch" && styles.segmentedTabActive]}
                    onPress={() => setMode("batch")}
                >
                    <Ionicons
                        name="grid-outline"
                        size={15}
                        color={mode === "batch" ? colors.primary : "#64748b"}
                    />
                    <Text style={[styles.segmentedTabText, mode === "batch" && styles.segmentedTabTextActive]}>
                        Multiple Products
                    </Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                {/* ─── MODE 1: SINGLE ADD ──────────────────────────────────────────────── */}
                {mode === "single" && (
                    <>
                        <ScrollView
                            style={styles.scroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {successBanner && (
                                <View style={styles.bannerContainer}>
                                    <Ionicons name="checkmark-circle" size={16} color="#166534" />
                                    <Text style={styles.bannerText}>{successBanner}</Text>
                                </View>
                            )}

                            {/* Card 1: Basic Information */}
                            <View style={styles.card}>
                                <Text style={styles.cardHeaderTitle}>BASIC INFORMATION</Text>

                                <View style={styles.section}>
                                    <Text style={styles.label}>Product Name *</Text>
                                    <TextInput
                                        ref={nameInputRef}
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
                                        <Text style={styles.label}>Initial Stock</Text>
                                        <View style={styles.inputWithIcon}>
                                            <Ionicons name="archive-outline" size={16} color="#64748b" />
                                            <TextInput
                                                style={styles.flexInput}
                                                placeholder="0"
                                                value={initialStock}
                                                onChangeText={setInitialStock}
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
                                            <Text style={styles.packToggleTitle}>Sells in packs / boxes?</Text>
                                            <Text style={styles.packToggleSubtitle}>
                                                Enable if bought in bulk (e.g. 1 Box = 12 Pcs)
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.toggleTrack, hasPackSize && styles.toggleTrackActive]}>
                                        <View style={[styles.toggleThumb, hasPackSize && styles.toggleThumbActive]} />
                                    </View>
                                </TouchableOpacity>

                                {hasPackSize && (
                                    <View style={[styles.twoColumnRow, { marginBottom: 0, marginTop: 8 }]}>
                                        <View style={styles.columnFlex}>
                                            <Text style={styles.label}>Bulk Unit Name</Text>
                                            <View style={styles.inputWithIcon}>
                                                <Ionicons name="pricetag-outline" size={16} color="#64748b" />
                                                <TextInput
                                                    style={styles.flexInput}
                                                    placeholder="Box/Bag"
                                                    value={purchaseUom}
                                                    onChangeText={setPurchaseUom}
                                                    placeholderTextColor="#9ca3af"
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.columnFlex}>
                                            <Text style={styles.label}>
                                                {purchaseUom.trim()
                                                    ? `${selectedUom}s / ${purchaseUom.trim()}`
                                                    : `${selectedUom}s / pack`}
                                            </Text>
                                            <View style={styles.inputWithIcon}>
                                                <Ionicons name="layers-outline" size={16} color="#64748b" />
                                                <TextInput
                                                    style={styles.flexInput}
                                                    placeholder="e.g. 12"
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

                            <View style={styles.singleFooterRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.saveNextButton,
                                        (!name.trim() || saving) && styles.saveNextButtonDisabled,
                                    ]}
                                    onPress={() => handleSaveSingle(true)}
                                    disabled={!name.trim() || saving}
                                >
                                    <Ionicons
                                        name="add-circle-outline"
                                        size={16}
                                        color={(!name.trim() || saving) ? "#94a3b8" : colors.primary}
                                    />
                                    <Text
                                        style={[
                                            styles.saveNextButtonText,
                                            (!name.trim() || saving) && styles.saveNextButtonTextDisabled,
                                        ]}
                                    >
                                        Save & Add Next
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        { flex: 1 },
                                        (!name.trim() || saving) && styles.saveButtonDisabled,
                                    ]}
                                    onPress={() => handleSaveSingle(false)}
                                    disabled={!name.trim() || saving}
                                >
                                    <Ionicons
                                        name="save"
                                        size={16}
                                        color={(!name.trim() || saving) ? "#94a3b8" : "#fff"}
                                    />
                                    <Text
                                        style={[
                                            styles.saveButtonText,
                                            (!name.trim() || saving) && styles.saveButtonTextDisabled,
                                        ]}
                                    >
                                        {saving ? "Saving..." : "Save Product"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </>
                )}

                {/* ─── MODE 2: DYNAMIC EXPRESS BATCH TABLE ─────────────────────────────── */}
                {mode === "batch" && (
                    <>
                        <ScrollView
                            style={styles.scroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Header info & Paste button */}
                            <View style={styles.batchToolHeader}>
                                <View style={styles.infoBox}>
                                    <Ionicons name="flash" size={16} color={colors.primary} />
                                    <Text style={styles.infoBoxText}>
                                        Type products fast. Press Next key on stock to auto-add row!
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.pasteListBtn}
                                    onPress={() => setShowPasteModal(true)}
                                >
                                    <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
                                    <Text style={styles.pasteListBtnText}>Paste Text List</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Common Batch Defaults Card (Applied to all rows) */}
                            <View style={styles.card}>
                                <Text style={styles.cardHeaderTitle}>
                                    COMMON DEFAULTS (APPLIED TO ALL PRODUCTS BELOW)
                                </Text>

                                <View style={styles.twoColumnRow}>
                                    {/* Category Selector */}
                                    <View style={styles.columnFlex}>
                                        <Text style={styles.label}>Category</Text>
                                        {categories.length === 0 ? (
                                            <Text style={styles.noItemsText}>No categories</Text>
                                        ) : (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                                                {categories.map((cat) => {
                                                    const isSel = selectedCategoryId === cat.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={cat.id}
                                                            style={[styles.miniChip, isSel && styles.miniChipActive]}
                                                            onPress={() => setSelectedCategoryId(isSel ? null : cat.id)}
                                                        >
                                                            <Text style={[styles.miniChipText, isSel && styles.miniChipTextActive]}>
                                                                {cat.name}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        )}
                                    </View>

                                    {/* Brand Selector */}
                                    <View style={styles.columnFlex}>
                                        <Text style={styles.label}>Brand</Text>
                                        {brands.length === 0 ? (
                                            <Text style={styles.noItemsText}>No brands</Text>
                                        ) : (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                                                {brands.map((br) => {
                                                    const isSel = selectedBrandId === br.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={br.id}
                                                            style={[styles.miniChip, isSel && styles.miniChipActive]}
                                                            onPress={() => setSelectedBrandId(isSel ? null : br.id)}
                                                        >
                                                            <Text style={[styles.miniChipText, isSel && styles.miniChipTextActive]}>
                                                                {br.name}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        )}
                                    </View>
                                </View>

                                {/* UOM Selector */}
                                <View style={{ marginTop: 6 }}>
                                    <Text style={styles.label}>Unit of Measurement (UOM) *</Text>
                                    <UomSelector selectedUom={selectedUom} onSelect={setSelectedUom} />
                                </View>
                            </View>

                            {/* Dynamic Batch Table Rows */}
                            {batchRows.map((row, idx) => {
                                const buyNum = parseFloat(row.purchasePrice);
                                const sellNum = parseFloat(row.sellingPrice);
                                const hasMargin = !isNaN(buyNum) && !isNaN(sellNum) && sellNum > buyNum;
                                const marginPct = hasMargin ? Math.round(((sellNum - buyNum) / sellNum) * 100) : 0;
                                const isLastRow = idx === batchRows.length - 1;

                                return (
                                    <View key={row.id} style={styles.batchCard}>
                                        <View style={styles.batchCardHeader}>
                                            <Text style={styles.batchCardIndex}>Row #{idx + 1}</Text>

                                            {hasMargin && (
                                                <View style={styles.marginBadge}>
                                                    <Ionicons name="trending-up" size={11} color="#166534" />
                                                    <Text style={styles.marginBadgeText}>
                                                        +₹{(sellNum - buyNum).toFixed(0)} ({marginPct}%)
                                                    </Text>
                                                </View>
                                            )}

                                            <View style={{ flexDirection: "row", gap: 10 }}>
                                                <TouchableOpacity onPress={() => duplicateBatchRow(row.id)}>
                                                    <Ionicons name="copy-outline" size={16} color={colors.primary} />
                                                </TouchableOpacity>
                                                {batchRows.length > 1 && (
                                                    <TouchableOpacity onPress={() => removeBatchRow(row.id)}>
                                                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>

                                        <TextInput
                                            ref={(el) => {
                                                batchInputsRef.current[row.id] = el;
                                            }}
                                            style={styles.batchInputName}
                                            placeholder="Product Name *"
                                            value={row.name}
                                            onChangeText={(v) => updateBatchRow(row.id, "name", v)}
                                            placeholderTextColor="#9ca3af"
                                        />

                                         <View style={styles.batchRowInputs}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.miniLabel}>Buy ₹</Text>
                                                <TextInput
                                                    style={styles.batchMiniInput}
                                                    placeholder="0.00"
                                                    value={row.purchasePrice}
                                                    onChangeText={(v) => updateBatchRow(row.id, "purchasePrice", v)}
                                                    keyboardType="numeric"
                                                    placeholderTextColor="#9ca3af"
                                                />
                                            </View>

                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.miniLabel}>Sell ₹ *</Text>
                                                <TextInput
                                                    style={[styles.batchMiniInput, styles.batchMiniInputActive]}
                                                    placeholder="0.00"
                                                    value={row.sellingPrice}
                                                    onChangeText={(v) => updateBatchRow(row.id, "sellingPrice", v)}
                                                    keyboardType="numeric"
                                                    placeholderTextColor="#9ca3af"
                                                />
                                            </View>

                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.miniLabel}>Stock</Text>
                                                <TextInput
                                                    style={styles.batchMiniInput}
                                                    placeholder="0"
                                                    value={row.stock}
                                                    onChangeText={(v) => updateBatchRow(row.id, "stock", v)}
                                                    keyboardType="numeric"
                                                    returnKeyType={isLastRow ? "next" : "done"}
                                                    onSubmitEditing={() => {
                                                        if (isLastRow && row.name.trim()) {
                                                            addBatchRow(true);
                                                        }
                                                    }}
                                                    placeholderTextColor="#9ca3af"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}

                            <TouchableOpacity style={styles.addBatchRowBtn} onPress={() => addBatchRow(true)}>
                                <Ionicons name="add" size={16} color={colors.primary} />
                                <Text style={styles.addBatchRowBtnText}>+ Add Another Row</Text>
                            </TouchableOpacity>

                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        (saving || batchRows.filter((r) => r.name.trim()).length === 0) &&
                                            styles.saveButtonDisabled,
                                    ]}
                                    onPress={handleSaveBatch}
                                    disabled={saving || batchRows.filter((r) => r.name.trim()).length === 0}
                                >
                                    <Ionicons
                                        name="checkmark-done"
                                        size={16}
                                        color={
                                            saving || batchRows.filter((r) => r.name.trim()).length === 0
                                                ? "#94a3b8"
                                                : "#fff"
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.saveButtonText,
                                            (saving || batchRows.filter((r) => r.name.trim()).length === 0) &&
                                                styles.saveButtonTextDisabled,
                                        ]}
                                    >
                                        {saving
                                            ? "Saving..."
                                            : `Save All (${batchRows.filter((r) => r.name.trim()).length}) Products`}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </>
                )}
            </KeyboardAvoidingView>

            {/* ─── PASTE TEXT LIST MODAL ───────────────────────────────────────────── */}
            <Modal
                visible={showPasteModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPasteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📋 Paste Product List</Text>
                            <TouchableOpacity onPress={() => setShowPasteModal(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            Paste or type items line by line. Format per line:{"\n"}
                            <Text style={{ fontWeight: "700" }}>Name, BuyPrice, SellPrice, Stock</Text>
                        </Text>

                        <TextInput
                            style={styles.modalTextArea}
                            multiline
                            placeholder={`e.g.\nTata Salt, 20, 25, 10\nRice 5kg, 200, 240, 5\nOil 1L, 130, 150, 12`}
                            value={pasteText}
                            onChangeText={setPasteText}
                            placeholderTextColor="#9ca3af"
                        />
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowPasteModal(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalImportBtn}
                                onPress={handleImportPastedText}
                            >
                                <Ionicons name="download-outline" size={15} color="#fff" />
                                <Text style={styles.modalImportBtnText}>Parse & Fill Table</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f1f5f9" },
    segmentedContainer: {
        flexDirection: "row",
        backgroundColor: "#cbd5e1",
        padding: 2,
        marginHorizontal: spacing.xs,
        marginTop: 4,
        marginBottom: 6,
        borderRadius: 8,
    },
    segmentedTab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        borderRadius: 6,
        gap: 5,
    },
    segmentedTabActive: {
        backgroundColor: "#ffffff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    segmentedTabText: { fontSize: 12, fontWeight: "600", color: "#475569" },
    segmentedTabTextActive: { color: colors.primary, fontWeight: "700" },
    scroll: { paddingHorizontal: spacing.xs, paddingTop: 2, paddingBottom: 12 },
    bannerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#dcfce7",
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
        gap: 6,
    },
    bannerText: { color: "#166534", fontSize: 12, fontWeight: "600", flex: 1 },
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
    compactSection: { marginBottom: 4 },
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
    footer: {
        marginTop: 4,
        marginBottom: 16,
    },
    singleFooterRow: {
        marginTop: 4,
        marginBottom: 16,
        flexDirection: "row",
        gap: 8,
    },
    saveNextButton: {
        backgroundColor: "#eff6ff",
        borderColor: colors.primary,
        borderWidth: 1.5,
        paddingHorizontal: 12,
        height: 42,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },
    saveNextButtonDisabled: {
        backgroundColor: "#f1f5f9",
        borderColor: "#cbd5e1",
    },
    saveNextButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    saveNextButtonTextDisabled: { color: "#94a3b8" },
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
    saveButtonTextDisabled: { color: "#94a3b8" },
    packToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
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
    batchToolHeader: {
        marginBottom: 8,
    },
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#eff6ff",
        padding: 6,
        borderRadius: 6,
        marginBottom: 4,
        gap: 5,
    },
    infoBoxText: { fontSize: 10, color: colors.primary, flex: 1, fontWeight: "500" },
    pasteListBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#eff6ff",
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 6,
        paddingVertical: 5,
        paddingHorizontal: 8,
        alignSelf: "flex-start",
        gap: 4,
    },
    pasteListBtnText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
    miniChip: {
        backgroundColor: "#f1f5f9",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    miniChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    miniChipText: { fontSize: 10, fontWeight: "600", color: "#475569" },
    miniChipTextActive: { color: "#fff" },
    batchCard: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    batchCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    batchCardIndex: { fontSize: 10, fontWeight: "700", color: "#64748b" },
    marginBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#dcfce7",
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        gap: 2,
    },
    marginBadgeText: { fontSize: 9, fontWeight: "700", color: "#166534" },
    batchInputName: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 0,
        height: 40,
        fontSize: 13,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 6,
    },
    batchRowInputs: { flexDirection: "row", gap: 5 },
    miniLabel: { fontSize: 9, fontWeight: "600", color: "#64748b", marginBottom: 2 },
    batchMiniInput: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 0,
        height: 38,
        fontSize: 13,
        color: colors.text,
    },
    batchMiniInputActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
    addBatchRowBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderStyle: "dashed",
        borderRadius: 8,
        marginTop: 2,
        marginBottom: 16,
        gap: 4,
    },
    addBatchRowBtnText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.md,
    },
    modalContent: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    modalTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    modalSubtitle: { fontSize: 11, color: "#64748b", marginBottom: 8, lineHeight: 15 },
    modalTextArea: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        padding: 8,
        height: 110,
        fontSize: 12,
        color: colors.text,
        textAlignVertical: "top",
        marginBottom: 10,
    },
    modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 6 },
    modalCancelBtn: {
        borderRadius: 8,
        backgroundColor: "#f1f5f9",
    },
    modalCancelBtnText: { color: "#64748b", fontWeight: "600", fontSize: 13 },
    modalImportBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.primary,
        gap: 6,
    },
    modalImportBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

