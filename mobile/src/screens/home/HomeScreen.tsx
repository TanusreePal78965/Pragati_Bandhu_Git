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
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import SummaryCard from "../../components/home/SummaryCard";

const QuickAction = ({
    title,
    icon,
    onPress,
    color = colors.primary,
}: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    color?: string;
}) => (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
        <View style={[styles.actionIcon, { backgroundColor: color + "15" }]}>
            <Ionicons name={icon} size={28} color={color} />
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
);

export default function HomeScreen() {
    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header Section */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Namaste,</Text>
                        <Text style={styles.shopName}>Shubhadeep Retailers</Text>
                    </View>
                    <TouchableOpacity style={styles.profileButton}>
                        <Ionicons
                            name="person-circle-outline"
                            size={32}
                            color={colors.primary}
                        />
                    </TouchableOpacity>
                </View>

                {/* Dashboard Summary Title */}
                <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
                    <Text style={styles.sectionTitle}>Dashboard Summary</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAll}>View Details</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary Cards Grid */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryRow}>
                        <SummaryCard
                            title="TODAY'S SALES"
                            value="₹ 14,250"
                            icon="card-outline"
                            color={colors.success}
                            subtitle="+12% from yesterday"
                        />
                    </View>
                    <View style={styles.summaryRow}>
                        <SummaryCard
                            title="LOW STOCK ITEMS"
                            value="12 Products"
                            icon="warning-outline"
                            color={colors.error}
                            subtitle="Action required"
                        />
                    </View>
                    <View style={styles.summaryRow}>
                        <SummaryCard
                            title="PENDING UDHAR"
                            value="₹ 85,400"
                            icon="people-outline"
                            color={colors.warning}
                            subtitle="25 Customers"
                        />
                    </View>
                </View>

                {/* Quick Actions Title */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                </View>

                {/* Quick Actions Grid */}
                <View style={styles.actionsGrid}>
                    <QuickAction
                        title="New Bill"
                        icon="receipt-outline"
                        onPress={() => {}}
                    />
                    <QuickAction
                        title="Add Stock"
                        icon="add-circle-outline"
                        onPress={() => {}}
                        color={colors.success}
                    />
                    <QuickAction
                        title="AI Suggestions"
                        icon="sparkles-outline"
                        onPress={() => {}}
                        color="#A855F7"
                    />
                    <QuickAction
                        title="WhatsApp"
                        icon="logo-whatsapp"
                        onPress={() => {}}
                        color="#25D366"
                    />
                </View>

                {/* AI Suggestions Preview Section */}
                <View style={styles.aiCard}>
                    <View style={styles.aiHeader}>
                        <View style={styles.aiBadge}>
                            <Ionicons name="sparkles" size={12} color="#fff" />
                            <Text style={styles.aiBadgeText}>AI INSIGHT</Text>
                        </View>
                        <Text style={styles.aiTime}>Just now</Text>
                    </View>
                    <Text style={styles.aiMessage}>
                        "Paracetamol 500mg" is selling 3x faster this week. Reorder at
                        least 50 strips to avoid stockout by Friday.
                    </Text>
                    <TouchableOpacity style={styles.aiButton}>
                        <Text style={styles.aiButtonText}>Check Reorder Suggestions</Text>
                        <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Recent Billing Info Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Bills</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAll}>History</Text>
                    </TouchableOpacity>
                </View>

                {/* Mock Recent Items */}
                <View style={styles.list}>
                    {[1, 2, 3].map((item) => (
                        <View key={item} style={styles.listItem}>
                            <View style={styles.listIcon}>
                                <Ionicons name="document-text" size={20} color={colors.primary} />
                            </View>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>Bill #{1000 + item}</Text>
                                <Text style={styles.listSubtitle}>Today, 11:2{item} AM</Text>
                            </View>
                            <View style={styles.listResult}>
                                <Text style={styles.listAmount}>₹ {500 * item}.00</Text>
                                <Text style={styles.listStatus}>Paid</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: spacing.md,
    },
    greeting: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    shopName: {
        fontSize: typography.sizes.xl,
        fontWeight: "700",
        color: colors.text,
        marginTop: 2,
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: spacing.xl,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        color: colors.text,
    },
    seeAll: {
        fontSize: typography.sizes.sm,
        color: colors.primary,
        fontWeight: "600",
    },
    summaryGrid: {
        gap: spacing.sm,
    },
    summaryRow: {
        flex: 1,
    },
    actionsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 12,
    },
    actionItem: {
        backgroundColor: colors.surface,
        borderRadius: spacing.roundness,
        padding: spacing.md,
        alignItems: "center",
        width: "22.5%",
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
    actionTitle: {
        fontSize: 11,
        fontWeight: "600",
        color: colors.text,
        textAlign: "center",
    },
    aiCard: {
        backgroundColor: colors.primary,
        borderRadius: spacing.roundness,
        padding: spacing.lg,
        marginTop: spacing.xl,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    aiHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    aiBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4,
    },
    aiBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
    },
    aiTime: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: 12,
    },
    aiMessage: {
        color: "#fff",
        fontSize: typography.sizes.md,
        lineHeight: 22,
        fontWeight: "500",
        marginBottom: spacing.md,
    },
    aiButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    aiButtonText: {
        color: "#fff",
        fontSize: typography.sizes.sm,
        fontWeight: "700",
        textDecorationLine: "underline",
    },
    list: {
        backgroundColor: colors.surface,
        borderRadius: spacing.roundness,
        borderWidth: 1,
        borderColor: colors.border,
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    listIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    listContent: {
        flex: 1,
    },
    listTitle: {
        fontSize: typography.sizes.md,
        fontWeight: "600",
        color: colors.text,
    },
    listSubtitle: {
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    listResult: {
        alignItems: "flex-end",
    },
    listAmount: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    listStatus: {
        fontSize: typography.sizes.xs,
        color: colors.success,
        fontWeight: "600",
        marginTop: 2,
    },
});
