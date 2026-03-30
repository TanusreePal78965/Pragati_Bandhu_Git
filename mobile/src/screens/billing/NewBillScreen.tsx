import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface BillItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    unit: string;
    hasOffer?: boolean;
    offerText?: string;
}

export default function NewBillScreen() {
    const navigation = useNavigation();
    const [paymentMode, setPaymentMode] = useState<"Cash" | "Udhar">("Cash");
    const [billItems, setBillItems] = useState<BillItem[]>([
        { id: "1", name: "Mustard Oil 1L (Fortune)", qty: 2, price: 145.0, unit: "UNIT" },
        { id: "2", name: "Basmati Rice 5kg Gold", qty: 1, price: 450.0, unit: "UNIT" },
        { id: "3", name: "Tata Salt 1kg", qty: 2, price: 28.0, unit: "UNIT" },
        { id: "4", name: "Whole Wheat Atta 10kg", qty: 1, price: 320.0, unit: "UNIT", hasOffer: true, offerText: "EXTRA 5% OFF" },
    ]);

    const totalItems = billItems.reduce((acc, item) => acc + item.qty, 0);
    const grandTotal = billItems.reduce((acc, item) => acc + item.qty * item.price, 0);

    const updateQty = (id: string, delta: number) => {
        setBillItems(prev => prev.map(item => 
            item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        ).filter(item => item.qty > 0));
    };

    const renderItem = ({ item }: { item: BillItem }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
            </View>
            <View style={styles.itemDetailsRow}>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceText}>₹ {item.price.toFixed(2)}</Text>
                    <Text style={styles.unitText}> / {item.unit}</Text>
                </View>
                
                <View style={styles.qtyContainer}>
                    <TouchableOpacity 
                        style={styles.qtyBtn}
                        onPress={() => updateQty(item.id, -1)}
                    >
                        <Ionicons name="remove" size={18} color="#475569" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{item.qty}</Text>
                    <TouchableOpacity 
                        style={[styles.qtyBtn, styles.qtyAddBtn]}
                        onPress={() => updateQty(item.id, 1)}
                    >
                        <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
            
            {item.hasOffer && (
                <View style={styles.offerBadge}>
                    <Text style={styles.offerText}>{item.offerText}</Text>
                </View>
            )}

            <View style={styles.updateMasterRow}>
                <View style={styles.checkboxPlaceholder} />
                <Text style={styles.updateMasterText}>UPDATE MASTER PRICE</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Bill</Text>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-vertical" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search product or scan barcode..."
                        placeholderTextColor="#94a3b8"
                    />
                    <TouchableOpacity>
                        <Ionicons name="scan-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Customer Details */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>CUSTOMER DETAILS</Text>
                    <TouchableOpacity>
                        <Text style={styles.changeLink}>Change</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.customerCard}>
                    <View style={styles.customerInfo}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.customerText}>
                            <Text style={styles.customerName}>Rahul Sharma</Text>
                            <Text style={styles.customerPhone}>+91 98765 43210</Text>
                        </View>
                    </View>
                    <View style={styles.udharInfo}>
                        <Text style={styles.udharLabel}>CURRENT UDHAR</Text>
                        <Text style={styles.udharValue}>₹1,450.00</Text>
                    </View>
                </View>

                {/* Payment Mode */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>PAYMENT MODE</Text>
                </View>
                <View style={styles.paymentModeContainer}>
                    <TouchableOpacity 
                        style={[styles.paymentBtn, paymentMode === "Cash" && styles.paymentBtnActive]}
                        onPress={() => setPaymentMode("Cash")}
                    >
                        <Ionicons name="cash-outline" size={20} color={paymentMode === "Cash" ? colors.primary : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "Cash" && styles.paymentBtnTextActive]}>Cash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.paymentBtn, paymentMode === "Udhar" && styles.paymentBtnActive]}
                        onPress={() => setPaymentMode("Udhar")}
                    >
                        <Ionicons name="wallet-outline" size={20} color={paymentMode === "Udhar" ? colors.primary : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "Udhar" && styles.paymentBtnTextActive]}>Udhar (Credit)</Text>
                    </TouchableOpacity>
                </View>

                {/* Selected Items */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>SELECTED ITEMS ({billItems.length})</Text>
                    <TouchableOpacity onPress={() => setBillItems([])}>
                        <Text style={styles.changeLink}>Clear All</Text>
                    </TouchableOpacity>
                </View>

                {billItems.map(item => (
                    <React.Fragment key={item.id}>
                        {renderItem({ item })}
                    </React.Fragment>
                ))}

                <TouchableOpacity style={styles.addQuickItem}>
                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                    <Text style={styles.addQuickItemText}>Add Quick Item</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Bottom Footer */}
            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    <Text style={styles.totalItemsLabel}>TOTAL ITEMS</Text>
                    <Text style={styles.totalItemsValue}>{String(totalItems).padStart(2, '0')} Items</Text>
                </View>
                <View style={styles.footerRight}>
                    <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                    <Text style={styles.grandTotalValue}>₹{grandTotal.toLocaleString('en-IN')}.00</Text>
                </View>
            </View>
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.estimateBtn}>
                    <Ionicons name="print-outline" size={24} color="#475569" />
                    <Text style={styles.estimateBtnText}>ESTIMATE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkoutBtn}>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.checkoutBtnText}>SAVE & CHECKOUT</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
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
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1e293b",
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 40,
    },
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
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: "#1e293b",
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
        letterSpacing: 0.5,
    },
    changeLink: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.primary,
    },
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
    customerInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#DBEAFE",
        alignItems: "center",
        justifyContent: "center",
    },
    customerText: {
        gap: 2,
    },
    customerName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1e293b",
    },
    customerPhone: {
        fontSize: 13,
        color: "#64748B",
    },
    udharInfo: {
        alignItems: "flex-end",
    },
    udharLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: "#94A3B8",
    },
    udharValue: {
        fontSize: 16,
        fontWeight: "800",
        color: "#EF4444",
        marginTop: 2,
    },
    paymentModeContainer: {
        flexDirection: "row",
        gap: 12,
    },
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
    paymentBtnActive: {
        borderColor: colors.primary,
        backgroundColor: "#EFF6FF",
    },
    paymentBtnText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748B",
    },
    paymentBtnTextActive: {
        color: colors.primary,
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
    },
    itemName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: 8,
    },
    itemDetailsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
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
    priceText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1e293b",
    },
    unitText: {
        fontSize: 11,
        color: "#94A3B8",
    },
    qtyContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        overflow: "hidden",
    },
    qtyBtn: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    qtyAddBtn: {
        backgroundColor: colors.primary,
    },
    qtyValue: {
        width: 40,
        textAlign: "center",
        fontSize: 16,
        fontWeight: "700",
        color: "#1e293b",
    },
    updateMasterRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
        gap: 8,
    },
    checkboxPlaceholder: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
    },
    updateMasterText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#94A3B8",
    },
    offerBadge: {
        position: "absolute",
        top: 48,
        left: 140,
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    offerText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#15803D",
    },
    addQuickItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
        gap: 8,
    },
    addQuickItemText: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.primary,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 16,
        backgroundColor: "#F8FAFC",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    footerLeft: {
        gap: 2,
    },
    totalItemsLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#64748B",
    },
    totalItemsValue: {
        fontSize: 18,
        fontWeight: "800",
        color: "#000",
    },
    footerRight: {
        alignItems: "flex-end",
        gap: 2,
    },
    grandTotalLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#64748B",
    },
    grandTotalValue: {
        fontSize: 24,
        fontWeight: "800",
        color: colors.primary,
    },
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
    estimateBtnText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#475569",
    },
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
    checkoutBtnText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#fff",
    },
});
