import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getSalesByRange, getTopProducts, getRecentBills, ReportData, TopProduct, Bill } from "../../db/db";

type RangeKey = "today" | "week" | "month";

const toISO = (d: Date) => d.toISOString().split("T")[0];

const getRangeDates = (range: RangeKey): { from: string; to: string } => {
    const today = new Date();
    const to = toISO(today);
    if (range === "today") return { from: to, to };
    if (range === "week") {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { from: toISO(from), to };
    }
    const from = new Date(today);
    from.setDate(1);
    return { from: toISO(from), to };
};

const fmt = (n: number) => `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const toUtcDate = (dateStr: string) =>
    new Date(dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z');

const formatDateTime = (dateStr: string) => {
    const d = toUtcDate(dateStr);
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
};

export default function ReportsScreen() {
    const navigation = useNavigation<any>();
    const [range, setRange] = useState<RangeKey>("today");
    const [report, setReport] = useState<ReportData>({
        total_sales: 0,
        net_profit: 0,
        cash_sales: 0,
        udhar_sales: 0,
        bill_count: 0,
    });
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [recentBills, setRecentBills] = useState<Bill[]>([]);

    const loadData = useCallback(() => {
        const { from, to } = getRangeDates(range);
        setReport(getSalesByRange(from, to));
        setTopProducts(getTopProducts(from, to, 5));
        setRecentBills(getRecentBills(10));
    }, [range]);

    useFocusEffect(loadData);

    const RANGE_LABELS: Record<RangeKey, string> = {
        today: "Today",
        week: "This Week",
        month: "This Month",
    };

    const breakdownItems = [
        { label: "Cash Sales", value: fmt(report.cash_sales), icon: "cash-outline", color: colors.success },
        { label: "Udhar (Credit)", value: fmt(report.udhar_sales), icon: "wallet-outline", color: colors.warning },
        { label: "Total Bills", value: String(report.bill_count), icon: "receipt-outline", color: colors.primary },
    ];

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Business Reports" isMainTab={false} onNotificationPress={() => { }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Time Range Selector */}
                <View style={styles.rangeSelector}>
                    {(["today", "week", "month"] as RangeKey[]).map((r) => (
                        <TouchableOpacity
                            key={r}
                            style={[styles.chip, range === r && styles.activeChip]}
                            onPress={() => setRange(r)}
                        >
                            <Text style={[styles.chipText, range === r && styles.activeChipText]}>
                                {RANGE_LABELS[r]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Main Stats Card */}
                <View style={styles.statsCard}>
                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Sales</Text>
                            <Text style={styles.statValue}>{fmt(report.total_sales)}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Est. Profit</Text>
                            <Text style={[styles.statValue, { color: colors.success }]}>
                                {fmt(report.net_profit)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Detailed Breakdown */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Detailed Breakdown</Text>
                </View>

                <View style={styles.breakdownList}>
                    {breakdownItems.map((item, index) => (
                        <View
                            key={index}
                            style={[
                                styles.breakdownItem,
                                index === breakdownItems.length - 1 && { borderBottomWidth: 0 },
                            ]}
                        >
                            <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>
                            <Text style={styles.itemLabel}>{item.label}</Text>
                            <Text style={styles.itemValue}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                {/* Top Products */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Selling Products</Text>
                </View>

                {topProducts.length === 0 ? (
                    <View style={styles.emptyProducts}>
                        <Ionicons name="bar-chart-outline" size={40} color={colors.border} />
                        <Text style={styles.emptyProductsText}>
                            No sales data for {RANGE_LABELS[range].toLowerCase()}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.breakdownList}>
                        {topProducts.map((item, index) => (
                            <View
                                key={item.product_id}
                                style={[
                                    styles.productRow,
                                    index === topProducts.length - 1 && { borderBottomWidth: 0 },
                                ]}
                            >
                                <View style={styles.productRank}>
                                    <Text style={styles.productRankText}>#{index + 1}</Text>
                                </View>
                                <View style={styles.productInfo}>
                                    <Text style={styles.productName} numberOfLines={1}>
                                        {item.product_name}
                                    </Text>
                                    <Text style={styles.productSales}>{item.total_qty} units sold</Text>
                                </View>
                                <Text style={styles.productAmount}>{fmt(item.total_amount)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Recent Transactions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Bills")}>
                        <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                {recentBills.length === 0 ? (
                    <View style={styles.emptyTransactions}>
                        <Ionicons name="receipt-outline" size={36} color={colors.border} />
                        <Text style={styles.emptyTransactionsText}>No transactions yet</Text>
                    </View>
                ) : (
                    <View style={styles.breakdownList}>
                        {recentBills.map((bill, index) => (
                            <TouchableOpacity
                                key={bill.id}
                                style={[
                                    styles.transactionRow,
                                    index === recentBills.length - 1 && { borderBottomWidth: 0 },
                                ]}
                                onPress={() => navigation.navigate("BillDetail", { bill })}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    styles.txIcon,
                                    { backgroundColor: bill.payment_mode === "udhar" ? "#FEF3C7" : "#DCFCE7" },
                                ]}>
                                    <Ionicons
                                        name={bill.payment_mode === "udhar" ? "wallet-outline" : "cash-outline"}
                                        size={18}
                                        color={bill.payment_mode === "udhar" ? "#D97706" : colors.success}
                                    />
                                </View>
                                <View style={styles.txInfo}>
                                    <Text style={styles.txName} numberOfLines={1}>
                                        {bill.customer_name ?? "Walk-in Customer"}
                                    </Text>
                                    <Text style={styles.txMeta}>
                                        {formatDateTime(bill.bill_date)} · {bill.total_items} item{bill.total_items !== 1 ? "s" : ""} · {bill.payment_mode === "udhar" ? "Udhar" : "Cash"}
                                    </Text>
                                </View>
                                <View style={styles.txRight}>
                                    <Text style={styles.txAmount}>₹{bill.total_amount.toFixed(2)}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <TouchableOpacity
                    style={styles.viewAllBtn}
                    onPress={() => navigation.navigate("Bills")}
                >
                    <Ionicons name="list-outline" size={18} color={colors.primary} />
                    <Text style={styles.viewAllBtnText}>View All Transactions</Text>
                </TouchableOpacity>

                {/* <TouchableOpacity
                    style={styles.exportButton}
                    onPress={() => Alert.alert("Coming Soon", "PDF export will be available in a future update.")}
                >
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.exportText}>Download PDF Report</Text>
                </TouchableOpacity> */}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.tabBarOffset },
    rangeSelector: { flexDirection: "row", gap: 8, marginVertical: spacing.lg },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
    activeChipText: { color: "#fff" },
    statsCard: {
        backgroundColor: colors.surface,
        borderRadius: spacing.roundness,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statRow: { flexDirection: "row", alignItems: "center" },
    statItem: { flex: 1, alignItems: "center" },
    divider: { width: 1, height: 48, backgroundColor: colors.border },
    statLabel: { fontSize: 12, fontWeight: "500", color: colors.textSecondary, textTransform: "uppercase" },
    statValue: { fontSize: typography.sizes.xxl, fontWeight: "800", color: colors.text, marginTop: 4 },
    sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.text },
    breakdownList: {
        backgroundColor: colors.surface,
        borderRadius: spacing.roundness,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
    },
    breakdownItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
    itemLabel: { flex: 1, fontSize: typography.sizes.md, fontWeight: "600", color: colors.text },
    itemValue: { fontSize: typography.sizes.md, fontWeight: "700", color: colors.text },
    productRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    productRank: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary + "15",
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.sm,
    },
    productRankText: { fontSize: 11, fontWeight: "800", color: colors.primary },
    productInfo: { flex: 1 },
    productName: { fontSize: typography.sizes.md, fontWeight: "600", color: colors.text },
    productSales: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: 2 },
    productAmount: { fontSize: typography.sizes.md, fontWeight: "700", color: colors.text },
    emptyProducts: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
    emptyProductsText: { fontSize: 14, color: colors.textSecondary },
    viewAll: { fontSize: 13, fontWeight: "700", color: colors.primary },
    emptyTransactions: { alignItems: "center", paddingVertical: spacing.xl, gap: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    emptyTransactionsText: { fontSize: 14, color: colors.textSecondary },
    transactionRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginRight: 12 },
    txInfo: { flex: 1 },
    txName: { fontSize: 14, fontWeight: "700", color: colors.text },
    txMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    txRight: { alignItems: "flex-end", gap: 2 },
    txAmount: { fontSize: 14, fontWeight: "800", color: colors.primary },
    viewAllBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary,
        marginTop: spacing.sm,
        marginBottom: spacing.md,
    },
    viewAllBtnText: { fontSize: 14, fontWeight: "700", color: colors.primary },
    exportButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: spacing.roundness,
        marginTop: spacing.xxl,
        gap: 8,
    },
    exportText: { color: "#fff", fontSize: typography.sizes.md, fontWeight: "700" },
});
