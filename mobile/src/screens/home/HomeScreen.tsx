import React, { useState, useCallback } from "react";
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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getTodaySales, getLowStockProducts, getAllProducts, getRecentBills, getShop, getSalesByRange, Bill, Product } from "../../db/db";
import { toUtcDate } from "../../utils/dateUtils";

import { haptics } from "../../utils/haptics";

export default function HomeScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [todaySales, setTodaySales] = useState({ total: 0, count: 0 });
    const [salesTrend, setSalesTrend] = useState<number | null>(null);
    const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [recentBills, setRecentBills] = useState<Bill[]>([]);
    const [hasAiConsent, setHasAiConsent] = useState(false);

    const getIsoDate = (d: Date) => d.toISOString().split("T")[0];

    const loadData = useCallback(() => {
        const todayData = getTodaySales();
        setTodaySales(todayData);

        // Trend: compare today vs yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yDate = getIsoDate(yesterday);
        const yesterdayData = getSalesByRange(yDate, yDate);
        if (yesterdayData.total_sales > 0) {
            const pct = ((todayData.total - yesterdayData.total_sales) / yesterdayData.total_sales) * 100;
            setSalesTrend(Math.round(pct));
        } else if (todayData.total > 0) {
            setSalesTrend(null); // new sales with no yesterday baseline — don't show %
        } else {
            setSalesTrend(null);
        }

        setLowStockItems(getLowStockProducts());
        setTotalProducts(getAllProducts().length);
        setRecentBills(getRecentBills(5));
        const shop = getShop();
        setHasAiConsent(shop?.aiConsent === true);
    }, []);

    useFocusEffect(loadData);

    const formatCurrency = (amount: number) =>
        `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const formatTime = (dateStr: string) => {
        const d = toUtcDate(dateStr);
        return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Dashboard" isMainTab={false} onNotificationPress={() => { }} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"
            >
                {/* Main Stats Section */}
                <View style={styles.mainStatsContainer}>
                    <View style={styles.salesCard}>
                        <View style={styles.salesHeader}>
                            <Text style={styles.salesLabel}>TODAY'S TOTAL SALES</Text>
                            <Ionicons name="cash-outline" size={32} color={colors.primary + "20"} style={styles.salesIconBg} />
                        </View>
                        <Text style={styles.salesValue}>{formatCurrency(todaySales.total)}</Text>
                        <View style={styles.trendRow}>
                            <Ionicons name="receipt-outline" size={14} color={colors.success} />
                            <Text style={styles.trendText}>{todaySales.count} bill{todaySales.count !== 1 ? "s" : ""} today</Text>
                            {salesTrend !== null && (
                                <View style={[
                                    styles.trendBadge,
                                    { backgroundColor: salesTrend >= 0 ? "#DCFCE7" : "#FEE2E2" },
                                ]}>
                                    <Ionicons
                                        name={salesTrend >= 0 ? "trending-up" : "trending-down"}
                                        size={12}
                                        color={salesTrend >= 0 ? colors.success : colors.error}
                                    />
                                    <Text style={[
                                        styles.trendBadgeText,
                                        { color: salesTrend >= 0 ? colors.success : colors.error },
                                    ]}>
                                        {salesTrend >= 0 ? "+" : ""}{salesTrend}% vs yesterday
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {totalProducts === 0 ? (
                        <View style={[styles.alertCard, { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }]}>
                            <Text style={[styles.alertLabel, { color: "#64748B" }]}>STOCK STATUS</Text>
                            <View style={styles.alertMain}>
                                <View>
                                    <Text style={[styles.alertValue, { color: "#64748B" }]}>No Products</Text>
                                    <Text style={styles.alertSub}>Add products to track stock</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.alertAction}
                                    onPress={() => {
                                        haptics.medium();
                                        navigation.navigate("AddProduct");
                                    }}
                                >
                                    <Text style={styles.alertActionText}>Add Stock</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : lowStockItems.length > 0 ? (
                        <View style={[styles.alertCard, { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" }]}>
                            <Text style={[styles.alertLabel, { color: "#B45309" }]}>ATTENTION REQUIRED</Text>
                            <View style={styles.alertMain}>
                                <View>
                                    <Text style={styles.alertValue}>{lowStockItems.length} Items</Text>
                                    <Text style={styles.alertSub}>Running Low on Stock</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.alertAction}
                                    onPress={() => {
                                        haptics.medium();
                                        navigation.navigate("Inventory");
                                    }}
                                >
                                    <Text style={styles.alertActionText}>Restock</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.alertCard, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                            <Text style={[styles.alertLabel, { color: "#065F46" }]}>ALL GOOD</Text>
                            <View style={styles.alertMain}>
                                <View>
                                    <Text style={[styles.alertValue, { color: colors.success }]}>
                                        Stock OK
                                    </Text>
                                    <Text style={styles.alertSub}>No low stock items</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                            </View>
                        </View>
                    )}
                </View>

                {/* Quick Actions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                </View>

                <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() => {
                        haptics.medium();
                        navigation.navigate("NewBill");
                    }}
                >
                    <Ionicons name="cart-outline" size={20} color="#fff" />
                    <Text style={styles.primaryActionText}>Create New Bill</Text>
                </TouchableOpacity>

                <View style={styles.secondaryActionsRow}>
                    <TouchableOpacity
                        style={styles.secondaryActionCard}
                        onPress={() => navigation.navigate("Inventory")}
                    >
                        <View style={[styles.secondaryActionIcon, { backgroundColor: colors.primary + "10" }]}>
                            <Ionicons name="cube-outline" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.secondaryActionText}>Inventory</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.secondaryActionCard}
                        onPress={() => navigation.navigate("Customers")}
                    >
                        <View style={[styles.secondaryActionIcon, { backgroundColor: "#EEF2FF" }]}>
                            <Ionicons name="people-outline" size={20} color="#4F46E5" />
                        </View>
                        <Text style={styles.secondaryActionText}>Customers</Text>
                    </TouchableOpacity>
                </View>

                {/* Low Stock / AI Reorder Section — shown to all users, branded correctly per consent */}
                <View style={styles.aiSection}>
                    <View style={styles.aiHeader}>
                        <View style={styles.aiTitleRow}>
                            {hasAiConsent ? (
                                <>
                                    <Ionicons name="sparkles" size={18} color={colors.primary} />
                                    <Text style={styles.aiTitle}>AI Reorder Insights</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="alert-circle-outline" size={18} color="#D97706" />
                                    <Text style={[styles.aiTitle, { color: "#92400E" }]}>Low Stock Alerts</Text>
                                </>
                            )}
                        </View>
                    </View>

                    {lowStockItems.length > 0 ? (
                        lowStockItems.slice(0, 2).map((item) => (
                            <View
                                key={item.id}
                                style={[
                                    styles.aiCard,
                                    !hasAiConsent && { backgroundColor: "#FFFBEB", borderLeftColor: "#D97706" },
                                ]}
                            >
                                <Text style={styles.aiMessage}>
                                    "{item.name}" is low on stock ({item.stock_quantity} left, threshold: {item.min_stock_threshold}). Consider restocking soon.
                                </Text>
                                <View style={styles.aiFooter}>
                                    <View style={[
                                        styles.aiBadge,
                                        item.stock_quantity === 0 && { backgroundColor: colors.error },
                                        !hasAiConsent && item.stock_quantity > 0 && { backgroundColor: "#D97706" },
                                    ]}>
                                        <Text style={styles.aiBadgeText}>
                                            {item.stock_quantity === 0 ? "OUT OF STOCK" : "LOW STOCK"}
                                        </Text>
                                    </View>
                                    <Text style={styles.aiTime}>{item.uom}</Text>
                                </View>
                            </View>
                        ))
                    ) : totalProducts === 0 ? (
                        <View style={styles.aiCard}>
                            <Text style={styles.aiMessage}>
                                Add products to your inventory to start seeing {hasAiConsent ? "AI reorder insights" : "low stock alerts"} here.
                            </Text>
                            <View style={styles.aiFooter}>
                                <View style={[styles.aiBadge, { backgroundColor: "#64748B" }]}>
                                    <Text style={styles.aiBadgeText}>NO PRODUCTS</Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.aiCard}>
                            <Text style={styles.aiMessage}>
                                {hasAiConsent
                                    ? "All products have sufficient stock. AI suggestions will appear here when stock runs low."
                                    : "All products have sufficient stock. You will be alerted here when any item runs low."}
                            </Text>
                            <View style={styles.aiFooter}>
                                <View style={[styles.aiBadge, { backgroundColor: colors.success }]}>
                                    <Text style={styles.aiBadgeText}>ALL GOOD</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Upgrade nudge for local-only users */}
                    {!hasAiConsent && lowStockItems.length > 0 && (
                        <View style={styles.upgradeNudge}>
                            <Ionicons name="information-circle-outline" size={15} color="#1d4ed8" />
                            <Text style={styles.upgradeNudgeText}>
                                Enable Cloud Backup in Settings to get AI-powered reorder quantity suggestions.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Recent Activity */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>RECENT SALES</Text>
                </View>

                {recentBills.length === 0 ? (
                    <View style={styles.emptyActivity}>
                        <Text style={styles.emptyActivityText}>No bills yet. Create your first bill!</Text>
                    </View>
                ) : (
                    <View style={styles.activityList}>
                        {recentBills.map((bill) => (
                            <TouchableOpacity
                                key={bill.id}
                                style={styles.activityItem}
                                onPress={() => navigation.navigate("BillDetail", { bill })}
                            >
                                <View
                                    style={[
                                        styles.activityIcon,
                                        {
                                            backgroundColor:
                                                bill.payment_mode === "udhar" ? "#FEF3C7"
                                                : bill.payment_mode === "upi" ? "#F5F3FF"
                                                : "#DCFCE7",
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={bill.payment_mode === "udhar" ? "wallet-outline" : bill.payment_mode === "upi" ? "phone-portrait-outline" : "receipt-outline"}
                                        size={20}
                                        color={bill.payment_mode === "udhar" ? "#D97706" : bill.payment_mode === "upi" ? "#7C3AED" : colors.success}
                                    />
                                </View>
                                <View style={styles.activityContent}>
                                    <Text style={styles.activityTitle}>
                                        {bill.customer_name
                                            ? `Bill for ${bill.customer_name}`
                                            : "Walk-in Customer"}
                                    </Text>
                                    <Text style={styles.activitySubtitle}>
                                        {formatTime(bill.bill_date)} · {bill.total_items} items ·{" "}
                                        {bill.payment_mode === "udhar" ? "Udhar" : bill.payment_mode === "upi" ? "UPI" : "Cash"}
                                    </Text>
                                </View>
                                <Text style={styles.activityAmount}>
                                    ₹{bill.total_amount.toFixed(2)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.tabBarOffset },
    mainStatsContainer: { gap: 8, marginTop: 6 },
    salesCard: {
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    salesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    salesLabel: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, letterSpacing: 0.5 },
    salesIconBg: { position: "absolute", right: 0, top: 0 },
    salesValue: { fontSize: 22, fontWeight: "800", color: colors.primary, marginVertical: 2 },
    trendRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
    trendText: { fontSize: 11, color: colors.success, fontWeight: "600" },
    trendBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
    trendBadgeText: { fontSize: 10, fontWeight: "700" },
    alertCard: { borderRadius: 10, padding: 10, borderWidth: 1, borderStyle: "dashed" },
    alertLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
    alertMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    alertValue: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
    alertSub: { fontSize: 12, color: "#64748B", marginTop: 1 },
    alertAction: { backgroundColor: "#B45309", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    alertActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 4 },
    sectionTitle: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.5 },
    primaryAction: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    primaryActionText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    secondaryActionsRow: { flexDirection: "row", gap: 8, marginTop: 6 },
    secondaryActionCard: { 
        flex: 1, 
        backgroundColor: colors.surface, 
        borderRadius: 10, 
        padding: 8, 
        alignItems: "center", 
        borderWidth: 1, 
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    secondaryActionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    secondaryActionText: { fontSize: 13, fontWeight: "600", color: colors.text },
    aiSection: { marginTop: 10 },
    aiHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    aiTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    aiCard: { backgroundColor: "#EEF2FF", borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary, marginBottom: 6 },
    aiMessage: { fontSize: 13, color: "#1E293B", lineHeight: 18, fontWeight: "500" },
    aiFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    aiBadge: { backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    aiBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
    aiTime: { fontSize: 11, color: colors.textSecondary },
    activityList: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    activityItem: { flexDirection: "row", alignItems: "center", padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    activityIcon: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 8 },
    activityContent: { flex: 1 },
    activityTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    activitySubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    activityAmount: { fontSize: 14, fontWeight: "700", color: colors.text },
    emptyActivity: { alignItems: "center", paddingVertical: 12 },
    emptyActivityText: { fontSize: 13, color: colors.textSecondary },
    upgradeNudge: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6,
        backgroundColor: "#EFF6FF",
        padding: 8,
        borderRadius: 6,
        marginTop: 6,
    },
    upgradeNudgeText: { flex: 1, fontSize: 11, color: "#1d4ed8", lineHeight: 16 },
});
