import React from "react";
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function HomeScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.shopIconContainer}>
                            <Ionicons name="storefront" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.shopTextContainer}>
                            <Text style={styles.shopName}>Pragati General Store</Text>
                            <View style={styles.syncStatus}>
                                <Ionicons name="cloud-done" size={14} color={colors.success} />
                                <Text style={styles.syncText}>SYNCED</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.notificationButton}>
                        <Ionicons name="notifications" size={26} color={colors.textSecondary} />
                        <View style={styles.notificationDot} />
                    </TouchableOpacity>
                </View>

                {/* Main Stats Section */}
                <View style={styles.mainStatsContainer}>
                    <View style={styles.salesCard}>
                        <View style={styles.salesHeader}>
                            <Text style={styles.salesLabel}>TODAY'S TOTAL SALES</Text>
                            <Ionicons name="cash-outline" size={40} color={colors.primary + "20"} style={styles.salesIconBg} />
                        </View>
                        <Text style={styles.salesValue}>₹ 12,450.00</Text>
                        <View style={styles.trendRow}>
                            <Ionicons name="trending-up" size={16} color={colors.success} />
                            <Text style={styles.trendText}>12% from yesterday</Text>
                        </View>
                    </View>

                    <View style={[styles.alertCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
                        <Text style={[styles.alertLabel, { color: '#B45309' }]}>ATTENTION REQUIRED</Text>
                        <View style={styles.alertMain}>
                            <View>
                                <Text style={styles.alertValue}>5 Items</Text>
                                <Text style={styles.alertSub}>Running Low on Stock</Text>
                            </View>
                            <TouchableOpacity style={styles.alertAction}>
                                <Text style={styles.alertActionText}>Restock</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Quick Actions Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                </View>

                <TouchableOpacity 
                    style={styles.primaryAction}
                    onPress={() => navigation.navigate("NewBill")}
                >
                    <Ionicons name="cart-outline" size={24} color="#fff" />
                    <Text style={styles.primaryActionText}>Create New Bill</Text>
                </TouchableOpacity>

                <View style={styles.secondaryActionsRow}>
                    <TouchableOpacity style={styles.secondaryActionCard}>
                        <View style={[styles.secondaryActionIcon, { backgroundColor: colors.primary + "10" }]}>
                            <Ionicons name="cube-outline" size={24} color={colors.primary} />
                        </View>
                        <Text style={styles.secondaryActionText}>Inventory</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryActionCard}>
                        <View style={[styles.secondaryActionIcon, { backgroundColor: '#EEF2FF' }]}>
                            <Ionicons name="people-outline" size={24} color="#4F46E5" />
                        </View>
                        <Text style={styles.secondaryActionText}>Customers</Text>
                    </TouchableOpacity>
                </View>

                {/* AI Reorder Suggestions Section */}
                <View style={styles.aiSection}>
                    <View style={styles.aiHeader}>
                        <View style={styles.aiTitleRow}>
                            <Ionicons name="sparkles" size={18} color={colors.primary} />
                            <Text style={styles.aiTitle}>AI Reorder Insights</Text>
                        </View>
                        <TouchableOpacity>
                            <Text style={styles.aiViewAll}>View Suggestions</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.aiCard}>
                        <Text style={styles.aiMessage}>
                            "Paracetamol 500mg" is selling 3x faster this week. Reorder at
                            least 50 strips to avoid stockout by Friday.
                        </Text>
                        <View style={styles.aiFooter}>
                            <View style={styles.aiBadge}>
                                <Text style={styles.aiBadgeText}>URGENT</Text>
                            </View>
                            <Text style={styles.aiTime}>2h ago</Text>
                        </View>
                    </View>
                </View>

                {/* Recent Activity Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.activityList}>
                    <View style={styles.activityItem}>
                        <View style={[styles.activityIcon, { backgroundColor: '#DCFCE7' }]}>
                            <Ionicons name="receipt-outline" size={20} color={colors.success} />
                        </View>
                        <View style={styles.activityContent}>
                            <Text style={styles.activityTitle}>Sold 5 items to Rahul S.</Text>
                            <Text style={styles.activitySubtitle}>10:45 AM • Bill #PB-1024</Text>
                        </View>
                        <Text style={styles.activityAmount}>₹ 850.00</Text>
                    </View>

                    <View style={styles.activityItem}>
                        <View style={[styles.activityIcon, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="wallet-outline" size={20} color="#D97706" />
                        </View>
                        <View style={styles.activityContent}>
                            <Text style={styles.activityTitle}>Stock Updated</Text>
                            <Text style={styles.activitySubtitle}>09:15 AM • 10kg Rice added</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: spacing.lg,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    shopIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    shopTextContainer: {
        justifyContent: "center",
    },
    shopName: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    syncStatus: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
    },
    syncText: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.success,
        letterSpacing: 0.5,
    },
    notificationButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    notificationDot: {
        position: "absolute",
        top: 10,
        right: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#EF4444",
        borderWidth: 2,
        borderColor: "#fff",
    },
    mainStatsContainer: {
        gap: spacing.md,
    },
    salesCard: {
        backgroundColor: "#fff",
        borderRadius: spacing.roundness,
        padding: spacing.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.border,
    },
    salesHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    salesLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    salesIconBg: {
        position: "absolute",
        right: 0,
        top: 0,
    },
    salesValue: {
        fontSize: 32,
        fontWeight: "800",
        color: colors.primary,
        marginVertical: spacing.sm,
    },
    trendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    trendText: {
        fontSize: 12,
        color: colors.success,
        fontWeight: "600",
    },
    alertCard: {
        borderRadius: spacing.roundness,
        padding: spacing.lg,
        borderWidth: 1,
        borderStyle: "dashed",
    },
    alertLabel: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.5,
        marginBottom: spacing.sm,
    },
    alertMain: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    alertValue: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1E293B",
    },
    alertSub: {
        fontSize: 13,
        color: "#64748B",
        marginTop: 2,
    },
    alertAction: {
        backgroundColor: "#B45309",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    alertActionText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: spacing.xl,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    seeAll: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: "700",
    },
    primaryAction: {
        backgroundColor: colors.primary,
        borderRadius: spacing.roundness,
        paddingVertical: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    primaryActionText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    secondaryActionsRow: {
        flexDirection: "row",
        gap: spacing.md,
        marginTop: spacing.md,
    },
    secondaryActionCard: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: spacing.roundness,
        padding: spacing.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    secondaryActionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
    secondaryActionText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
    },
    aiSection: {
        marginTop: spacing.xl,
    },
    aiHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    aiTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    aiTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.text,
    },
    aiViewAll: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: "600",
    },
    aiCard: {
        backgroundColor: "#EEF2FF",
        borderRadius: spacing.roundness,
        padding: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    aiMessage: {
        fontSize: 15,
        color: "#1E293B",
        lineHeight: 22,
        fontWeight: "500",
    },
    aiFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: spacing.md,
    },
    aiBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    aiBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
    },
    aiTime: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    activityList: {
        backgroundColor: "#fff",
        borderRadius: spacing.roundness,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
    },
    activityItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    activityContent: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
    },
    activitySubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    activityAmount: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.text,
    },
});
