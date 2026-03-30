import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";
import ScreenHeader from "../../components/common/ScreenHeader";

const BRANDS = [
    { id: "1", name: "Aashirvaad", products: 32, logoType: "text", logo: "AASHIRVAAD", logoBg: "#fef3c7" },
    { id: "2", name: "Amul", products: 114, logoType: "text", logo: "Amul", logoBg: "#f3f4f6" },
    { id: "3", name: "Dove", products: 15, logoType: "icon", logo: "image-outline", logoBg: "#f1f5f9" },
    { id: "4", name: "Britannia", products: 50, logoType: "icon", logo: "image-outline", logoBg: "#f1f5f9" },
    { id: "5", name: "Fortune", products: 12, logoType: "icon", logo: "image-outline", logoBg: "#f1f5f9" },
    { id: "6", name: "Tata", products: 88, logoType: "icon", logo: "image-outline", logoBg: "#f1f5f9" },
];

const BrandItem = ({ item }: { item: typeof BRANDS[0] }) => (
    <View style={styles.itemContainer}>
        <View style={styles.itemLeft}>
            <View style={[styles.logoContainer, { backgroundColor: item.logoBg }]}>
                {item.logoType === "text" ? (
                    <Text style={styles.logoText}>{item.logo}</Text>
                ) : (
                    <Ionicons name={item.logo as any} size={24} color={colors.textSecondary} />
                )}
            </View>
            <View style={styles.brandInfo}>
                <Text style={styles.brandName}>{item.name}</Text>
                <Text style={styles.productCount}>{item.products} Products</Text>
            </View>
        </View>
        <View style={styles.itemRight}>
            <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="pencil" size={24} color="#1a57db" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="trash" size={24} color="#ef4444" />
            </TouchableOpacity>
        </View>
    </View>
);

export default function ManageBrandsScreen() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState("");

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />
            
            <ScreenHeader 
                title="Manage Brands" 
                showBack={true}
            />

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
                    data={BRANDS}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <BrandItem item={item} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            </View>

            <TouchableOpacity 
                style={styles.fab}
                onPress={() => navigation.navigate("AddBrand" as never)}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    content: {
        flex: 1,
    },
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
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 100,
    },
    itemContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.md,
    },
    itemLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
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
    brandInfo: {
        marginLeft: spacing.md,
    },
    brandName: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        color: colors.text,
    },
    productCount: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        marginTop: 2,
    },
    itemRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    actionButton: {
        padding: spacing.xs,
        marginLeft: spacing.sm,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    fab: {
        position: "absolute",
        right: spacing.lg,
        bottom: spacing.lg,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
});
