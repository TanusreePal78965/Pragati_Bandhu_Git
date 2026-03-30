import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { useNavigation } from "@react-navigation/native";

const CATEGORIES = ["Grocery", "Dairy", "Beverages", "Snacks", "Personal Care", "Household"];
const BRANDS = ["Aashirvaad", "Amul", "Dove", "Britannia"];
const UOMS = ["kg", "Liter", "Pcs", "gm", "Pack"];

export default function AddProductScreen() {
    const navigation = useNavigation();
    const [name, setName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Grocery");
    const [selectedBrand, setSelectedBrand] = useState("Aashirvaad");
    const [selectedUom, setSelectedUom] = useState("kg");
    const [purchasePrice, setPurchasePrice] = useState("");
    const [sellingPrice, setSellingPrice] = useState("");
    const [initialStock, setInitialStock] = useState("");

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add New Product</Text>
            <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>PRAGATI BANDHU</Text>
            </View>
        </View>
    );

    const renderChipSelector = (
        title: string,
        items: string[],
        selected: string,
        onSelect: (val: string) => void
    ) => (
        <View style={styles.section}>
            <Text style={styles.label}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {items.map((item) => (
                    <TouchableOpacity
                        key={item}
                        style={[styles.chip, selected === item && styles.activeChip]}
                        onPress={() => onSelect(item)}
                    >
                        <Text style={[styles.chipText, selected === item && styles.activeChipText]}>
                            {item}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            {renderHeader()}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Basic Information */}
                    <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>
                    
                    <View style={styles.section}>
                        <Text style={styles.label}>Product Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Basmati Rice"
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    {renderChipSelector("Category", CATEGORIES, selectedCategory, setSelectedCategory)}
                    {renderChipSelector("Brand", BRANDS, selectedBrand, setSelectedBrand)}

                    <View style={styles.separator} />

                    {/* Pricing & Inventory */}
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
                        <Text style={styles.label}>Selling Price</Text>
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
                        <Text style={styles.helperText}>Current quantity available in your store</Text>
                    </View>

                    {renderChipSelector("Unit of Measurement (UOM)", UOMS, selectedUom, setSelectedUom)}

                    {/* Stock Alert Box */}
                    <View style={styles.alertBox}>
                        <Ionicons name="information-circle" size={24} color={colors.primary} />
                        <View style={styles.alertContent}>
                            <Text style={styles.alertTitle}>Stock Alerts</Text>
                            <Text style={styles.alertText}>
                                Pragati Bandhu will automatically notify you when this item reaches low stock.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Footer Action */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Product</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f9fafb",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
        marginLeft: 8,
        flex: 1,
    },
    brandBadge: {
        backgroundColor: "#eef2ff",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    brandBadgeText: {
        color: colors.primary,
        fontSize: 10,
        fontWeight: "700",
    },
    scroll: {
        padding: spacing.md,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#6b7280",
        letterSpacing: 0.5,
        marginBottom: 16,
        marginTop: 8,
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 48,
        fontSize: 16,
        color: colors.text,
    },
    inputWithIcon: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 48,
        flexDirection: "row",
        alignItems: "center",
    },
    inputActive: {
        borderColor: colors.primary,
        backgroundColor: "#eff6ff",
    },
    flexInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: colors.text,
    },
    helperText: {
        fontSize: 12,
        color: "#6b7280",
        marginTop: 4,
    },
    chipScroll: {
        gap: 8,
    },
    chip: {
        backgroundColor: "#e5e7eb",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    activeChip: {
        backgroundColor: colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: "500",
        color: colors.text,
    },
    activeChipText: {
        color: "#fff",
    },
    separator: {
        height: 1,
        backgroundColor: "#f3f4f6",
        marginVertical: 12,
    },
    alertBox: {
        backgroundColor: "#eff6ff",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        gap: 12,
        marginBottom: 40,
    },
    alertContent: {
        flex: 1,
    },
    alertTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 2,
    },
    alertText: {
        fontSize: 12,
        color: "#4b5563",
        lineHeight: 18,
    },
    footer: {
        padding: spacing.md,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    saveButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
});
