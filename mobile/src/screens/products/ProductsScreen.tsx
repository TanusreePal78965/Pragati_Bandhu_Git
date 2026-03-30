import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ProductCard from "../../components/products/ProductCard";

const MOCK_PRODUCTS = [
    {
        id: "1",
        name: "Paracetamol 500mg",
        category: "Medicine",
        stock: 45,
        threshold: 50,
        unit: "Strips",
    },
    {
        id: "2",
        name: "Amoxicillin 250mg",
        category: "Antibiotics",
        stock: 120,
        threshold: 30,
        unit: "Capsules",
    },
    {
        id: "3",
        name: "Cough Syrup 100ml",
        category: "Syrup",
        stock: 15,
        threshold: 20,
        unit: "Bottles",
    },
    {
        id: "4",
        name: "Disinfectant Spray",
        category: "General",
        stock: 60,
        threshold: 10,
        unit: "Units",
    },
    {
        id: "5",
        name: "Face Mask N95",
        category: "Safety",
        stock: 200,
        threshold: 50,
        unit: "Pieces",
    },
];

export default function ProductsScreen() {
    const [search, setSearch] = useState("");

    const filteredProducts = MOCK_PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <View style={styles.header}>
                <Text style={styles.title}>Inventory</Text>
                <TouchableOpacity style={styles.addButton}>
                    <Ionicons name="add" size={24} color="#fff" />
                    <Text style={styles.addButtonText}>Add New</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.secondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search product name..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <View style={styles.filterSection}>
                <TouchableOpacity style={[styles.filterChip, styles.activeFilter]}>
                    <Text style={[styles.filterText, styles.activeFilterText]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterChip}>
                    <Text style={styles.filterText}>Low Stock</Text>
                    <View style={styles.badgeCount}>
                        <Text style={styles.badgeText}>2</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterChip}>
                    <Text style={styles.filterText}>Medicine</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <ProductCard
                        name={item.name}
                        category={item.category}
                        stock={item.stock}
                        threshold={item.threshold}
                        unit={item.unit}
                        onPress={() => {}}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cube-outline" size={64} color={colors.border} />
                        <Text style={styles.emptyText}>No products found.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: "700",
        color: colors.text,
    },
    addButton: {
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        gap: 4,
    },
    addButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: typography.sizes.sm,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: spacing.roundness,
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.sizes.md,
        color: colors.text,
    },
    filterSection: {
        flexDirection: "row",
        paddingHorizontal: spacing.md,
        gap: 8,
        marginBottom: spacing.md,
    },
    filterChip: {
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    activeFilter: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: typography.sizes.xs,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    activeFilterText: {
        color: "#fff",
    },
    badgeCount: {
        backgroundColor: colors.error,
        borderRadius: 10,
        paddingHorizontal: 4,
        minWidth: 16,
        alignItems: "center",
    },
    badgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xl,
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
});
