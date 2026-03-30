import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import PrimaryButton from "../../components/common/PrimaryButton";

interface BillItem {
    id: string;
    name: string;
    qty: number;
    price: number;
}

export default function NewBillScreen() {
    const [customerName, setCustomerName] = useState("");
    const [billItems, setBillItems] = useState<BillItem[]>([
        { id: "1", name: "Paracetamol 500mg", qty: 2, price: 15.5 },
        { id: "2", name: "Cough Syrup", qty: 1, price: 55.0 },
    ]);

    const total = billItems.reduce((acc, item) => acc + item.qty * item.price, 0);

    const removeItem = (id: string) => {
        setBillItems(billItems.filter((i) => i.id !== id));
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <ScreenHeader title="Create New Bill" showBack />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <View style={styles.topInfo}>
                    <View style={styles.customerBox}>
                        <Ionicons name="person-outline" size={20} color={colors.secondary} />
                        <TextInput
                            style={styles.customerInput}
                            placeholder="Add Customer Name (Optional)"
                            value={customerName}
                            onChangeText={setCustomerName}
                        />
                        <TouchableOpacity>
                            <Ionicons
                                name="add-circle-outline"
                                size={24}
                                color={colors.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.searchProduct}>
                        <Ionicons name="search" size={18} color={colors.secondary} />
                        <Text style={styles.placeholderText}>Search product to add...</Text>
                        <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.itemListHeader}>
                    <Text style={styles.countText}>{billItems.length} Products</Text>
                    <TouchableOpacity>
                        <Text style={styles.clearAll}>Clear All</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={billItems}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.billItem}>
                            <View style={styles.itemMain}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemPrice}>₹ {item.price.toFixed(2)} / unit</Text>
                            </View>
                            <View style={styles.qtyControls}>
                                <TouchableOpacity style={styles.qtyBtn}>
                                    <Ionicons name="remove" size={16} color={colors.primary} />
                                </TouchableOpacity>
                                <Text style={styles.qtyValue}>{item.qty}</Text>
                                <TouchableOpacity style={styles.qtyBtn}>
                                    <Ionicons name="add" size={16} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.itemTotal}>
                                <Text style={styles.totalValue}>
                                    ₹ {(item.qty * item.price).toFixed(2)}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.removeBtn}
                                onPress={() => removeItem(item.id)}
                            >
                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="receipt-outline" size={64} color={colors.border} />
                            <Text style={styles.emptyText}>No items added yet.</Text>
                        </View>
                    }
                />

                <View style={styles.footer}>
                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalAmount}>₹ {total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.footerActions}>
                        <TouchableOpacity style={styles.creditBtn}>
                            <Text style={styles.creditText}>Udhar</Text>
                        </TouchableOpacity>
                        <PrimaryButton
                            title={`Bill Paid ₹${total.toFixed(0)}`}
                            onPress={() => {}}
                            style={styles.payBtn}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    topInfo: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    customerBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        height: 44,
        borderRadius: 8,
        marginBottom: spacing.sm,
    },
    customerInput: {
        flex: 1,
        marginHorizontal: spacing.sm,
        fontSize: typography.sizes.sm,
        color: colors.text,
    },
    searchProduct: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        height: 48,
        borderRadius: spacing.roundness,
        marginTop: 4,
    },
    placeholderText: {
        flex: 1,
        marginLeft: spacing.sm,
        color: colors.secondary,
        fontSize: typography.sizes.sm,
    },
    itemListHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginTop: spacing.md,
    },
    countText: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.textSecondary,
        textTransform: "uppercase",
    },
    clearAll: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.error,
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xl,
    },
    billItem: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    itemMain: {
        flex: 2,
    },
    itemName: {
        fontSize: typography.sizes.md,
        fontWeight: "600",
        color: colors.text,
    },
    itemPrice: {
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 2,
    },
    qtyControls: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginHorizontal: spacing.sm,
    },
    qtyBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary + "15",
        alignItems: "center",
        justifyContent: "center",
    },
    qtyValue: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    itemTotal: {
        flex: 1,
        alignItems: "flex-end",
    },
    totalValue: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    removeBtn: {
        marginLeft: spacing.md,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 64,
    },
    emptyText: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    footer: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    totalBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    totalLabel: {
        fontSize: typography.sizes.md,
        fontWeight: "500",
        color: colors.textSecondary,
    },
    totalAmount: {
        fontSize: typography.sizes.xl,
        fontWeight: "800",
        color: colors.text,
    },
    footerActions: {
        flexDirection: "row",
        gap: 12,
    },
    creditBtn: {
        flex: 1,
        height: 48,
        borderRadius: spacing.roundness,
        borderWidth: 2,
        borderColor: colors.warning,
        alignItems: "center",
        justifyContent: "center",
    },
    creditText: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.warning,
    },
    payBtn: {
        flex: 2,
        height: 48,
        paddingVertical: 0,
    },
});
