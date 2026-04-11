import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
    ScrollView,
    Modal,
    Alert,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { getAllProducts, getAllCustomers, insertBill, Product, Customer } from "../../db/db";

interface BillItem {
    product_id: string;
    product_name: string;
    qty: number;
    unit_price: number;
    uom: string;
}

export default function NewBillScreen() {
    const navigation = useNavigation();
    const [paymentMode, setPaymentMode] = useState<"cash" | "udhar">("cash");
    const [billItems, setBillItems] = useState<BillItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setProducts(getAllProducts());
        setCustomers(getAllCustomers());
    }, []);

    // Product search results (only show when search has text)
    const searchResults = search.trim().length > 1
        ? products.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.category_name ?? "").toLowerCase().includes(search.toLowerCase())
        ).slice(0, 8)
        : [];

    const addProduct = (product: Product) => {
        const existing = billItems.find((i) => i.product_id === product.id);
        if (existing) {
            setBillItems((prev) =>
                prev.map((i) =>
                    i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i
                )
            );
        } else {
            setBillItems((prev) => [
                ...prev,
                {
                    product_id: product.id,
                    product_name: product.name,
                    qty: 1,
                    unit_price: product.selling_price,
                    uom: product.uom,
                },
            ]);
        }
        setSearch("");
    };

    const updateQty = (productId: string, delta: number) => {
        setBillItems((prev) =>
            prev
                .map((i) => (i.product_id === productId ? { ...i, qty: i.qty + delta } : i))
                .filter((i) => i.qty > 0)
        );
    };

    const totalItems = billItems.reduce((acc, i) => acc + i.qty, 0);
    const grandTotal = billItems.reduce((acc, i) => acc + i.qty * i.unit_price, 0);

    const handleCheckout = () => {
        if (billItems.length === 0) {
            Alert.alert("Empty Bill", "Please add at least one product to the bill.");
            return;
        }
        if (paymentMode === "udhar" && !selectedCustomer) {
            Alert.alert("Customer Required", "Please select a customer for Udhar payment.");
            return;
        }
        setSaving(true);
        try {
            insertBill(
                {
                    customer_id: selectedCustomer?.id ?? null,
                    customer_name: selectedCustomer?.name ?? null,
                    payment_mode: paymentMode,
                    total_amount: grandTotal,
                    total_items: totalItems,
                },
                billItems.map((i) => ({
                    product_id: i.product_id,
                    product_name: i.product_name,
                    qty: i.qty,
                    unit_price: i.unit_price,
                    line_total: i.qty * i.unit_price,
                }))
            );
            Alert.alert("Bill Saved!", `₹${grandTotal.toFixed(2)} bill saved successfully.`, [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert("Error", "Could not save bill. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const filteredCustomers = customerSearch.trim()
        ? customers.filter(
            (c) =>
                c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                (c.phone ?? "").includes(customerSearch)
        )
        : customers;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Bill</Text>
                <TouchableOpacity onPress={() => setBillItems([])}>
                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Customer Details */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>CUSTOMER DETAILS</Text>
                    <TouchableOpacity onPress={() => setShowCustomerModal(true)}>
                        <Text style={styles.changeLink}>
                            {selectedCustomer ? "Change" : "Select Customer"}
                        </Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={styles.customerCard}
                    onPress={() => setShowCustomerModal(true)}
                >
                    <View style={styles.customerInfo}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.customerText}>
                            <Text style={styles.customerName}>
                                {selectedCustomer?.name ?? "Walk-in Customer"}
                            </Text>
                            <Text style={styles.customerPhone}>
                                {selectedCustomer?.phone ?? "Tap to select customer"}
                            </Text>
                        </View>
                    </View>
                    {selectedCustomer && (
                        <View style={styles.udharInfo}>
                            <Text style={styles.udharLabel}>CURRENT UDHAR</Text>
                            <Text style={styles.udharValue}>
                                ₹{selectedCustomer.udhar_balance.toFixed(2)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Product Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search product to add..."
                        placeholderTextColor="#94a3b8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch("")}>
                            <Ionicons name="close-circle" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                        {searchResults.map((product) => (
                            <TouchableOpacity
                                key={product.id}
                                style={styles.searchResultItem}
                                onPress={() => addProduct(product)}
                            >
                                <View style={styles.searchResultInfo}>
                                    <Text style={styles.searchResultName}>{product.name}</Text>
                                    <Text style={styles.searchResultMeta}>
                                        {product.category_name ?? "No category"} · Stock: {product.stock_quantity}
                                    </Text>
                                </View>
                                <Text style={styles.searchResultPrice}>
                                    ₹{product.selling_price.toFixed(2)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                {search.trim().length > 1 && searchResults.length === 0 && (
                    <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>No products found for "{search}"</Text>
                    </View>
                )}

                {/* Payment Mode */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>PAYMENT MODE</Text>
                </View>
                <View style={styles.paymentModeContainer}>
                    <TouchableOpacity
                        style={[styles.paymentBtn, paymentMode === "cash" && styles.paymentBtnActive]}
                        onPress={() => setPaymentMode("cash")}
                    >
                        <Ionicons name="cash-outline" size={20} color={paymentMode === "cash" ? colors.primary : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "cash" && styles.paymentBtnTextActive]}>
                            Cash
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.paymentBtn, paymentMode === "udhar" && styles.paymentBtnActive]}
                        onPress={() => setPaymentMode("udhar")}
                    >
                        <Ionicons name="wallet-outline" size={20} color={paymentMode === "udhar" ? colors.primary : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "udhar" && styles.paymentBtnTextActive]}>
                            Udhar (Credit)
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Bill Items */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>ITEMS ({billItems.length})</Text>
                    {billItems.length > 0 && (
                        <TouchableOpacity onPress={() => setBillItems([])}>
                            <Text style={styles.changeLink}>Clear All</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {billItems.length === 0 ? (
                    <View style={styles.emptyBill}>
                        <Ionicons name="receipt-outline" size={40} color={colors.border} />
                        <Text style={styles.emptyBillText}>Search for products above to add them to this bill</Text>
                    </View>
                ) : (
                    billItems.map((item) => (
                        <View key={item.product_id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemName}>{item.product_name}</Text>
                                <Text style={styles.itemLineTotal}>
                                    ₹{(item.qty * item.unit_price).toFixed(2)}
                                </Text>
                            </View>
                            <View style={styles.itemDetailsRow}>
                                <View style={styles.priceContainer}>
                                    <Text style={styles.priceText}>₹{item.unit_price.toFixed(2)}</Text>
                                    <Text style={styles.unitText}> / {item.uom}</Text>
                                </View>
                                <View style={styles.qtyContainer}>
                                    <TouchableOpacity
                                        style={styles.qtyBtn}
                                        onPress={() => updateQty(item.product_id, -1)}
                                    >
                                        <Ionicons name="remove" size={18} color="#475569" />
                                    </TouchableOpacity>
                                    <Text style={styles.qtyValue}>{item.qty}</Text>
                                    <TouchableOpacity
                                        style={[styles.qtyBtn, styles.qtyAddBtn]}
                                        onPress={() => updateQty(item.product_id, 1)}
                                    >
                                        <Ionicons name="add" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    <Text style={styles.totalItemsLabel}>TOTAL ITEMS</Text>
                    <Text style={styles.totalItemsValue}>{String(totalItems).padStart(2, "0")} Items</Text>
                </View>
                <View style={styles.footerRight}>
                    <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                    <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
                </View>
            </View>
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.estimateBtn}>
                    <Ionicons name="print-outline" size={24} color="#475569" />
                    <Text style={styles.estimateBtnText}>ESTIMATE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.checkoutBtn, saving && { opacity: 0.7 }]}
                    onPress={handleCheckout}
                    disabled={saving}
                >
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.checkoutBtnText}>
                        {saving ? "SAVING..." : "SAVE & CHECKOUT"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Customer Picker Modal */}
            <Modal visible={showCustomerModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowCustomerModal(false)}>
                    <Pressable style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Select Customer</Text>

                        <TextInput
                            style={styles.modalSearch}
                            placeholder="Search customer..."
                            value={customerSearch}
                            onChangeText={setCustomerSearch}
                            placeholderTextColor="#94a3b8"
                        />

                        <FlatList
                            data={filteredCustomers}
                            keyExtractor={(item) => item.id}
                            style={styles.modalList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.customerOption,
                                        selectedCustomer?.id === item.id && styles.customerOptionActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedCustomer(item);
                                        setShowCustomerModal(false);
                                        setCustomerSearch("");
                                    }}
                                >
                                    <View>
                                        <Text style={styles.customerOptionName}>{item.name}</Text>
                                        <Text style={styles.customerOptionPhone}>
                                            {item.phone ?? "No phone"} · Udhar: ₹{item.udhar_balance.toFixed(2)}
                                        </Text>
                                    </View>
                                    {selectedCustomer?.id === item.id && (
                                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.noResultsText}>No customers found</Text>
                            }
                        />

                        <TouchableOpacity
                            style={styles.walkInBtn}
                            onPress={() => {
                                setSelectedCustomer(null);
                                setShowCustomerModal(false);
                            }}
                        >
                            <Text style={styles.walkInBtnText}>Walk-in (No customer)</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        height: 56,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
    scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 40 },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginTop: spacing.md,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: "#1e293b" },
    searchResults: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginTop: 4,
        overflow: "hidden",
    },
    searchResultItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    searchResultInfo: { flex: 1 },
    searchResultName: { fontSize: 15, fontWeight: "600", color: colors.text },
    searchResultMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    searchResultPrice: { fontSize: 15, fontWeight: "700", color: colors.primary, marginLeft: 8 },
    noResults: { paddingVertical: 12, alignItems: "center" },
    noResultsText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    sectionLabel: { fontSize: 12, fontWeight: "600", color: "#64748B", letterSpacing: 0.5 },
    changeLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
    customerCard: {
        backgroundColor: "#EFF6FF",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#DBEAFE",
    },
    customerInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#DBEAFE",
        alignItems: "center",
        justifyContent: "center",
    },
    customerText: { gap: 2 },
    customerName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
    customerPhone: { fontSize: 13, color: "#64748B" },
    udharInfo: { alignItems: "flex-end" },
    udharLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
    udharValue: { fontSize: 16, fontWeight: "800", color: "#EF4444", marginTop: 2 },
    paymentModeContainer: { flexDirection: "row", gap: 12 },
    paymentBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 48,
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        gap: 8,
    },
    paymentBtnActive: { borderColor: colors.primary, backgroundColor: "#EFF6FF" },
    paymentBtnText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
    paymentBtnTextActive: { color: colors.primary },
    emptyBill: {
        alignItems: "center",
        paddingVertical: 32,
        gap: 8,
    },
    emptyBillText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        maxWidth: "70%",
    },
    itemCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    itemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    itemName: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1e293b" },
    itemLineTotal: { fontSize: 15, fontWeight: "800", color: colors.primary },
    itemDetailsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    priceContainer: {
        flexDirection: "row",
        alignItems: "baseline",
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    priceText: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
    unitText: { fontSize: 11, color: "#94A3B8" },
    qtyContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, overflow: "hidden" },
    qtyBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    qtyAddBtn: { backgroundColor: colors.primary },
    qtyValue: { width: 40, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#1e293b" },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 16,
        backgroundColor: "#F8FAFC",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    footerLeft: { gap: 2 },
    totalItemsLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },
    totalItemsValue: { fontSize: 18, fontWeight: "800", color: "#000" },
    footerRight: { alignItems: "flex-end", gap: 2 },
    grandTotalLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },
    grandTotalValue: { fontSize: 24, fontWeight: "800", color: colors.primary },
    actionsContainer: {
        flexDirection: "row",
        paddingHorizontal: spacing.md,
        paddingBottom: 20,
        gap: 12,
        backgroundColor: "#F8FAFC",
    },
    estimateBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 56,
        backgroundColor: "#F1F5F9",
        borderRadius: 12,
        gap: 8,
    },
    estimateBtnText: { fontSize: 15, fontWeight: "700", color: "#475569" },
    checkoutBtn: {
        flex: 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 56,
        backgroundColor: colors.primary,
        borderRadius: 12,
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    checkoutBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    // Customer Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        maxHeight: "75%",
    },
    modalHandle: {
        width: 48,
        height: 5,
        backgroundColor: "#e5e7eb",
        borderRadius: 2.5,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 20,
    },
    modalTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 16 },
    modalSearch: {
        backgroundColor: "#f3f4f6",
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        fontSize: 15,
        color: colors.text,
        marginBottom: 12,
    },
    modalList: { maxHeight: 320 },
    customerOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    customerOptionActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
    customerOptionName: { fontSize: 16, fontWeight: "600", color: colors.text },
    customerOptionPhone: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    walkInBtn: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
    },
    walkInBtnText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
});
