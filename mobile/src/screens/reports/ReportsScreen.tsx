import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getSalesByRange, getTopProducts, getRecentBills, ReportData, TopProduct, Bill } from "../../db/db";
import { getShopInfo, StoredShopInfo } from "../../utils/storage";

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
        upi_sales: 0,
        bill_count: 0,
    });
    const [priorReport, setPriorReport] = useState<ReportData | null>(null);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [recentBills, setRecentBills] = useState<Bill[]>([]);
    const [shopInfo, setShopInfo] = useState<StoredShopInfo | null>(null);
    const [exporting, setExporting] = useState(false);

    const getPriorRangeDates = (r: RangeKey): { from: string; to: string } => {
        const today = new Date();
        if (r === "today") {
            const d = new Date(today); d.setDate(today.getDate() - 1);
            const s = toISO(d); return { from: s, to: s };
        }
        if (r === "week") {
            const from = new Date(today); from.setDate(today.getDate() - 13);
            const to = new Date(today); to.setDate(today.getDate() - 7);
            return { from: toISO(from), to: toISO(to) };
        }
        // month: previous calendar month
        const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastOfPrev = new Date(firstOfThisMonth); lastOfPrev.setDate(0);
        const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
        return { from: toISO(firstOfPrev), to: toISO(lastOfPrev) };
    };

    const trendPercent = (current: number, prior: number): number | null => {
        if (prior === 0) return null;
        return Math.round(((current - prior) / prior) * 100);
    };

    const loadData = useCallback(() => {
        getShopInfo().then(info => setShopInfo(info));
        const { from, to } = getRangeDates(range);
        const current = getSalesByRange(from, to);
        setReport(current);
        const { from: pFrom, to: pTo } = getPriorRangeDates(range);
        setPriorReport(getSalesByRange(pFrom, pTo));
        setTopProducts(getTopProducts(from, to, 5));
        setRecentBills(getRecentBills(10));
    }, [range]);

    useFocusEffect(loadData);

    const generateReportHtml = () => {
        const { from, to } = getRangeDates(range);
        const shopName = shopInfo?.shopName ?? "My Shop";
        const ownerName = shopInfo?.ownerName ?? "";
        const phone = shopInfo?.phone ?? "";
        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
        });
        const periodLabel = RANGE_LABELS[range];
        const fromLabel = new Date(from).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const toLabel = new Date(to).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const dateRange = range === "today" ? fromLabel : `${fromLabel} – ${toLabel}`;

        const topProductsHtml = topProducts.length === 0
            ? `<tr><td colspan="4" style="padding:12px;color:#888;text-align:center;">No sales in this period</td></tr>`
            : topProducts.map((p, i) => `
                <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
                    <td style="padding:10px 12px;font-weight:700;color:${colors.primary};">#${i + 1}</td>
                    <td style="padding:10px 12px;font-weight:600;">${p.product_name}</td>
                    <td style="padding:10px 12px;text-align:center;">${p.total_qty} ${p.uom || ""}</td>
                    <td style="padding:10px 12px;text-align:right;font-weight:700;">${fmt(p.total_amount)}</td>
                </tr>`).join("");

        const recentBillsHtml = recentBills.length === 0
            ? `<tr><td colspan="4" style="padding:12px;color:#888;text-align:center;">No transactions yet</td></tr>`
            : recentBills.map((b, i) => `
                <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
                    <td style="padding:10px 12px;font-size:13px;">${formatDateTime(b.bill_date)}</td>
                    <td style="padding:10px 12px;font-weight:600;">${b.customer_name ?? "Walk-in"}</td>
                    <td style="padding:10px 12px;text-align:center;color:${b.payment_mode === "udhar" ? "#D97706" : b.payment_mode === "upi" ? "#7C3AED" : "#16a34a"};font-weight:700;">${b.payment_mode === "udhar" ? "Udhar" : b.payment_mode === "upi" ? "UPI" : "Cash"}</td>
                    <td style="padding:10px 12px;text-align:right;font-weight:700;">₹${b.total_amount.toFixed(2)}</td>
                </tr>`).join("");

        return `
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 28px; font-size: 14px; }
    h1 { font-size: 26px; color: ${colors.primary}; }
    h2 { font-size: 16px; font-weight: 700; color: #334155; margin: 28px 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    th { background: #f1f5f9; padding: 10px 12px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="border-bottom: 2px solid ${colors.primary}; padding-bottom: 20px; margin-bottom: 24px;">
    <h1>${shopName}</h1>
    ${ownerName ? `<p style="color:#64748b;margin-top:4px;">Proprietor: ${ownerName}</p>` : ""}
    ${phone ? `<p style="color:#64748b;margin-top:2px;">Contact: +91 ${phone}</p>` : ""}
    <div style="margin-top:16px;">
      <span style="background:${colors.primary}15;color:${colors.primary};font-weight:700;font-size:13px;padding:5px 14px;border-radius:20px;">
        Business Report — ${periodLabel}
      </span>
      <span style="color:#64748b;font-size:13px;margin-left:12px;">${dateRange}</span>
    </div>
  </div>

  <!-- Summary Stats -->
  <h2>Summary</h2>
  <table>
    <tbody>
      <tr><td style="padding:12px;font-weight:600;color:#64748b;">Total Sales</td><td style="padding:12px;text-align:right;font-size:20px;font-weight:800;color:${colors.primary};">${fmt(report.total_sales)}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:12px;font-weight:600;color:#64748b;">Net Profit</td><td style="padding:12px;text-align:right;font-size:20px;font-weight:800;color:#16a34a;">${fmt(report.net_profit)}</td></tr>
      <tr><td style="padding:12px;font-weight:600;color:#64748b;">Cash Sales</td><td style="padding:12px;text-align:right;font-weight:700;">${fmt(report.cash_sales)}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:12px;font-weight:600;color:#64748b;">UPI Payments</td><td style="padding:12px;text-align:right;font-weight:700;color:#7C3AED;">${fmt(report.upi_sales)}</td></tr>
      <tr><td style="padding:12px;font-weight:600;color:#64748b;">Udhar (Credit)</td><td style="padding:12px;text-align:right;font-weight:700;">${fmt(report.udhar_sales)}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:12px;font-weight:600;color:#64748b;">Total Bills</td><td style="padding:12px;text-align:right;font-weight:700;">${report.bill_count}</td></tr>
    </tbody>
  </table>

  <!-- Top Selling Products -->
  <h2>Top Selling Products</h2>
  <table>
    <thead><tr><th>#</th><th>Product</th><th style="text-align:center;">Units Sold</th><th style="text-align:right;">Revenue</th></tr></thead>
    <tbody>${topProductsHtml}</tbody>
  </table>

  <!-- Recent Transactions -->
  <h2>Recent Transactions</h2>
  <table>
    <thead><tr><th>Date & Time</th><th>Customer</th><th style="text-align:center;">Payment</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${recentBillsHtml}</tbody>
  </table>

  <!-- Footer -->
  <div style="margin-top:40px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:20px;">
    <p>Generated by Pragati Bandhu · ${generatedAt}</p>
    <p style="margin-top:4px;">Profit is calculated from purchase price vs selling price at time of report generation.</p>
  </div>
</body>
</html>`;
    };

    const handleExportPdf = async () => {
        if (report.bill_count === 0) {
            Alert.alert("No Data", "There are no transactions in this period to export.");
            return;
        }
        setExporting(true);
        try {
            const html = generateReportHtml();
            const { uri } = await Print.printToFileAsync({ html });
            const periodSlug = range === "today" ? "today" : range === "week" ? "this_week" : "this_month";
            const fileName = `pragati_bandhu_report_${periodSlug}_${new Date().getTime()}.pdf`;
            const newUri = uri.substring(0, uri.lastIndexOf("/") + 1) + fileName;
            await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle: `Share Report — ${RANGE_LABELS[range]}`,
                UTI: "com.adobe.pdf",
            });
        } catch (e) {
            Alert.alert("Export Failed", "Could not generate the PDF. Please try again.");
            console.error("PDF export error:", e);
        } finally {
            setExporting(false);
        }
    };

    const RANGE_LABELS: Record<RangeKey, string> = {
        today: "Today",
        week: "This Week",
        month: "This Month",
    };

    const priorLabel = range === "today" ? "yesterday" : range === "week" ? "prev week" : "prev month";

    const breakdownItems = [
        { label: "Cash Sales", value: fmt(report.cash_sales), icon: "cash-outline", color: colors.success },
        { label: "UPI Payments", value: fmt(report.upi_sales), icon: "phone-portrait-outline", color: "#7C3AED" },
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
                            {(() => {
                                const t = priorReport ? trendPercent(report.total_sales, priorReport.total_sales) : null;
                                if (t === null) return null;
                                return (
                                    <View style={[styles.trendPill, { backgroundColor: t >= 0 ? "#DCFCE7" : "#FEE2E2" }]}>
                                        <Ionicons name={t >= 0 ? "trending-up" : "trending-down"} size={11} color={t >= 0 ? colors.success : colors.error} />
                                        <Text style={[styles.trendPillText, { color: t >= 0 ? colors.success : colors.error }]}>
                                            {t >= 0 ? "+" : ""}{t}%
                                        </Text>
                                    </View>
                                );
                            })()}
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Net Profit</Text>
                            <Text style={[styles.statValue, { color: colors.success }]}>
                                {fmt(report.net_profit)}
                            </Text>
                            {(() => {
                                const t = priorReport ? trendPercent(report.net_profit, priorReport.net_profit) : null;
                                if (t === null) return null;
                                return (
                                    <View style={[styles.trendPill, { backgroundColor: t >= 0 ? "#DCFCE7" : "#FEE2E2" }]}>
                                        <Ionicons name={t >= 0 ? "trending-up" : "trending-down"} size={11} color={t >= 0 ? colors.success : colors.error} />
                                        <Text style={[styles.trendPillText, { color: t >= 0 ? colors.success : colors.error }]}>
                                            {t >= 0 ? "+" : ""}{t}%
                                        </Text>
                                    </View>
                                );
                            })()}
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
                                    <Text style={styles.productSales}>{item.total_qty} {item.uom || "units"} sold</Text>
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

                <TouchableOpacity
                    style={[styles.exportButton, exporting && { opacity: 0.7 }]}
                    onPress={handleExportPdf}
                    disabled={exporting}
                >
                    {exporting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="download-outline" size={20} color="#fff" />
                    )}
                    <Text style={styles.exportText}>
                        {exporting ? "Generating PDF..." : "Download PDF Report"}
                    </Text>
                </TouchableOpacity>
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
    trendPill: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
    trendPillText: { fontSize: 11, fontWeight: "700" },
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
