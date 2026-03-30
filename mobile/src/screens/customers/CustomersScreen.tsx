import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    StatusBar,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";

const MOCK_CUSTOMERS = [
    { id: "1", name: "Rahul Sharma", initial: "RS", balance: "₹ 1,250.00", lastTrans: "2 hours ago", initialColor: "#DBEAFE", phone: "9876543210" },
    { id: "2", name: "Amit Kumar", initial: "AK", balance: "₹ 500.00", lastTrans: "Yesterday", initialColor: "#FFEDD5", phone: "8765432109" },
    { id: "3", name: "Priya Singh", initial: "PS", balance: "₹ 0.00", lastTrans: "3 days ago", initialColor: "#F3E8FF", phone: "7654321098" },
    { id: "4", name: "Vikram Mehra", initial: "VM", balance: "₹ 8,420.00", lastTrans: "4 days ago", initialColor: "#DBEAFE", phone: "6543210987" },
    { id: "5", name: "Suresh Jain", initial: "SJ", balance: "₹ 12,150.00", lastTrans: "1 week ago", initialColor: "#FCE7F3", phone: "5432109876" },
];

export default function CustomersScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const [search, setSearch] = useState("");

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            
            <ScreenHeader 
                title="Customers"
                isMainTab={false}
                onNotificationPress={() => {}}
            />

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

            {/* Total Balance Card */}
            <View style={styles.summaryCard}>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>TOTAL OUTSTANDING UDHAR</Text>
                    <Text style={styles.cardValue}>₹ 45,800.00</Text>
                    <View style={styles.trendRow}>
                        <View style={styles.trendBadge}>
                            <Ionicons name="trending-up" size={12} color="#fff" />
                            <Text style={styles.trendText}>+12% from last month</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.cardIconBox}>
                    <Ionicons name="wallet-outline" size={64} color="rgba(255,255,255,0.15)" />
                </View>
            </View>

            {/* List Header */}
            <View style={styles.listHeader}>
                <Text style={styles.listCount}>CUSTOMER LIST (24)</Text>
                <TouchableOpacity style={styles.sortBtn}>
                    <Ionicons name="filter-outline" size={16} color={colors.primary} />
                    <Text style={styles.sortBtnText}>Sort</Text>
                </TouchableOpacity>
            </View>

            {/* Customer List */}
            <FlatList
                data={MOCK_CUSTOMERS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.listItem}>
                        <View style={[styles.avatar, { backgroundColor: item.initialColor }]}>
                            <Text style={styles.avatarText}>{item.initial}</Text>
                        </View>
                        <View style={styles.itemMain}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <View style={styles.itemSecondaryRow}>
                                <Text style={styles.itemPhone}>{item.phone}</Text>
                                <Text style={styles.bullet}>•</Text>
                                <Text style={styles.itemLastTrans}>{item.lastTrans}</Text>
                            </View>
                        </View>
                        <View style={styles.itemRight}>
                            <Text style={styles.itemBalance}>{item.balance}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* FAB - Floating Action Button */}
            <TouchableOpacity 
                style={styles.fab}
                onPress={() => navigation.navigate("AddCustomer")}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    syncedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ECFDF5",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: "#A7F3D0",
    },
    syncedText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#065F46",
    },
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
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
    },
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
    cardInfo: {
        flex: 1,
        zIndex: 1,
    },
    cardLabel: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    cardValue: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "800",
        marginVertical: 4,
    },
    trendRow: {
        flexDirection: "row",
        alignItems: "center",
    },
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
    trendText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "500",
    },
    cardIconBox: {
        position: "absolute",
        right: -10,
        bottom: -10,
        opacity: 0.8,
    },
    listHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    listCount: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.textSecondary,
        textTransform: "uppercase",
    },
    sortBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    sortBtnText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: "700",
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.tabBarOffset,
    },
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
    avatarText: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.primary,
    },
    itemMain: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    itemLastTrans: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    itemSecondaryRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    itemPhone: {
        fontSize: 12,
        color: colors.secondary,
        fontWeight: "500",
    },
    bullet: {
        fontSize: 12,
        color: colors.textSecondary,
        marginHorizontal: 4,
    },
    itemRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    itemBalance: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.error,
    },
    fab: {
        position: "absolute",
        right: 20,
        bottom: spacing.tabBarOffset + spacing.md,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
});
