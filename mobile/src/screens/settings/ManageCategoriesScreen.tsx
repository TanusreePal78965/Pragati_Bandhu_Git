import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import ScreenHeader from "../../components/common/ScreenHeader";

const CATEGORIES = [
    { id: "1", name: "Grocery", products: 24, icon: "cart", iconColor: "#1a57db", type: "Ionicons" },
    { id: "2", name: "Dairy", products: 12, icon: "water", iconColor: "#3b82f6", type: "Ionicons" },
    { id: "3", name: "Beverages", products: 45, icon: "coffee", iconColor: "#6366f1", type: "MaterialCommunityIcons" },
    { id: "4", name: "Snacks", products: 30, icon: "cookie", iconColor: "#8b5cf6", type: "MaterialCommunityIcons" },
    { id: "5", name: "Personal Care", products: 18, icon: "content-cut", iconColor: "#a855f7", type: "MaterialCommunityIcons" },
    { id: "6", name: "Household", products: 10, icon: "briefcase", iconColor: "#d946ef", type: "Ionicons" },
];

const CategoryCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
        <View style={styles.cardLeft}>
            <View style={[styles.iconContainer, { backgroundColor: item.iconColor + "15" }]}>
                {item.type === "Ionicons" ? (
                    <Ionicons name={item.icon as any} size={24} color={item.iconColor} />
                ) : (
                    <MaterialCommunityIcons name={item.icon as any} size={24} color={item.iconColor} />
                )}
            </View>
            <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={styles.productCount}>{item.products} Products</Text>
            </View>
        </View>
        <View style={styles.cardRight}>
            <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="pencil" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
    </View>
);

export default function ManageCategoriesScreen() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState("");

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />
            
            <ScreenHeader 
                title="Manage Categories" 
                showBack={true}
                rightElement={
                    <TouchableOpacity 
                        style={styles.headerPlusButton}
                        onPress={() => navigation.navigate("AddCategory" as never)}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                }
            />

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
                    data={CATEGORIES}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <CategoryCard item={item} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Showing {CATEGORIES.length} categories total</Text>
                        </View>
                    }
                />
            </View>

            <TouchableOpacity 
                style={styles.fab}
                onPress={() => navigation.navigate("AddCategory" as never)}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    headerPlusButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        height: 50,
        // Shadow
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
    listContent: {
        paddingBottom: 100, // For FAB
    },
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
    cardLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    categoryInfo: {
        marginLeft: spacing.md,
    },
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
    cardRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    actionButton: {
        padding: spacing.xs,
        marginLeft: spacing.sm,
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
    fab: {
        position: "absolute",
        right: spacing.lg,
        bottom: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
});
