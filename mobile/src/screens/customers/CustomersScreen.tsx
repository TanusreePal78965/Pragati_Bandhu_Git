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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";
import FAB from "../../components/common/FAB";
import { getAllCustomers, Customer } from "../../db/db";

const AVATAR_COLORS = ["#DBEAFE", "#FFEDD5", "#F3E8FF", "#FCE7F3", "#DCFCE7", "#FEF9C3"];

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const formatCurrency = (amount: number) =>
    `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function CustomersScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState("");

    const loadCustomers = useCallback(() => {
        setCustomers(getAllCustomers());
    }, []);

    useFocusEffect(loadCustomers);

    const filtered = search.trim()
        ? customers.filter(
              (c) =>
                  c.name.toLowerCase().includes(search.toLowerCase()) ||
                  (c.phone ?? "").includes(search)
          )
        : customers;

    const totalUdhar = customers.reduce((sum, c) => sum + (c.udhar_balance ?? 0), 0);

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />

            <ScreenHeader title="Customers" isMainTab={false} onNotificationPress={() => {}} />

            {/* Search Box */}
            <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={20} color={colors.secondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name or phone number"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* Total Udhar Card */}
            <View style={styles.summaryCard}>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>TOTAL OUTSTANDING UDHAR</Text>
                    <Text style={styles.cardValue}>{formatCurrency(totalUdhar)}</Text>
                    <View style={styles.trendRow}>
                        <View style={styles.trendBadge}>
                            <Ionicons name="people-outline" size={12} color="#fff" />
                            <Text style={styles.trendText}>{customers.length} Customers</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.cardIconBox}>
                    <Ionicons name="wallet-outline" size={64} color="rgba(255,255,255,0.15)" />
                </View>
            </View>

            {/* List Header */}
            <View style={styles.listHeader}>
                <Text style={styles.listCount}>
                    CUSTOMER LIST ({filtered.length})
                </Text>
            </View>

            {/* Customer List */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.listItem}>
                        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.id) }]}>
                            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                        </View>
                        <View style={styles.itemMain}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <View style={styles.itemSecondaryRow}>
                                {item.phone ? (
                                    <>
                                        <Text style={styles.itemPhone}>{item.phone}</Text>
                                        <Text style={styles.bullet}>•</Text>
                                    </>
                                ) : null}
                                <Text style={styles.itemLastTrans}>
                                    Added {new Date(item.created_at).toLocaleDateString("en-IN")}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.itemRight}>
                            <Text
                                style={[
                                    styles.itemBalance,
                                    item.udhar_balance === 0 && styles.itemBalanceClear,
                                ]}
                            >
                                {formatCurrency(item.udhar_balance)}
                            </Text>
                            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={48} color={colors.border} />
                        <Text style={styles.emptyText}>No customers yet</Text>
                        <Text style={styles.emptySubText}>Tap + to add your first customer</Text>
                    </View>
                }
            />

            <FAB
                onPress={() => navigation.navigate("AddCustomer")}
                offsetTabBar={true}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.md,
        height: 52,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },
    summaryCard: {
        backgroundColor: colors.primary,
        margin: spacing.md,
        borderRadius: 16,
        padding: 24,
        flexDirection: "row",
        justifyContent: "space-between",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
        overflow: "hidden",
    },
    cardInfo: { flex: 1, zIndex: 1 },
    cardLabel: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    cardValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginVertical: 4 },
    trendRow: { flexDirection: "row", alignItems: "center" },
    trendBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
        alignSelf: "flex-start",
        marginTop: 4,
    },
    trendText: { color: "#fff", fontSize: 12, fontWeight: "500" },
    cardIconBox: { position: "absolute", right: -10, bottom: -10, opacity: 0.8 },
    listHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    listCount: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" },
    listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.tabBarOffset },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    avatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
    itemMain: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: "700", color: colors.text },
    itemSecondaryRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    itemPhone: { fontSize: 12, color: colors.secondary, fontWeight: "500" },
    bullet: { fontSize: 12, color: colors.textSecondary, marginHorizontal: 4 },
    itemLastTrans: { fontSize: 12, color: colors.textSecondary },
    itemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemBalance: { fontSize: 15, fontWeight: "700", color: colors.error },
    itemBalanceClear: { color: colors.success },
    emptyState: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.textSecondary, marginTop: spacing.md },
    emptySubText: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
});
