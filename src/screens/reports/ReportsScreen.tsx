import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import ScreenHeader from "../../components/common/ScreenHeader";

export default function ReportsScreen() {
    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <ScreenHeader title="Business Reports" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Time Range Selector */}
                <View style={styles.rangeSelector}>
                    <TouchableOpacity style={[styles.chip, styles.activeChip]}>
                        <Text style={[styles.chipText, styles.activeChipText]}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chip}>
                        <Text style={styles.chipText}>This Week</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chip}>
                        <Text style={styles.chipText}>This Month</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Stats Card */}
                <View style={styles.statsCard}>
                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Sales</Text>
                            <Text style={styles.statValue}>₹ 14,250</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Net Profit</Text>
                            <Text style={[styles.statValue, { color: colors.success }]}>
                                ₹ 3,450
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Detailed Breakdown Title */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Detailed Breakdown</Text>
                </View>

                {/* Breakdown Items */}
                <View style={styles.breakdownList}>
                    {[
                        { label: "Cash Sales", value: "₹ 8,120", icon: "cash-outline", color: colors.success },
                        { label: "UPI Sales", value: "₹ 5,130", icon: "qr-code-outline", color: colors.primary },
                        { label: "Pending Udhar", value: "₹ 1,000", icon: "people-outline", color: colors.warning },
                        { label: "Expenses", value: "₹ 450", icon: "receipt-outline", color: colors.error },
                    ].map((item, index) => (
                        <View key={index} style={styles.breakdownItem}>
                            <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>
                            <Text style={styles.itemLabel}>{item.label}</Text>
                            <Text style={styles.itemValue}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                {/* Top Products Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Selling Products</Text>
                </View>

                <View style={styles.breakdownList}>
                    {[
                        { name: "Paracetamol 500mg", sales: "145 strips", amount: "₹ 2,450" },
                        { name: "Amoxicillin 250mg", sales: "82 strips", amount: "₹ 1,820" },
                        { name: "Cough Syrup", sales: "24 bottles", amount: "₹ 1,200" },
                    ].map((item, index) => (
                        <View key={index} style={styles.productRow}>
                            <View style={styles.productInfo}>
                                <Text style={styles.productName}>{item.name}</Text>
                                <Text style={styles.productSales}>{item.sales} sold</Text>
                            </View>
                            <Text style={styles.productAmount}>{item.amount}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.exportButton}>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.exportText}>Download PDF Report</Text>
                </TouchableOpacity>
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
    rangeSelector: {
        flexDirection: "row",
        gap: 8,
        marginVertical: spacing.lg,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeChip: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    activeChipText: {
        color: "#fff",
    },
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
    statRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    statItem: {
        flex: 1,
        alignItems: "center",
    },
    divider: {
        width: 1,
        height: 48,
        backgroundColor: colors.border,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: "500",
        color: colors.textSecondary,
        textTransform: "uppercase",
    },
    statValue: {
        fontSize: typography.sizes.xxl,
        fontWeight: "800",
        color: colors.text,
        marginTop: 4,
    },
    sectionHeader: {
        marginTop: spacing.xl,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        color: colors.text,
    },
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
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    itemLabel: {
        flex: 1,
        fontSize: typography.sizes.md,
        fontWeight: "600",
        color: colors.text,
    },
    itemValue: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    productRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: typography.sizes.md,
        fontWeight: "600",
        color: colors.text,
    },
    productSales: {
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    productAmount: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
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
    exportText: {
        color: "#fff",
        fontSize: typography.sizes.md,
        fontWeight: "700",
    },
});
