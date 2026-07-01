import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Alert,
} from "react-native";
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
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

const renderItemDetails = (item: BillItem): string => {
    if (item.display_qty) {
        const parts = item.display_qty.trim().split(/\s+/);
        if (parts.length >= 2) {
            const qtyVal = parseFloat(parts[0]);
            if (!isNaN(qtyVal) && qtyVal > 0) {
                const displayPrice = item.line_total / qtyVal;
                return `₹${displayPrice.toFixed(2)} × ${item.display_qty}`;
            }
        }
        return `₹${item.unit_price.toFixed(2)} × ${item.display_qty}`;
    }
    if (item.uom) {
        return `₹${item.unit_price.toFixed(2)} × ${item.qty} ${item.uom}`;
    }
    return `₹${item.unit_price.toFixed(2)} × ${item.qty}`;
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
            ? `<tr><td colspan="4" style="padding:12px;color:#888;text-align:center;">No items found</td></tr>`
            : items.map((item) => {
                let displayPrice = item.unit_price;
                let displayQty = String(item.qty);
                let uomStr = "";

                if (item.display_qty) {
                    const parts = item.display_qty.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const qtyVal = parseFloat(parts[0]);
                        if (!isNaN(qtyVal) && qtyVal > 0) {
                            displayPrice = item.line_total / qtyVal;
                            displayQty = parts[0];
                            uomStr = parts.slice(1).join(" ");
                        }
                    } else {
                        uomStr = item.uom ?? "";
                    }
                } else if (item.uom) {
                    uomStr = item.uom;
                }

                return `
                <tr>
                    <td class="text-left" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">
                        ${item.product_name}
                    </td>
                    <td class="text-right" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
                        ₹${displayPrice.toFixed(2)}
                    </td>
                    <td class="text-center" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
                        ${displayQty} ${uomStr}
                    </td>
                    <td class="text-right" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700;">
                        ₹${item.line_total.toFixed(2)}
                    </td>
                </tr>
                `;
            }).join("");

        return `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact;
                                padding: 0;
                                margin: 0;
                            }
                            .no-print {
                                display: none;
                            }
                        }
                        * { box-sizing: border-box; }
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            color: #0f172a;
                            padding: 30px;
                            background-color: #fff;
                            line-height: 1.5;
                        }
                        .invoice-box {
                            max-width: 800px;
                            margin: auto;
                        }
                        .header {
                            border-bottom: 2px solid #0f172a;
                            padding-bottom: 15px;
                            margin-bottom: 25px;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                        }
                        .shop-info h1 {
                            margin: 0;
                            font-size: 26px;
                            font-weight: 800;
                            color: #0f172a;
                        }
                        .shop-info p {
                            margin: 3px 0 0 0;
                            font-size: 13px;
                            color: #475569;
                        }
                        .invoice-title {
                            text-align: right;
                        }
                        .invoice-title h2 {
                            margin: 0;
                            font-size: 22px;
                            font-weight: 800;
                            color: #0f172a;
                            letter-spacing: 1px;
                        }
                        .invoice-title p {
                            margin: 3px 0 0 0;
                            font-size: 13px;
                            color: #475569;
                        }
                        .details-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 30px;
                            gap: 20px;
                        }
                        .details-box {
                            flex: 1;
                        }
                        .details-box h3 {
                            margin: 0 0 8px 0;
                            font-size: 11px;
                            font-weight: 700;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .details-box p {
                            margin: 2px 0;
                            font-size: 14px;
                            color: #0f172a;
                        }
                        .details-box .bold {
                            font-weight: 700;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                        }
                        th {
                            background-color: #f8fafc;
                            border-bottom: 2px solid #cbd5e1;
                            padding: 10px 12px;
                            font-size: 11px;
                            font-weight: 700;
                            color: #475569;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        tr {
                            page-break-inside: avoid;
                        }
                        .text-left { text-align: left; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .total-box {
                            width: 100%;
                            max-width: 320px;
                            margin-left: auto;
                            background-color: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 15px;
                        }
                        .total-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 6px 0;
                            font-size: 14px;
                            color: #475569;
                        }
                        .total-row.grand-total {
                            border-top: 1px dashed #cbd5e1;
                            margin-top: 8px;
                            padding-top: 10px;
                            font-size: 18px;
                            font-weight: 800;
                            color: #0f172a;
                        }
                        .footer {
                            margin-top: 60px;
                            text-align: center;
                            color: #94a3b8;
                            font-size: 12px;
                            border-top: 1px solid #e2e8f0;
                            padding-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="invoice-box">
                        <div class="header">
                            <div class="shop-info">
                                <h1>${shopName}</h1>
                                ${shopOwner ? `<p>Proprietor: ${shopOwner}</p>` : ""}
                                ${shopPhone ? `<p>Contact: +91 ${shopPhone}</p>` : ""}
                            </div>
                            <div class="invoice-title">
                                <h2>INVOICE</h2>
                                <p>#${bill.id.toUpperCase()}</p>
                            </div>
                        </div>

                        <div class="details-row">
                            <div class="details-box">
                                <h3>Billed To</h3>
                                <p class="bold">${customerName}</p>
                            </div>
                            <div class="details-box text-right">
                                <h3>Date of Issue</h3>
                                <p>${date}</p>
                                <p><span style="font-weight:600; color:#64748b; font-size:11px; text-transform:uppercase;">Payment:</span> ${bill.payment_mode === "udhar" ? "Udhar (Credit)" : bill.payment_mode === "upi" ? "UPI" : "Cash"}</p>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th class="text-left" style="width: 50%;">Item Description</th>
                                    <th class="text-right" style="width: 15%;">Price</th>
                                    <th class="text-center" style="width: 15%;">Qty</th>
                                    <th class="text-right" style="width: 20%;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div class="total-box">
                            <div class="total-row">
                                <span>Subtotal</span>
                                <span>₹${bill.total_amount.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Payment Mode</span>
                                <span style="font-weight:600;">${bill.payment_mode === "udhar" ? "Udhar" : bill.payment_mode === "upi" ? "UPI" : "Cash"}</span>
                            </div>
                            <div class="total-row grand-total">
                                <span>Grand Total</span>
                                <span>₹${bill.total_amount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="footer">
                            <p>Thank you for your business!</p>
                            <p style="margin-top: 3px; font-size: 10px;">This is a computer generated receipt.</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
    };

    const onSharePress = async () => {
        try {
            const html = generateBillHtml();
            const { uri } = await Print.printToFileAsync({ html });
            
            const cleanShopName = shopInfo?.shopName ? shopInfo.shopName.replace(/[^a-zA-Z0-9]/g, "_") : "Store";
            const cleanCustomerName = bill.customer_name ? bill.customer_name.replace(/[^a-zA-Z0-9]/g, "_") : "Walk_in";
            
            const readableFileName = `Invoice_${cleanShopName}_${cleanCustomerName}_${bill.id}.pdf`;
            const newUri = FileSystem.cacheDirectory + readableFileName;
            
            await FileSystem.copyAsync({
                from: uri,
                to: newUri
            });
            
            await Sharing.shareAsync(newUri, {
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
                    <TouchableOpacity 
                        onPress={async () => {
                            await Clipboard.setStringAsync(bill.id.toUpperCase());
                            Alert.alert("Copied", "Bill ID copied to clipboard");
                        }} 
                        activeOpacity={0.6}
                    >
                        <Text style={styles.billId}>Bill ID: {bill.id.toUpperCase()}</Text>
                    </TouchableOpacity>
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
                                        {renderItemDetails(item)}
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
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    grandTotalLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
    grandTotalValue: { fontSize: 24, fontWeight: "800", color: colors.primary },
    errorText: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
});
