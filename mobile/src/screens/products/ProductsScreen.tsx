import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ProductCard from "../../components/products/ProductCard";
import UpdateStockModal from "../../components/products/UpdateStockModal";
import UpdateCategoryModal from "../../components/products/UpdateCategoryModal";
import ScreenHeader from "../../components/common/ScreenHeader";
import FAB from "../../components/common/FAB";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAlert } from "../../context/AlertContext";
import { haptics } from "../../utils/haptics";
import {
    getAllProducts,
    getAllCategories,
    deleteProduct,
    updateProductStock,
    updateProduct,
    insertProduct,
    insertPurchaseLog,
    Product,
    Category,
} from "../../db/db";

export default function ProductsScreen() {
    const navigation = useNavigation<any>();
    const { showAlert } = useAlert();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [singleStockProduct, setSingleStockProduct] = useState<Product | null>(null);
    const [isUpdateStockVisible, setIsUpdateStockVisible] = useState(false);
    const [isUpdateCategoryVisible, setIsUpdateCategoryVisible] = useState(false);

    const loadData = useCallback(() => {
        setProducts(getAllProducts());
        setCategories(getAllCategories());
    }, []);

    useFocusEffect(loadData);

    const filteredProducts = products.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.category_name ?? "").toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
            selectedCategory === "All" || p.category_name === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const toggleSelection = (id: string) => {
        setSelectedItems((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const handleBulkStockUpdate = (
        qty: number,
        mode: "add" | "reduce",
        isPackMode: boolean,
        purchasePrice?: number,
        sellingPrice?: number,
        strategy?: "average" | "batch" | "replace",
        batchName?: string
    ) => {
        const targetProducts = singleStockProduct
            ? [singleStockProduct]
            : products.filter((p) => selectedItems.includes(p.id));

        if (targetProducts.length === 1 && mode === "add") {
            const product = targetProducts[0];
            const id = product.id;

            const baseQty = isPackMode && product.units_per_pack
                ? qty * product.units_per_pack
                : qty;

            const newCost = purchasePrice ?? product.purchase_price;
            const newSelling = sellingPrice ?? product.selling_price;

            if (strategy === "batch" && batchName) {
                // Option B: Create a new batch as a separate product listing
                const newProductId = insertProduct({
                    name: batchName,
                    category_id: product.category_id,
                    brand_id: product.brand_id,
                    purchase_price: newCost,
                    selling_price: newSelling,
                    stock_quantity: baseQty,
                    min_stock_threshold: product.min_stock_threshold,
                    uom: product.uom,
                    purchase_uom: product.purchase_uom,
                    units_per_pack: product.units_per_pack,
                });
                insertPurchaseLog(newProductId, batchName, baseQty, newCost, newSelling);
                showAlert("Success", `Created new batch "${batchName}" with ${qty} ${isPackMode && product.purchase_uom ? product.purchase_uom : product.uom} stock.`, undefined, "success");
            } else if (strategy === "average") {
                // Option A: Mix & Average costing
                const oldStock = product.stock_quantity;
                const oldCost = product.purchase_price;
                const totalStock = oldStock + baseQty;

                const weightedAvgCost = totalStock > 0
                    ? ((oldStock * oldCost) + (baseQty * newCost)) / totalStock
                    : newCost;

                updateProduct(id, {
                    stock_quantity: totalStock,
                    purchase_price: parseFloat(weightedAvgCost.toFixed(2)),
                    selling_price: newSelling,
                });
                insertPurchaseLog(id, product.name, baseQty, newCost, newSelling);
                showAlert("Success", `Stock updated to ${totalStock} ${product.uom}. Cost averaged to ₹${weightedAvgCost.toFixed(2)}.`, undefined, "success");
            } else {
                // Option C: Replacement Cost (or fallback default)
                const totalStock = product.stock_quantity + baseQty;
                updateProduct(id, {
                    stock_quantity: totalStock,
                    purchase_price: newCost,
                    selling_price: newSelling,
                });
                insertPurchaseLog(id, product.name, baseQty, newCost, newSelling);
                showAlert("Success", `Stock updated to ${totalStock} ${product.uom}. Price snapped to new cost of ₹${newCost.toFixed(2)}.`, undefined, "success");
            }
        } else {
            // Bulk updates (Multi-product or reduce stock mode)
            targetProducts.forEach((product) => {
                const id = product.id;
                const baseQty = isPackMode && product.units_per_pack
                    ? qty * product.units_per_pack
                    : qty;
                const newQty =
                    mode === "add"
                        ? product.stock_quantity + baseQty
                        : Math.max(0, product.stock_quantity - baseQty);
                updateProductStock(id, newQty);
            });
            showAlert("Success", `Stock updated for ${targetProducts.length} item(s).`, undefined, "success");
        }

        setIsUpdateStockVisible(false);
        setSingleStockProduct(null);
        setSelectedItems([]);
        setProducts(getAllProducts());
    };

    const handleBulkCategoryUpdate = (categoryName: string) => {
        const category = categories.find((c) => c.name === categoryName);
        if (!category) return;
        selectedItems.forEach((id) => {
            updateProduct(id, { category_id: category.id });
        });
        setIsUpdateCategoryVisible(false);
        setSelectedItems([]);
        setProducts(getAllProducts());
        showAlert("Success", `Category updated to "${categoryName}" for ${selectedItems.length} item(s).`, undefined, "success");
    };

    const handleDelete = () => {
        showAlert({
            title: "Delete Products",
            message: `Delete ${selectedItems.length} selected product(s)?`,
            type: "error",
            buttons: [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        selectedItems.forEach((id) => deleteProduct(id));
                        setSelectedItems([]);
                        setProducts(getAllProducts());
                    },
                },
            ],
        });
    };

    const handleDirectDelete = (product: Product) => {
        showAlert({
            title: "Delete Product",
            message: `Delete "${product.name}"? This cannot be undone.`,
            type: "error",
            buttons: [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        deleteProduct(product.id);
                        setProducts(getAllProducts());
                    },
                },
            ],
        });
    };

    const categoryChips = ["All", ...categories.map((c) => c.name)];
    const categoryNames = categories.map((c) => c.name);

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader
                title="Inventory"
                isMainTab={false}
                rightElement={
                    <View style={styles.headerButtonsRow}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.navigate("ManageCategories")}
                        >
                            <Ionicons name="folder-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.navigate("ManageBrands")}
                        >
                            <Ionicons name="pricetag-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.navigate("Notifications")}
                        >
                            <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
                            <View style={styles.notificationDot} />
                        </TouchableOpacity>
                    </View>
                }
            />

            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search products or categories..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={colors.textSecondary}
                />
            </View>

            <View style={styles.categoryContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryScroll} keyboardShouldPersistTaps="handled"
                >
                    {categoryChips.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryChip,
                                selectedCategory === cat && styles.activeCategoryChip,
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text
                                style={[
                                    styles.categoryText,
                                    selectedCategory === cat && styles.activeCategoryText,
                                ]}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>
                    INVENTORY STATUS ({filteredProducts.length})
                </Text>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <ProductCard
                        name={item.name}
                        category={item.category_name ?? "—"}
                        stock={item.stock_quantity}
                        threshold={item.min_stock_threshold}
                        unit={item.uom}
                        price={item.selling_price}
                        selected={selectedItems.includes(item.id)}
                        onPress={() => toggleSelection(item.id)}
                        onEdit={() => navigation.navigate("EditProduct", { product: item })}
                        onUpdateStock={() => {
                            haptics.selection();
                            setSingleStockProduct(item);
                            setIsUpdateStockVisible(true);
                        }}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cube-outline" size={64} color={colors.border} />
                        <Text style={styles.emptyText}>
                            {products.length === 0
                                ? "No products yet. Tap + to add one."
                                : "No products match your search."}
                        </Text>
                    </View>
                }
            />

            {/* Selection Overlay */}
            {selectedItems.length > 0 && (
                <View style={styles.selectionOverlay}>
                    <View style={styles.selectionLeft}>
                        <View style={styles.selectionBadge}>
                            <Text style={styles.selectionBadgeText}>{selectedItems.length}</Text>
                        </View>
                        <Text style={styles.selectionText}>Selected</Text>
                    </View>
                    <View style={styles.selectionActions}>
                        <TouchableOpacity
                            style={styles.selectionAction}
                            onPress={() => setIsUpdateStockVisible(true)}
                        >
                            <Ionicons name="create-outline" size={20} color="#fff" />
                            <Text style={styles.selectionActionText}>STOCK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.selectionAction}
                            onPress={() => setIsUpdateCategoryVisible(true)}
                        >
                            <Ionicons name="apps-outline" size={20} color="#fff" />
                            <Text style={styles.selectionActionText}>CATEGORY</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.selectionAction} onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={20} color="#fff" />
                            <Text style={styles.selectionActionText}>DELETE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSelectedItems([])}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* FAB */}
            {!selectedItems.length && (
                <FAB
                    onPress={() => {
                        haptics.medium();
                        navigation.navigate("AddProduct");
                    }}
                    offsetTabBar={true}
                />
            )}

            <UpdateStockModal
                isVisible={isUpdateStockVisible}
                onClose={() => {
                    setIsUpdateStockVisible(false);
                    setSingleStockProduct(null);
                }}
                selectedProducts={singleStockProduct ? [singleStockProduct] : products.filter((p) => selectedItems.includes(p.id))}
                onUpdate={handleBulkStockUpdate}
            />

            <UpdateCategoryModal
                isVisible={isUpdateCategoryVisible}
                onClose={() => setIsUpdateCategoryVisible(false)}
                selectedCount={selectedItems.length}
                categories={categoryNames}
                onUpdate={handleBulkCategoryUpdate}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
        marginHorizontal: spacing.md,
        paddingHorizontal: 10,
        borderRadius: 10,
        height: 40,
        marginTop: 6,
        marginBottom: 8,
    },
    searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: colors.text },
    categoryContainer: { marginBottom: 6 },
    categoryScroll: { paddingHorizontal: spacing.md, gap: 6 },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeCategoryChip: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    activeCategoryText: { color: "#fff" },
    statusRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        marginBottom: 4,
    },
    statusLabel: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },
    listContent: { paddingBottom: spacing.tabBarOffset },
    emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 48 },
    emptyText: { marginTop: spacing.md, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    selectionOverlay: {
        position: "absolute",
        bottom: spacing.tabBarOffset + 8,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: "#111827",
        borderRadius: 12,
        padding: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    selectionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    selectionBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    selectionBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    selectionText: { color: "#fff", fontWeight: "600", fontSize: 13 },
    selectionActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    selectionAction: { alignItems: "center", gap: 2 },
    selectionActionText: { color: "#fff", fontSize: 8, fontWeight: "700" },
    headerButtonsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    headerButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
    },
    notificationDot: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: colors.error,
        borderWidth: 1.5,
        borderColor: "#fff",
    },
});
