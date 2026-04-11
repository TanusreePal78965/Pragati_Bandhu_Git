import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import { getAllBills, Bill } from "../../db/db";

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const BillCard = ({ bill, onPress }: { bill: Bill; onPress: () => void }) => (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.cardLeft}>
            <View style={[
                styles.modeIcon,
                { backgroundColor: bill.payment_mode === "udhar" ? "#FEF3C7" : "#DCFCE7" },
            ]}>
                <Ionicons
                    name={bill.payment_mode === "udhar" ? "wallet-outline" : "cash-outline"}
                    size={20}
                    color={bill.payment_mode === "udhar" ? "#D97706" : colors.success}
                />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.customerName} numberOfLines={1}>
                    {bill.customer_name ?? "Walk-in Customer"}
                </Text>
                <Text style={styles.meta}>
                    {formatDate(bill.bill_date)} · {formatTime(bill.bill_date)}
                </Text>
                <View style={styles.tagRow}>
                    <View style={[
                        styles.tag,
                        { backgroundColor: bill.payment_mode === "udhar" ? "#FEF9C3" : "#DCFCE7" },
                    ]}>
                        <Text style={[
                            styles.tagText,
                            { color: bill.payment_mode === "udhar" ? "#92400E" : "#166534" },
                        ]}>
                            {bill.payment_mode === "udhar" ? "Udhar" : "Cash"}
                        </Text>
                    </View>
                    <Text style={styles.itemCount}>{bill.total_items} item{bill.total_items !== 1 ? "s" : ""}</Text>
                </View>
            </View>
        </View>
        <View style={styles.cardRight}>
            <Text style={styles.amount}>₹{bill.total_amount.toFixed(2)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
    </TouchableOpacity>
);

export default function BillsScreen() {
    const navigation = useNavigation<any>();
    const [bills, setBills] = useState<Bill[]>([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "cash" | "udhar">("all");

    useFocusEffect(
        useCallback(() => {
            setBills(getAllBills());
        }, [])
    );

    const filtered = bills.filter((b) => {
        const matchesFilter = filter === "all" || b.payment_mode === filter;
        const matchesSearch =
            !search.trim() ||
            (b.customer_name ?? "").toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const totalShown = filtered.reduce((sum, b) => sum + b.total_amount, 0);

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="All Transactions" showBack={true} />

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by customer name..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={colors.textSecondary}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch("")}>
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter chips */}
            <View style={styles.filterRow}>
                {(["all", "cash", "udhar"] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, filter === f && styles.filterChipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                            {f === "all" ? "All" : f === "cash" ? "Cash" : "Udhar"}
                        </Text>
                    </TouchableOpacity>
                ))}
                <View style={styles.filterSpacer} />
                <Text style={styles.totalLabel}>
                    {filtered.length} bills · ₹{totalShown.toFixed(0)}
                </Text>
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <BillCard
                        bill={item}
                        onPress={() => navigation.navigate("BillDetail", { bill: item })}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="receipt-outline" size={52} color={colors.border} />
                        <Text style={styles.emptyText}>No transactions found</Text>
                        <Text style={styles.emptySubText}>Bills you create will appear here</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        height: 46,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text },
    filterRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    filterChipTextActive: { color: "#fff" },
    filterSpacer: { flex: 1 },
    totalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    list: { paddingHorizontal: spacing.md, paddingBottom: 32 },
    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    modeIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    cardInfo: { flex: 1 },
    customerName: { fontSize: 15, fontWeight: "700", color: colors.text },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    tagRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    tagText: { fontSize: 11, fontWeight: "700" },
    itemCount: { fontSize: 12, color: colors.textSecondary },
    cardRight: { alignItems: "flex-end", gap: 4 },
    amount: { fontSize: 16, fontWeight: "800", color: colors.primary },
    empty: { alignItems: "center", paddingTop: 80, gap: 8 },
    emptyText: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.textSecondary },
    emptySubText: { fontSize: typography.sizes.sm, color: colors.textSecondary },
});
