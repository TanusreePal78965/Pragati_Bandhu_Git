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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import ScreenHeader from "../../components/common/ScreenHeader";
import {
    getAllCategories,
    getAllBrands,
    insertProduct,
    insertProductsBatch,
    Category,
    Brand,
} from "../../db/db";
import UomSelector from "../../components/products/UomSelector";

type Mode = "single" | "batch";

interface BatchRow {
    id: string;
    name: string;
    categoryId: string | null;
    purchasePrice: string;
    sellingPrice: string;
    stock: string;
    uom: string;
}

export default function AddProductScreen() {
    const navigation = useNavigation();
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
            setCategories(cats);
            setBrands(brnds);
            if (cats.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(cats[0].id);
            }
        }, [])
    );

    // ─── Single Mode Logic ────────────────────────────────────────────────────
    const handleSaveSingle = (addAnother = false) => {
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
            Alert.alert("Error", "Could not save product. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // ─── Dynamic Batch Mode Logic ─────────────────────────────────────────────
    const addBatchRow = (autoFocus = false) => {
        const newId = Date.now().toString();
        const defaultCat = categories.length > 0 ? categories[0].id : null;
        const newRow: BatchRow = {
            id: newId,
            name: "",
            categoryId: selectedCategoryId || defaultCat,
            purchasePrice: "",
            sellingPrice: "",
            stock: "",
            uom: "Pcs",
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
            Alert.alert("Notice", "You need at least one row.");
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
            Alert.alert("Validation", "Paste or type product lines first.");
            return;
        }

        const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
        const defaultCat = categories.length > 0 ? categories[0].id : null;
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
                    categoryId: selectedCategoryId || defaultCat,
                    uom: "Pcs",
                });
            }
        });

        if (newRows.length > 0) {
            setBatchRows((prev) => [...prev.filter((r) => r.name.trim().length > 0), ...newRows]);
            setPasteText("");
            setShowPasteModal(false);
            Alert.alert("Success", `Imported ${newRows.length} rows into express table!`);
        } else {
            Alert.alert("Error", "Could not parse lines. Use format: Name, BuyPrice, SellPrice, Stock");
        }
    };

    const handleSaveBatch = () => {
        const validRows = batchRows.filter(
            (r) => r.name.trim().length > 0 && r.sellingPrice && !isNaN(Number(r.sellingPrice))
        );

        if (validRows.length === 0) {
            Alert.alert(
                "Validation",
                "Please enter at least one product with a Name and Selling Price."
            );
            return;
        }

        setSaving(true);
        try {
            const productsToInsert = validRows.map((r) => ({
                name: r.name.trim(),
                category_id: r.categoryId || selectedCategoryId,
                brand_id: selectedBrandId,
                purchase_price: parseFloat(r.purchasePrice) || 0,
                selling_price: parseFloat(r.sellingPrice) || 0,
                stock_quantity: parseInt(r.stock) || 0,
                min_stock_threshold: 5,
                uom: r.uom || "Pcs",
            }));

            insertProductsBatch(productsToInsert);
            Alert.alert("Success", `Saved ${validRows.length} products to inventory!`, [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert("Error", "Could not save batch products.");
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
            <View style={styles.modeTabsContainer}>
                <TouchableOpacity
                    style={[styles.modeTab, mode === "single" && styles.modeTabActive]}
                    onPress={() => setMode("single")}
                >
                    <Ionicons
                        name="create-outline"
                        size={18}
                        color={mode === "single" ? colors.primary : "#6b7280"}
                    />
                    <Text style={[styles.modeTabText, mode === "single" && styles.modeTabTextActive]}>
                        Single Form
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.modeTab, mode === "batch" && styles.modeTabActive]}
                    onPress={() => setMode("batch")}
                >
                    <Ionicons
                        name="grid-outline"
                        size={18}
                        color={mode === "batch" ? colors.primary : "#6b7280"}
                    />
                    <Text style={[styles.modeTabText, mode === "batch" && styles.modeTabTextActive]}>
                        Express Table (Multi-Add)
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
                                    <Ionicons name="checkmark-circle" size={20} color="#166534" />
                                    <Text style={styles.bannerText}>{successBanner}</Text>
                                </View>
                            )}

                            <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>

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
                                <Text style={styles.helperText}>Quantity available in store</Text>
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
                                <Text style={styles.helperText}>Alert when stock falls below this</Text>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.label}>Unit of Measurement (UOM) *</Text>
                                <UomSelector selectedUom={selectedUom} onSelect={setSelectedUom} />
                            </View>

                            <View style={styles.separator} />

                            <Text style={styles.sectionTitle}>BULK / PACK SIZE (OPTIONAL)</Text>

                            <TouchableOpacity
                                style={styles.packToggleRow}
                                onPress={() => setHasPackSize((v) => !v)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.packToggleLeft}>
                                    <Ionicons name="cube-outline" size={20} color={colors.primary} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.packToggleTitle}>Sells in packs / boxes?</Text>
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
                                                placeholder="e.g. Box, Bag, Dozen"
                                                value={purchaseUom}
                                                onChangeText={setPurchaseUom}
                                                placeholderTextColor="#9ca3af"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.section}>
                                        <Text style={styles.label}>
                                            {purchaseUom.trim()
                                                ? `${selectedUom}s per ${purchaseUom.trim()}`
                                                : `${selectedUom}s per pack`}
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
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        <View style={styles.singleFooterRow}>
                            <TouchableOpacity
                                style={[
                                    styles.saveNextButton,
                                    (!name.trim() || saving) && styles.saveButtonDisabled,
                                ]}
                                onPress={() => handleSaveSingle(true)}
                                disabled={!name.trim() || saving}
                            >
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                                <Text style={styles.saveNextButtonText}>Save & Add Next</Text>
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
                                <Ionicons name="save" size={20} color="#fff" />
                                <Text style={styles.saveButtonText}>
                                    {saving ? "Saving..." : "Save Product"}
                                </Text>
                            </TouchableOpacity>
                        </View>
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
                                    <Ionicons name="flash" size={18} color={colors.primary} />
                                    <Text style={styles.infoBoxText}>
                                        Type products fast. Press Next key on stock to auto-add new row!
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.pasteListBtn}
                                    onPress={() => setShowPasteModal(true)}
                                >
                                    <Ionicons name="clipboard-outline" size={16} color={colors.primary} />
                                    <Text style={styles.pasteListBtnText}>Paste Text List</Text>
                                </TouchableOpacity>
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
                                                    <Ionicons name="trending-up" size={12} color="#166534" />
                                                    <Text style={styles.marginBadgeText}>
                                                        +₹{(sellNum - buyNum).toFixed(0)} ({marginPct}%)
                                                    </Text>
                                                </View>
                                            )}

                                            <View style={{ flexDirection: "row", gap: 12 }}>
                                                <TouchableOpacity onPress={() => duplicateBatchRow(row.id)}>
                                                    <Ionicons name="copy-outline" size={18} color={colors.primary} />
                                                </TouchableOpacity>
                                                {batchRows.length > 1 && (
                                                    <TouchableOpacity onPress={() => removeBatchRow(row.id)}>
                                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
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

                                        {/* Inline Category Chip Selector per Row */}
                                        {categories.length > 0 && (
                                            <View style={{ marginBottom: 10 }}>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                                    {categories.map((cat) => {
                                                        const isCatSelected = row.categoryId === cat.id;
                                                        return (
                                                            <TouchableOpacity
                                                                key={cat.id}
                                                                style={[
                                                                    styles.miniChip,
                                                                    isCatSelected && styles.miniChipActive,
                                                                ]}
                                                                onPress={() =>
                                                                    updateBatchRow(
                                                                        row.id,
                                                                        "categoryId",
                                                                        isCatSelected ? null : cat.id
                                                                    )
                                                                }
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.miniChipText,
                                                                        isCatSelected && styles.miniChipTextActive,
                                                                    ]}
                                                                >
                                                                    {cat.name}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                            </View>
                                        )}

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
                                <Ionicons name="add" size={20} color={colors.primary} />
                                <Text style={styles.addBatchRowBtnText}>+ Add Another Row</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                                onPress={handleSaveBatch}
                                disabled={saving}
                            >
                                <Ionicons name="checkmark-done" size={20} color="#fff" />
                                <Text style={styles.saveButtonText}>
                                    {saving
                                        ? "Saving..."
                                        : `Save All (${batchRows.filter((r) => r.name.trim()).length}) Products`}
                                </Text>
                            </TouchableOpacity>
                        </View>
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
                                <Ionicons name="close" size={22} color="#6b7280" />
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
                                <Ionicons name="download-outline" size={18} color="#fff" />
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
    container: { flex: 1, backgroundColor: colors.surface },
    modeTabsContainer: {
        flexDirection: "row",
        backgroundColor: "#f1f5f9",
        padding: 4,
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
        borderRadius: 12,
    },
    modeTab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    modeTabActive: {
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    modeTabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
    modeTabTextActive: { color: colors.primary },
    scroll: { padding: spacing.md },
    bannerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#dcfce7",
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
        gap: 8,
    },
    bannerText: { color: "#166534", fontSize: 14, fontWeight: "600", flex: 1 },
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
    chip: { backgroundColor: "#e5e7eb", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    activeChip: { backgroundColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: "500", color: colors.text },
    activeChipText: { color: "#fff" },
    separator: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },
    footer: {
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    singleFooterRow: {
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
        flexDirection: "row",
        gap: 10,
    },
    saveNextButton: {
        backgroundColor: "#eff6ff",
        borderColor: colors.primary,
        borderWidth: 1.5,
        paddingHorizontal: 14,
        height: 52,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    saveNextButtonText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    saveButton: {
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    saveButtonDisabled: { backgroundColor: colors.tabInactive },
    saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
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
    batchToolHeader: {
        marginBottom: 12,
    },
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#eff6ff",
        padding: 10,
        borderRadius: 10,
        marginBottom: 8,
        gap: 8,
    },
    infoBoxText: { fontSize: 12, color: colors.primary, flex: 1, fontWeight: "500" },
    pasteListBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#eff6ff",
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignSelf: "flex-start",
        gap: 6,
    },
    pasteListBtnText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    miniChip: {
        backgroundColor: "#f1f5f9",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    miniChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    miniChipText: { fontSize: 11, fontWeight: "600", color: "#475569" },
    miniChipTextActive: { color: "#fff" },
    batchCard: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    batchCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    batchCardIndex: { fontSize: 12, fontWeight: "700", color: "#64748b" },
    marginBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#dcfce7",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    marginBadgeText: { fontSize: 11, fontWeight: "700", color: "#166534" },
    batchInputName: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 42,
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
    },
    batchRowInputs: { flexDirection: "row", gap: 8 },
    miniLabel: { fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4 },
    batchMiniInput: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        fontSize: 14,
        color: colors.text,
    },
    batchMiniInputActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
    addBatchRowBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderStyle: "dashed",
        borderRadius: 12,
        marginTop: 4,
        marginBottom: 40,
        gap: 6,
    },
    addBatchRowBtnText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
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
        borderRadius: 16,
        padding: 16,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    modalSubtitle: { fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 18 },
    modalTextArea: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        padding: 12,
        height: 140,
        fontSize: 14,
        color: colors.text,
        textAlignVertical: "top",
        marginBottom: 16,
    },
    modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    modalCancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#f1f5f9",
    },
    modalCancelBtnText: { color: "#64748b", fontWeight: "600", fontSize: 14 },
    modalImportBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.primary,
        gap: 6,
    },
    modalImportBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
