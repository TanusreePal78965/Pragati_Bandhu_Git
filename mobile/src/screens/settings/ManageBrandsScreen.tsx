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
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import ScreenHeader from "../../components/common/ScreenHeader";
import FAB from "../../components/common/FAB";
import { getAllBrands, deleteBrand, Brand } from "../../db/db";

const BrandItem = ({
    item,
    onDelete,
}: {
    item: Brand & { product_count?: number };
    onDelete: (id: string) => void;
}) => (
    <View style={styles.card}>
        <View style={styles.cardLeft}>
            <View style={[styles.logoContainer, { backgroundColor: item.color + "15" }]}>
                <Text style={[styles.logoText, { color: item.color }]}>
                    {item.name.substring(0, 3).toUpperCase()}
                </Text>
            </View>
            <View style={styles.brandInfo}>
                <Text style={styles.brandName}>{item.name}</Text>
                <Text style={styles.productCount}>{item.product_count ?? 0} Products</Text>
            </View>
        </View>
        <View style={styles.cardRight}>
            <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
        </View>
    </View>
);

export default function ManageBrandsScreen() {
    const navigation = useNavigation();
    const [brands, setBrands] = useState<Brand[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const loadBrands = useCallback(() => {
        const data = getAllBrands();
        setBrands(data);
    }, []);

    useFocusEffect(loadBrands);

    const handleDelete = (id: string) => {
        Alert.alert("Delete Brand", "Are you sure? Products linked to this brand will be unbranded.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    deleteBrand(id);
                    setBrands((prev) => prev.filter((b) => b.id !== id));
                },
            },
        ]);
    };

    const filtered = searchQuery.trim()
        ? brands.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : brands;

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />

            <ScreenHeader title="Manage Brands" showBack={true} />

            <View style={styles.content}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search brands..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <BrandItem item={item} onDelete={handleDelete} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="pricetag-outline" size={48} color={colors.border} />
                            <Text style={styles.emptyText}>No brands yet</Text>
                            <Text style={styles.emptySubText}>Tap + to add your first brand</Text>
                        </View>
                    }
                    ListFooterComponent={
                        filtered.length > 0 ? (
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>
                                    Showing {filtered.length} brand{filtered.length === 1 ? "" : "s"}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            </View>

            <FAB
                onPress={() => navigation.navigate("AddBrand" as never)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    content: { flex: 1 },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginHorizontal: spacing.md,
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
    listContent: { paddingTop: 4, paddingBottom: 100 },
    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginHorizontal: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardLeft: { flexDirection: "row", alignItems: "center" },
    logoContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    logoText: {
        fontSize: 12,
        fontWeight: "900",
        textAlign: "center",
    },
    brandInfo: { marginLeft: spacing.md },
    brandName: {
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
    emptyState: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
    emptyText: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.textSecondary, marginTop: spacing.md },
    emptySubText: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
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
