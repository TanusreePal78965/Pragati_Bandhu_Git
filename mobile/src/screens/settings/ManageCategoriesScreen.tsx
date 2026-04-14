import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import ScreenHeader from "../../components/common/ScreenHeader";
import FAB from "../../components/common/FAB";
import { getAllCategories, deleteCategory, Category } from "../../db/db";

/** icon stored as "Ionicons:cart" or "MCI:coffee" */
const renderIcon = (iconField: string, color: string, size = 24) => {
    const [type, name] = iconField?.includes(":") ? iconField.split(":") : ["Ionicons", iconField ?? "grid-outline"];
    if (type === "MCI") {
        return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
    }
    return <Ionicons name={name as any} size={size} color={color} />;
};

const CategoryCard = ({
    item,
    onDelete,
}: {
    item: Category & { product_count?: number };
    onDelete: (id: string) => void;
}) => (
    <View style={styles.card}>
        <View style={styles.cardLeft}>
            <View style={[styles.iconContainer, { backgroundColor: item.icon_color + "15" }]}>
                {renderIcon(item.icon, item.icon_color)}
            </View>
            <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={styles.productCount}>{item.product_count ?? 0} Products</Text>
            </View>
        </View>
        <View style={styles.cardRight}>
            <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDelete(item.id)}
            >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
        </View>
    </View>
);

export default function ManageCategoriesScreen() {
    const navigation = useNavigation();
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const loadCategories = useCallback(() => {
        const data = getAllCategories();
        setCategories(data);
    }, []);

    useFocusEffect(loadCategories);

    const handleDelete = (id: string) => {
        Alert.alert("Delete Category", "Are you sure? Products in this category will be uncategorised.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    deleteCategory(id);
                    setCategories((prev) => prev.filter((c) => c.id !== id));
                },
            },
        ]);
    };

    const filtered = searchQuery.trim()
        ? categories.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : categories;

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />

            <ScreenHeader title="Manage Categories" showBack={true} />

            <View style={styles.content}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search categories..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <CategoryCard item={item} onDelete={handleDelete} />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="grid-outline" size={48} color={colors.border} />
                            <Text style={styles.emptyText}>No categories yet</Text>
                            <Text style={styles.emptySubText}>Tap + to add your first category</Text>
                        </View>
                    }
                    ListFooterComponent={
                        filtered.length > 0 ? (
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>
                                    Showing {filtered.length} categor{filtered.length === 1 ? "y" : "ies"}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            </View>

            <FAB
                onPress={() => navigation.navigate("AddCategory" as never)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    content: { flex: 1, paddingHorizontal: spacing.md },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        height: 50,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.xs,
        fontSize: typography.sizes.md,
        color: colors.text,
    },
    listContent: { paddingBottom: 100 },
    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardLeft: { flexDirection: "row", alignItems: "center" },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    categoryInfo: { marginLeft: spacing.md },
    categoryName: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    productCount: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    cardRight: { flexDirection: "row", alignItems: "center" },
    actionButton: { padding: spacing.xs, marginLeft: spacing.sm },
    emptyState: {
        alignItems: "center",
        paddingTop: 60,
        paddingBottom: 40,
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    emptySubText: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    footer: {
        alignItems: "center",
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
    footerText: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        fontStyle: "italic",
    },
});
