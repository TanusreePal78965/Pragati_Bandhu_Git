import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ProductCard from "../../components/products/ProductCard";
import UpdateStockModal from "../../components/products/UpdateStockModal";
import UpdateCategoryModal from "../../components/products/UpdateCategoryModal";
import { useNavigation } from "@react-navigation/native";

const INITIAL_PRODUCTS = [
    {
        id: "1",
        name: "Aashirvaad Atta",
        category: "Grocery",
        stock: 24,
        threshold: 5,
        unit: "Units",
        price: 450,
    },
    {
        id: "2",
        name: "Dove Soap",
        category: "Personal Care",
        stock: 4,
        threshold: 5,
        unit: "Units",
        price: 120,
    },
    {
        id: "3",
        name: "Amul Milk 1L",
        category: "Dairy",
        stock: 48,
        threshold: 10,
        unit: "Units",
        price: 64,
    },
    {
        id: "4",
        name: "Lizol Floor",
        category: "Household",
        stock: 0,
        threshold: 5,
        unit: "Units",
        price: 199,
    },
    {
        id: "5",
        name: "Brown Bread",
        category: "Bakery",
        stock: 15,
        threshold: 5,
        unit: "Units",
        price: 45,
    },
    {
        id: "6",
        name: "Nescafé Classic",
        category: "Beverages",
        stock: 32,
        threshold: 5,
        unit: "Units",
        price: 210,
    },
    {
        id: "7",
        name: "Surf Excel 1kg",
        category: "Household",
        stock: 8,
        threshold: 10,
        unit: "Units",
        price: 175,
    },
    {
        id: "8",
        name: "Eggs (6 Pack)",
        category: "Dairy",
        stock: 12,
        threshold: 5,
        unit: "Units",
        price: 42,
    },
];

const CATEGORIES = ["All", "Grocery", "Personal Care", "Dairy", "Household", "Bakery", "Beverages"];

export default function ProductsScreen() {
    const navigation = useNavigation<any>();
    const [products, setProducts] = useState(INITIAL_PRODUCTS);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isUpdateStockVisible, setIsUpdateStockVisible] = useState(false);
    const [isUpdateCategoryVisible, setIsUpdateCategoryVisible] = useState(false);

    const filteredProducts = products.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                             p.category.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const toggleSelection = (id: string) => {
        setSelectedItems(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkStockUpdate = (qty: number, mode: "add" | "reduce") => {
        setProducts(prev => prev.map(p => {
            if (selectedItems.includes(p.id)) {
                const newStock = mode === "add" ? p.stock + qty : Math.max(0, p.stock - qty);
                return { ...p, stock: newStock };
            }
            return p;
        }));
        setIsUpdateStockVisible(false);
        setSelectedItems([]);
        Alert.alert("Success", `Stock updated for ${selectedItems.length} items.`);
    };

    const handleBulkCategoryUpdate = (newCategory: string) => {
        setProducts(prev => prev.map(p => {
            if (selectedItems.includes(p.id)) {
                return { ...p, category: newCategory };
            }
            return p;
        }));
        setIsUpdateCategoryVisible(false);
        setSelectedItems([]);
        Alert.alert("Success", `Category updated to ${newCategory} for ${selectedItems.length} items.`);
    };

    const selectedItemsNames = products
        .filter(p => selectedItems.includes(p.id))
        .map(p => p.name);

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            {/* Top Navigation Mock */}
            <View style={styles.navBar}>
                <View style={styles.navLeft}>
                    <View style={styles.shopIcon}>
                        <Ionicons name="storefront" size={20} color="#fff" />
                    </View>
                    <Text style={styles.navTitle}>Pragati Bandhu</Text>
                </View>
                <View style={styles.navRight}>
                    <TouchableOpacity style={styles.navIconButton}>
                        <Ionicons name="notifications-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>JD</Text>
                    </View>
                </View>
            </View>

            <View style={styles.header}>
                <Text style={styles.title}>Product Management</Text>
            </View>

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
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity 
                            key={cat} 
                            style={[
                                styles.categoryChip, 
                                selectedCategory === cat && styles.activeCategoryChip
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[
                                styles.categoryText,
                                selectedCategory === cat && styles.activeCategoryText
                            ]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>INVENTORY STATUS ({products.length})</Text>
                <View style={styles.statusActions}>
                    <TouchableOpacity style={styles.statusActionBtn}>
                        <Ionicons name="list-outline" size={16} color={colors.primary} />
                        <Text style={styles.statusActionText}>BULK EDIT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Text style={styles.viewAllText}>VIEW ALL</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <ProductCard
                        name={item.name}
                        category={item.category}
                        stock={item.stock}
                        threshold={item.threshold}
                        unit={item.unit}
                        price={item.price}
                        selected={selectedItems.includes(item.id)}
                        onPress={() => toggleSelection(item.id)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cube-outline" size={64} color={colors.border} />
                        <Text style={styles.emptyText}>No products found.</Text>
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
                        <TouchableOpacity style={styles.selectionAction}>
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
                <TouchableOpacity 
                    style={styles.fab}
                    onPress={() => navigation.navigate("AddProduct")}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </TouchableOpacity>
            )}

            {/* Modals */}
            <UpdateStockModal
                isVisible={isUpdateStockVisible}
                onClose={() => setIsUpdateStockVisible(false)}
                selectedCount={selectedItems.length}
                selectedItemsNames={selectedItemsNames}
                onUpdate={handleBulkStockUpdate}
            />

            <UpdateCategoryModal
                isVisible={isUpdateCategoryVisible}
                onClose={() => setIsUpdateCategoryVisible(false)}
                selectedCount={selectedItems.length}
                categories={CATEGORIES.filter(c => c !== "All")}
                onUpdate={handleBulkCategoryUpdate}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    navBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    navLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    shopIcon: {
        width: 36,
        height: 36,
        backgroundColor: colors.primary,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    navTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    navRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    navIconButton: {
        padding: 4,
    },
    avatar: {
        width: 36,
        height: 36,
        backgroundColor: "#dbeafe",
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: colors.primary,
        fontWeight: "700",
        fontSize: 14,
    },
    header: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.text,
    },
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
    searchInput: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: 16,
        color: colors.text,
    },
    categoryContainer: {
        marginBottom: spacing.md,
    },
    categoryScroll: {
        paddingHorizontal: spacing.md,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeCategoryChip: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    categoryText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    activeCategoryText: {
        color: "#fff",
    },
    statusRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    statusLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.textSecondary,
        letterSpacing: 0.5,
    },
    statusActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    statusActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    statusActionText: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.primary,
    },
    viewAllText: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.primary,
    },
    listContent: {
        paddingBottom: 100,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 64,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
    },
    fab: {
        position: "absolute",
        right: spacing.md,
        bottom: spacing.xl,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    selectionOverlay: {
        position: "absolute",
        bottom: spacing.md,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: "#111827",
        borderRadius: 16,
        padding: spacing.md,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    selectionLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    selectionBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    selectionBadgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    selectionText: {
        color: "#fff",
        fontWeight: "600",
    },
    selectionActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    selectionAction: {
        alignItems: "center",
        gap: 4,
    },
    selectionActionText: {
        color: "#fff",
        fontSize: 9,
        fontWeight: "700",
    },
});
