import React, { useEffect, useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { getBillItems, Bill, BillItem } from "../../db/db";
import { getShopInfo, StoredShopInfo } from "../../utils/storage";
import { toUtcDate } from "../../utils/dateUtils";

const formatDateTime = (dateStr: string) => {
    const d = toUtcDate(dateStr);
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

export default function BillDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const bill: Bill = route.params?.bill;
    const [items, setItems] = useState<BillItem[]>([]);
    const [shopInfo, setShopInfo] = useState<StoredShopInfo | null>(null);

    useEffect(() => {
        if (bill?.id) {
            setItems(getBillItems(bill.id));
        }
        getShopInfo().then(info => setShopInfo(info));
    }, [bill?.id]);

    const generateBillHtml = () => {
        const date = formatDateTime(bill.bill_date);
        const shopName = shopInfo?.shopName || "Our Store";
        const shopOwner = shopInfo?.ownerName || "";
        const shopPhone = shopInfo?.phone || "";
        const customerName = bill.customer_name || "Walk-in Customer";

        const itemsHtml = items.length === 0
            ? `<tr><td colspan="2" style="padding:12px;color:#888;text-align:center;">No items found</td></tr>`
            : items.map((item) => `
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <div style="font-weight: bold; font-size: 14px;">${item.product_name}</div>
                    <div style="font-size: 12px; color: #666;">₹${item.unit_price.toFixed(2)} × ${item.qty}</div>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
                    ₹${item.line_total.toFixed(2)}
                </td>
            </tr>
        `).join("");

        return `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                </head>
                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333;">
                    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid ${colors.primary}; padding-bottom: 20px;">
                        <h1 style="margin: 0; color: ${colors.primary}; font-size: 28px;">${shopName}</h1>
                        ${shopOwner ? `<p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Proprietor: ${shopOwner}</p>` : ""}
                        ${shopPhone ? `<p style="margin: 2px 0 0 0; color: #666; font-size: 14px;">Contact: +91 ${shopPhone}</p>` : ""}
                    </div>

                    <div style="margin-bottom: 30px; display: flex; justify-content: space-between;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 10px 0; font-size: 12px; color: #888; text-transform: uppercase;">Customer</h3>
                            <p style="margin: 0; font-weight: bold; font-size: 16px;">${customerName}</p>
                        </div>
                        <div style="flex: 1; text-align: right;">
                            <h3 style="margin: 0 0 10px 0; font-size: 12px; color: #888; text-transform: uppercase;">Bill Summary</h3>
                            <p style="margin: 0; font-weight: bold; font-size: 14px;">ID: ${bill.id.toUpperCase()}</p>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">${date}</p>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding-bottom: 10px; border-bottom: 2px solid #eee; color: #999; font-size: 12px; text-transform: uppercase;">Description</th>
                                <th style="text-align: right; padding-bottom: 10px; border-bottom: 2px solid #eee; color: #999; font-size: 12px; text-transform: uppercase;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: #666;">Subtotal</span>
                            <span style="font-weight: bold;">₹${bill.total_amount.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                            <span style="color: #666;">Payment Mode</span>
                            <span style="font-weight: bold; color: ${bill.payment_mode === "udhar" ? "#D97706" : bill.payment_mode === "upi" ? "#7C3AED" : colors.success};">${bill.payment_mode === "udhar" ? "Udhar (Credit)" : bill.payment_mode === "upi" ? "UPI Payment" : "Cash"}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-top: 15px; border-top: 1px solid #ddd;">
                            <span style="font-size: 18px; font-weight: bold;">Grand Total</span>
                            <span style="font-size: 24px; font-weight: 800; color: ${colors.primary};">₹${bill.total_amount.toFixed(2)}</span>
                        </div>
                    </div>

                    <div style="margin-top: 50px; text-align: center; color: #999; font-size: 12px;">
                        <p>Thank you for your business!</p>
                        <p style="margin-top: 5px;">This is a computer generated receipt.</p>
                    </div>
                </body>
            </html>
        `;
    };

    const onSharePress = async () => {
        try {
            const html = generateBillHtml();
            const { uri } = await Print.printToFileAsync({ html });
            
            const fileName = `Bill_${bill.id.substring(0, 8)}_${new Date().getTime()}.pdf`;
            const newUri = uri.substring(0, uri.lastIndexOf('/') + 1) + fileName;
            
            // To rename the file on iOS/Android, we'd normally use FileSystem, 
            // but for simple sharing, printToFileAsync's output is sufficient.
            
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Share Bill #${bill.id.toUpperCase()}`,
                UTI: 'com.adobe.pdf'
            });
        } catch (error) {
            console.error("Error sharing PDF:", error);
        }
    };

    if (!bill) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.errorText}>Bill not found.</Text>
            </SafeAreaView>
        );
    }

    const isUdhar = bill.payment_mode === "udhar";
    const isUpi = bill.payment_mode === "upi";
    const modeColor = isUdhar ? "#D97706" : isUpi ? "#7C3AED" : colors.success;
    const modeBgColor = isUdhar ? "#FEF9C3" : isUpi ? "#EDE9FE" : "#DCFCE7";
    const modeTextColor = isUdhar ? "#92400E" : isUpi ? "#5B21B6" : "#166534";
    const modeIcon = isUdhar ? "wallet-outline" : isUpi ? "phone-portrait-outline" : "cash-outline";
    const modeLabel = isUdhar ? "Udhar" : isUpi ? "UPI" : "Cash";
    const modeLabelLong = isUdhar ? "Udhar (Credit)" : isUpi ? "UPI Payment" : "Cash";

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bill Details</Text>
                <TouchableOpacity onPress={onSharePress} style={styles.backBtn}>
                    <Ionicons name="share-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                {/* Receipt Card */}
                <View style={styles.receiptCard}>
                    {/* Top — store / status */}
                    <View style={styles.receiptTop}>
                        <View style={styles.storeIconWrap}>
                            <Ionicons name="storefront-outline" size={28} color={colors.primary} />
                        </View>
                        <View style={[styles.modeBadge, { backgroundColor: modeBgColor }]}>
                            <Ionicons name={modeIcon as any} size={14} color={modeTextColor} />
                            <Text style={[styles.modeBadgeText, { color: modeTextColor }]}>
                                {modeLabel}
                            </Text>
                        </View>
                    </View>

                    {/* Amount */}
                    <Text style={styles.totalAmount}>₹{bill.total_amount.toFixed(2)}</Text>
                    <Text style={styles.dateText}>{formatDateTime(bill.bill_date)}</Text>

                    <View style={styles.divider} />

                    {/* Customer row */}
                    <View style={styles.infoRow}>
                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Customer</Text>
                        <Text style={styles.infoValue}>{bill.customer_name ?? "Walk-in"}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Total Items</Text>
                        <Text style={styles.infoValue}>{bill.total_items}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Payment</Text>
                        <Text style={[styles.infoValue, { color: modeColor }]}>
                            {modeLabelLong}
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    {/* Bill ID */}
                    <Text style={styles.billId}>Bill ID: {bill.id.toUpperCase()}</Text>
                </View>

                {/* Items Section */}
                <Text style={styles.sectionTitle}>ITEMS IN THIS BILL</Text>

                <View style={styles.itemsCard}>
                    {items.length === 0 ? (
                        <Text style={styles.noItems}>No items found for this bill.</Text>
                    ) : (
                        items.map((item, index) => (
                            <View
                                key={item.id ?? index}
                                style={[
                                    styles.itemRow,
                                    index === items.length - 1 && { borderBottomWidth: 0 },
                                ]}
                            >
                                <View style={styles.itemLeft}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                        {item.product_name}
                                    </Text>
                                    <Text style={styles.itemMeta}>
                                        ₹{item.unit_price.toFixed(2)} × {item.qty}
                                    </Text>
                                </View>
                                <Text style={styles.itemTotal}>₹{item.line_total.toFixed(2)}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Grand Total Row */}
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                    <Text style={styles.grandTotalValue}>₹{bill.total_amount.toFixed(2)}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        height: 56,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    content: { padding: spacing.md, paddingBottom: 40 },
    receiptCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    receiptTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    storeIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.primary + "12",
        alignItems: "center",
        justifyContent: "center",
    },
    modeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    modeBadgeText: { fontSize: 13, fontWeight: "700" },
    totalAmount: {
        fontSize: 40,
        fontWeight: "800",
        color: colors.primary,
        marginBottom: 4,
    },
    dateText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6,
    },
    infoLabel: { flex: 1, fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
    infoValue: { fontSize: 14, fontWeight: "700", color: colors.text },
    billId: { fontSize: 11, color: colors.textSecondary, textAlign: "center", letterSpacing: 0.5 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    itemsCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        marginBottom: spacing.md,
    },
    noItems: { padding: spacing.md, color: colors.textSecondary, textAlign: "center" },
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    itemLeft: { flex: 1, marginRight: spacing.md },
    itemName: { fontSize: 15, fontWeight: "600", color: colors.text },
    itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    itemTotal: { fontSize: 15, fontWeight: "700", color: colors.text },
    grandTotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    grandTotalLabel: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
    grandTotalValue: { fontSize: 24, fontWeight: "800", color: "#fff" },
    errorText: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
});
