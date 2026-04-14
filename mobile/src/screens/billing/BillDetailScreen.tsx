import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { getBillItems, Bill, BillItem } from "../../db/db";

const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

export default function BillDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const bill: Bill = route.params?.bill;
    const [items, setItems] = useState<BillItem[]>([]);

    useEffect(() => {
        if (bill?.id) {
            setItems(getBillItems(bill.id));
        }
    }, [bill?.id]);

    if (!bill) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.errorText}>Bill not found.</Text>
            </SafeAreaView>
        );
    }

    const isUdhar = bill.payment_mode === "udhar";

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bill Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                {/* Receipt Card */}
                <View style={styles.receiptCard}>
                    {/* Top — store / status */}
                    <View style={styles.receiptTop}>
                        <View style={styles.storeIconWrap}>
                            <Ionicons name="storefront-outline" size={28} color={colors.primary} />
                        </View>
                        <View style={[
                            styles.modeBadge,
                            { backgroundColor: isUdhar ? "#FEF9C3" : "#DCFCE7" },
                        ]}>
                            <Ionicons
                                name={isUdhar ? "wallet-outline" : "cash-outline"}
                                size={14}
                                color={isUdhar ? "#92400E" : "#166534"}
                            />
                            <Text style={[
                                styles.modeBadgeText,
                                { color: isUdhar ? "#92400E" : "#166534" },
                            ]}>
                                {isUdhar ? "Udhar" : "Cash"}
                            </Text>
                        </View>
                    </View>

                    {/* Amount */}
                    <Text style={styles.totalAmount}>₹{bill.total_amount.toFixed(2)}</Text>
                    <Text style={styles.dateText}>{formatDateTime(bill.bill_date)}</Text>

                    <View style={styles.divider} />

                    {/* Customer row */}
                    <View style={styles.infoRow}>
                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Customer</Text>
                        <Text style={styles.infoValue}>{bill.customer_name ?? "Walk-in"}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Total Items</Text>
                        <Text style={styles.infoValue}>{bill.total_items}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Payment</Text>
                        <Text style={[
                            styles.infoValue,
                            { color: isUdhar ? "#D97706" : colors.success },
                        ]}>
                            {isUdhar ? "Udhar (Credit)" : "Cash"}
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    {/* Bill ID */}
                    <Text style={styles.billId}>Bill ID: {bill.id.toUpperCase()}</Text>
                </View>

                {/* Items Section */}
                <Text style={styles.sectionTitle}>ITEMS IN THIS BILL</Text>

                <View style={styles.itemsCard}>
                    {items.length === 0 ? (
                        <Text style={styles.noItems}>No items found for this bill.</Text>
                    ) : (
                        items.map((item, index) => (
                            <View
                                key={item.id ?? index}
                                style={[
                                    styles.itemRow,
                                    index === items.length - 1 && { borderBottomWidth: 0 },
                                ]}
                            >
                                <View style={styles.itemLeft}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                        {item.product_name}
                                    </Text>
                                    <Text style={styles.itemMeta}>
                                        ₹{item.unit_price.toFixed(2)} × {item.qty}
                                    </Text>
                                </View>
                                <Text style={styles.itemTotal}>₹{item.line_total.toFixed(2)}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Grand Total Row */}
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                    <Text style={styles.grandTotalValue}>₹{bill.total_amount.toFixed(2)}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        height: 56,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    content: { padding: spacing.md, paddingBottom: 40 },
    receiptCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    receiptTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    storeIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.primary + "12",
        alignItems: "center",
        justifyContent: "center",
    },
    modeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    modeBadgeText: { fontSize: 13, fontWeight: "700" },
    totalAmount: {
        fontSize: 40,
        fontWeight: "800",
        color: colors.primary,
        marginBottom: 4,
    },
    dateText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6,
    },
    infoLabel: { flex: 1, fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
    infoValue: { fontSize: 14, fontWeight: "700", color: colors.text },
    billId: { fontSize: 11, color: colors.textSecondary, textAlign: "center", letterSpacing: 0.5 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    itemsCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        marginBottom: spacing.md,
    },
    noItems: { padding: spacing.md, color: colors.textSecondary, textAlign: "center" },
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    itemLeft: { flex: 1, marginRight: spacing.md },
    itemName: { fontSize: 15, fontWeight: "600", color: colors.text },
    itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    itemTotal: { fontSize: 15, fontWeight: "700", color: colors.text },
    grandTotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    grandTotalLabel: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
    grandTotalValue: { fontSize: 24, fontWeight: "800", color: "#fff" },
    errorText: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
});
