import React, { useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { getLowStockProducts, getAllCustomers, Product, Customer } from "../../db/db";

// ─── Notification item shape ──────────────────────────────────────────────────

type NotifType = "out_of_stock" | "low_stock" | "udhar_high" | "udhar_moderate";

interface NotifItem {
    id: string;
    type: NotifType;
    title: string;
    body: string;
    iconName: string;
    iconColor: string;
    bgColor: string;
    actionLabel?: string;
    onAction?: () => void;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
    const navigation = useNavigation<any>();
    const [notifications, setNotifications] = React.useState<NotifItem[]>([]);

    const buildNotifications = useCallback(() => {
        const items: NotifItem[] = [];

        // ── Low / Out of stock products ────────────────────────────────────────
        const lowStock = getLowStockProducts();
        const outOfStock = lowStock.filter((p) => p.stock_quantity === 0);
        const belowThreshold = lowStock.filter((p) => p.stock_quantity > 0);

        outOfStock.forEach((p: Product) => {
            items.push({
                id: `oos_${p.id}`,
                type: "out_of_stock",
                title: "Out of Stock",
                body: `"${p.name}" has 0 units remaining. Restock immediately to avoid missing sales.`,
                iconName: "alert-circle",
                iconColor: "#DC2626",
                bgColor: "#FEF2F2",
                actionLabel: "Edit Product",
                onAction: () => navigation.navigate("EditProduct", { product: p }),
            });
        });

        belowThreshold.forEach((p: Product) => {
            items.push({
                id: `low_${p.id}`,
                type: "low_stock",
                title: "Low Stock",
                body: `"${p.name}" is running low — ${p.stock_quantity} ${p.uom} left (threshold: ${p.min_stock_threshold}).`,
                iconName: "warning",
                iconColor: "#D97706",
                bgColor: "#FFFBEB",
                actionLabel: "Edit Product",
                onAction: () => navigation.navigate("EditProduct", { product: p }),
            });
        });

        // ── High udhar customers ────────────────────────────────────────────────
        const customers = getAllCustomers().filter((c: Customer) => c.udhar_balance > 0);

        // Sort by balance descending, cap at top 10
        customers
            .sort((a: Customer, b: Customer) => b.udhar_balance - a.udhar_balance)
            .slice(0, 10)
            .forEach((c: Customer) => {
                const isHigh = c.udhar_balance >= 1000;
                items.push({
                    id: `udhar_${c.id}`,
                    type: isHigh ? "udhar_high" : "udhar_moderate",
                    title: isHigh ? "High Outstanding Udhar" : "Outstanding Udhar",
                    body: `${c.name} owes ₹ ${c.udhar_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}${c.phone ? ` · ${c.phone}` : ""}.`,
                    iconName: isHigh ? "wallet" : "wallet-outline",
                    iconColor: isHigh ? "#DC2626" : "#D97706",
                    bgColor: isHigh ? "#FFF1F2" : "#FFFBEB",
                    actionLabel: "Record Payment",
                    onAction: () => navigation.navigate("EditCustomer", { customerId: c.id }),
                });
            });

        setNotifications(items);
    }, []);

    useFocusEffect(buildNotifications);

    const renderItem = ({ item }: { item: NotifItem }) => (
        <View style={[styles.card, { backgroundColor: item.bgColor }]}>
            <View style={styles.cardLeft}>
                <View style={[styles.iconBox, { borderColor: item.iconColor + "40" }]}>
                    <Ionicons name={item.iconName as any} size={22} color={item.iconColor} />
                </View>
            </View>
            <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: item.iconColor }]}>{item.title}</Text>
                <Text style={styles.cardText}>{item.body}</Text>
                {item.actionLabel && item.onAction && (
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: item.iconColor }]} onPress={item.onAction}>
                        <Text style={[styles.actionBtnText, { color: item.iconColor }]}>{item.actionLabel}</Text>
                        <Ionicons name="chevron-forward" size={13} color={item.iconColor} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    // Group by type for section headers
    const outCount = notifications.filter((n) => n.type === "out_of_stock").length;
    const lowCount = notifications.filter((n) => n.type === "low_stock").length;
    const udharCount = notifications.filter((n) => n.type === "udhar_high" || n.type === "udhar_moderate").length;

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {notifications.length > 0 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{notifications.length}</Text>
                        </View>
                    )}
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Summary pills */}
            {notifications.length > 0 && (
                <View style={styles.pillRow}>
                    {outCount > 0 && (
                        <View style={[styles.pill, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                            <Ionicons name="alert-circle" size={13} color="#DC2626" />
                            <Text style={[styles.pillText, { color: "#DC2626" }]}>{outCount} Out of stock</Text>
                        </View>
                    )}
                    {lowCount > 0 && (
                        <View style={[styles.pill, { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" }]}>
                            <Ionicons name="warning" size={13} color="#D97706" />
                            <Text style={[styles.pillText, { color: "#D97706" }]}>{lowCount} Low stock</Text>
                        </View>
                    )}
                    {udharCount > 0 && (
                        <View style={[styles.pill, { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" }]}>
                            <Ionicons name="wallet-outline" size={13} color="#E11D48" />
                            <Text style={[styles.pillText, { color: "#E11D48" }]}>{udharCount} Udhar pending</Text>
                        </View>
                    )}
                </View>
            )}

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={styles.emptyIconBox}>
                            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                        </View>
                        <Text style={styles.emptyTitle}>All Clear!</Text>
                        <Text style={styles.emptySubtitle}>
                            No stock alerts or outstanding udhar right now.{"\n"}Check back after creating more bills.
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm,
        height: 56,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    countBadge: {
        backgroundColor: colors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
    },
    countBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },

    // Summary pills
    pillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    pillText: { fontSize: 12, fontWeight: "700" },

    // Notification list
    list: { padding: spacing.md, gap: 10 },

    // Card
    card: {
        flexDirection: "row",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.06)",
        gap: 12,
    },
    cardLeft: { paddingTop: 2 },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.7)",
        borderWidth: 1,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 },
    cardText: { fontSize: 14, color: "#374151", lineHeight: 20 },

    // Action button
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
        marginTop: 10,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: "rgba(255,255,255,0.6)",
    },
    actionBtnText: { fontSize: 12, fontWeight: "700" },

    // Empty state
    empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
    emptyIconBox: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#F0FDF4",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    emptyTitle: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
});
