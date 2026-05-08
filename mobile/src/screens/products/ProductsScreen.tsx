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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import ScreenHeader from "../../components/common/ScreenHeader";
import FAB from "../../components/common/FAB";
import {
    getAllProducts,
    getAllCategories,
    deleteProduct,
    updateProductStock,
    updateProduct,
    Product,
    Category,
} from "../../db/db";

export default function ProductsScreen() {
    const navigation = useNavigation<any>();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
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

    const handleBulkStockUpdate = (qty: number, mode: "add" | "reduce", isPackMode: boolean) => {
        selectedItems.forEach((id) => {
            const product = products.find((p) => p.id === id);
            if (!product) return;
            const baseQty = isPackMode && product.units_per_pack
                ? qty * product.units_per_pack
                : qty;
            const newQty =
                mode === "add"
                    ? product.stock_quantity + baseQty
                    : Math.max(0, product.stock_quantity - baseQty);
            updateProductStock(id, newQty);
        });
        setIsUpdateStockVisible(false);
        setSelectedItems([]);
        setProducts(getAllProducts());
        Alert.alert("Success", `Stock updated for ${selectedItems.length} item(s).`);
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
        Alert.alert("Success", `Category updated to "${categoryName}" for ${selectedItems.length} item(s).`);
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Products",
            `Delete ${selectedItems.length} selected product(s)?`,
            [
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
            ]
        );
    };

    const handleDirectDelete = (product: Product) => {
        Alert.alert(
            "Delete Product",
            `Delete "${product.name}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        deleteProduct(product.id);
                        setProducts(getAllProducts());
                    },
                },
            ]
        );
    };

    const categoryChips = ["All", ...categories.map((c) => c.name)];
    const categoryNames = categories.map((c) => c.name);

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Inventory" isMainTab={false} onNotificationPress={() => {}} />

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
                    contentContainerStyle={styles.categoryScroll}
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
                        onDelete={() => handleDirectDelete(item)}
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
                    onPress={() => navigation.navigate("AddProduct")}
                    offsetTabBar={true}
                />
            )}

            <UpdateStockModal
                isVisible={isUpdateStockVisible}
                onClose={() => setIsUpdateStockVisible(false)}
                selectedProducts={products.filter((p) => selectedItems.includes(p.id))}
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
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        height: 48,
        marginBottom: spacing.md,
    },
    searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: 16, color: colors.text },
    categoryContainer: { marginBottom: spacing.md },
    categoryScroll: { paddingHorizontal: spacing.md, gap: 8 },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeCategoryChip: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    activeCategoryText: { color: "#fff" },
    statusRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    statusLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },
    listContent: { paddingBottom: spacing.tabBarOffset },
    emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 64 },
    emptyText: { marginTop: spacing.md, fontSize: typography.sizes.md, color: colors.textSecondary, textAlign: "center" },
    selectionOverlay: {
        position: "absolute",
        bottom: spacing.tabBarOffset + spacing.md,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: "#111827",
        borderRadius: 16,
        padding: spacing.md,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    selectionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    selectionBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    selectionBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    selectionText: { color: "#fff", fontWeight: "600" },
    selectionActions: { flexDirection: "row", alignItems: "center", gap: 16 },
    selectionAction: { alignItems: "center", gap: 4 },
    selectionActionText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
