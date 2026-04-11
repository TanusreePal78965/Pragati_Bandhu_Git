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
    <View style={styles.itemContainer}>
        <View style={styles.itemLeft}>
            <View style={[styles.logoContainer, { backgroundColor: item.color }]}>
                <Text style={styles.logoText}>{item.name.substring(0, 4).toUpperCase()}</Text>
            </View>
            <View style={styles.brandInfo}>
                <Text style={styles.brandName}>{item.name}</Text>
                <Text style={styles.productCount}>{item.product_count ?? 0} Products</Text>
            </View>
        </View>
        <View style={styles.itemRight}>
            <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item.id)}>
                <Ionicons name="trash" size={24} color={colors.error} />
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
                    <Ionicons name="search-outline" size={20} color={colors.primary} />
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
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="pricetag-outline" size={48} color={colors.border} />
                            <Text style={styles.emptyText}>No brands yet</Text>
                            <Text style={styles.emptySubText}>Tap + to add your first brand</Text>
                        </View>
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
        backgroundColor: "#f1f5f9",
        borderRadius: 8,
        marginHorizontal: spacing.md,
        marginVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        height: 48,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.xs,
        fontSize: typography.sizes.md,
        color: colors.text,
    },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: 100 },
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.md,
    },
    itemLeft: { flexDirection: "row", alignItems: "center" },
    logoContainer: {
        width: 56,
        height: 56,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    logoText: {
        fontSize: 10,
        fontWeight: "900",
        color: colors.text,
        textAlign: "center",
    },
    brandInfo: { marginLeft: spacing.md },
    brandName: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.text },
    productCount: { fontSize: typography.sizes.md, color: colors.textSecondary, marginTop: 2 },
    itemRight: { flexDirection: "row", alignItems: "center" },
    actionButton: { padding: spacing.xs, marginLeft: spacing.sm },
    separator: { height: 1, backgroundColor: colors.border, opacity: 0.5 },
    emptyState: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
    emptyText: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.textSecondary, marginTop: spacing.md },
    emptySubText: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
});
