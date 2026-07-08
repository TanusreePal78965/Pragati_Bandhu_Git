import React, { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Alert,
    Modal,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import {
    getCustomerById,
    updateCustomer,
    recordUdharPayment,
    getBillsByCustomer,
    Customer,
    Bill,
} from "../../db/db";

const formatCurrency = (amount: number) =>
    `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

import { toUtcDate } from "../../utils/dateUtils";

const formatDateTime = (dateStr: string) => {
    const d = toUtcDate(dateStr);
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
};

export default function EditCustomerScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const customerId: string = route.params?.customerId;

    // ─── Customer state ───────────────────────────────────────────────────────
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [saving, setSaving] = useState(false);

    // ─── Bill history state ───────────────────────────────────────────────────
    const [bills, setBills] = useState<Bill[]>([]);

    // ─── Payment modal state ──────────────────────────────────────────────────
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInput, setPaymentInput] = useState("");
    const [recording, setRecording] = useState(false);

    const loadData = useCallback(() => {
        if (!customerId) return;
        const c = getCustomerById(customerId);
        if (c) {
            setCustomer(c);
            setName(c.name);
            setPhone(c.phone ?? "");
            setAddress(c.address ?? "");
        }
        setBills(getBillsByCustomer(customerId, 10));
    }, [customerId]);

    useFocusEffect(loadData);

    if (!customerId) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Customer</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.textSecondary }}>Customer not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!customer && customerId) {
        // Still loading
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Customer</Text>
                    <View style={{ width: 40 }} />
                </View>
            </SafeAreaView>
        );
    }

    // ─── Save contact info ────────────────────────────────────────────────────
    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert("Validation", "Customer name is required.");
            return;
        }
        setSaving(true);
        try {
            updateCustomer(customerId, {
                name: name.trim(),
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
            });
            Alert.alert("Saved", "Customer details updated.", [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch {
            Alert.alert("Error", "Could not save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // ─── Record payment ───────────────────────────────────────────────────────
    const currentBalance = customer?.udhar_balance ?? 0;

    const handleRecordPayment = () => {
        const amount = parseFloat(paymentInput);
        if (!paymentInput || isNaN(amount) || amount <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
            return;
        }
        if (amount > currentBalance) {
            Alert.alert(
                "Amount Exceeds Balance",
                `${customer?.name ?? "This customer"} only owes ${formatCurrency(currentBalance)}. Enter a lower amount.`
            );
            return;
        }
        setRecording(true);
        try {
            recordUdharPayment(customerId, amount);
            // Refresh balance in state immediately
            const updated = getCustomerById(customerId);
            if (updated) setCustomer(updated);
            setShowPaymentModal(false);
            setPaymentInput("");
            Alert.alert(
                "Payment Recorded ✓",
                `${formatCurrency(amount)} marked as received from ${customer?.name ?? "customer"}.\n\nRemaining balance: ${formatCurrency(Math.max(0, currentBalance - amount))}`
            );
        } catch {
            Alert.alert("Error", "Could not record payment. Please try again.");
        } finally {
            setRecording(false);
        }
    };

    const quickAmounts = [100, 200, 500, 1000].filter((a) => a < currentBalance);

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Customer</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                    {/* ── Udhar Balance Card ─────────────────────────────────── */}
                    <View style={[
                        styles.balanceCard,
                        currentBalance === 0 && { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                    ]}>
                        <View style={styles.balanceLeft}>
                            <Text style={styles.balanceLabel}>CURRENT UDHAR BALANCE</Text>
                            <Text style={[
                                styles.balanceValue,
                                currentBalance === 0 && { color: colors.success },
                            ]}>
                                {formatCurrency(currentBalance)}
                            </Text>
                            {currentBalance === 0 ? (
                                <View style={styles.clearedBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                    <Text style={styles.clearedText}>All cleared</Text>
                                </View>
                            ) : (
                                <Text style={styles.balanceSub}>Outstanding amount to collect</Text>
                            )}
                        </View>
                        {currentBalance > 0 && (
                            <TouchableOpacity
                                style={styles.recordBtn}
                                onPress={() => {
                                    setPaymentInput("");
                                    setShowPaymentModal(true);
                                }}
                            >
                                <Ionicons name="cash-outline" size={18} color="#fff" />
                                <Text style={styles.recordBtnText}>Record{"\n"}Payment</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Contact Details ────────────────────────────────────── */}
                    <Text style={styles.sectionTitle}>CONTACT DETAILS</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name *</Text>
                        <View style={styles.inputRow}>
                            <Ionicons name="person-outline" size={20} color={colors.secondary} />
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Customer name"
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <View style={styles.inputRow}>
                            <Ionicons name="call-outline" size={20} color={colors.secondary} />
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="10-digit number"
                                keyboardType="phone-pad"
                                maxLength={10}
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address</Text>
                        <View style={[styles.inputRow, { alignItems: "flex-start", paddingTop: 14, paddingBottom: 14, minHeight: 80 }]}>
                            <Ionicons name="location-outline" size={20} color={colors.secondary} style={{ marginTop: 2 }} />
                            <TextInput
                                style={[styles.input, { height: 64, textAlignVertical: "top" }]}
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Street, colony..."
                                multiline
                                numberOfLines={3}
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    </View>

                    {/* ── Bill History ───────────────────────────────────────── */}
                    <Text style={styles.sectionTitle}>BILL HISTORY</Text>

                    {bills.length === 0 ? (
                        <View style={styles.emptyBills}>
                            <Ionicons name="receipt-outline" size={36} color={colors.border} />
                            <Text style={styles.emptyBillsText}>No bills recorded for this customer yet</Text>
                        </View>
                    ) : (
                        <View style={styles.billList}>
                            {bills.map((bill, index) => (
                                <TouchableOpacity
                                    key={bill.id}
                                    style={[
                                        styles.billRow,
                                        index === bills.length - 1 && { borderBottomWidth: 0 },
                                    ]}
                                    onPress={() => navigation.navigate("BillDetail", { bill })}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.billIcon,
                                        { backgroundColor: bill.payment_mode === "udhar" ? "#FEF3C7" : "#DCFCE7" },
                                    ]}>
                                        <Ionicons
                                            name={bill.payment_mode === "udhar" ? "wallet-outline" : "cash-outline"}
                                            size={16}
                                            color={bill.payment_mode === "udhar" ? "#D97706" : colors.success}
                                        />
                                    </View>
                                    <View style={styles.billInfo}>
                                        <Text style={styles.billDate}>{formatDateTime(bill.bill_date)}</Text>
                                        <Text style={styles.billMeta}>
                                            {bill.total_items} item{bill.total_items !== 1 ? "s" : ""} · {bill.payment_mode === "udhar" ? "Udhar" : "Cash"}
                                        </Text>
                                    </View>
                                    <View style={styles.billRight}>
                                        <Text style={styles.billAmount}>₹{bill.total_amount.toFixed(2)}</Text>
                                        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <View style={{ height: 16 }} />
                </ScrollView>

                {/* Save Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={!name.trim() || saving}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* ── Record Payment Modal ───────────────────────────────────────── */}
            <Modal visible={showPaymentModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowPaymentModal(false)}>
                    <Pressable style={styles.modalSheet}>
                        <View style={styles.modalHandle} />

                        <Text style={styles.modalTitle}>Record Udhar Payment</Text>
                        <Text style={styles.modalSub}>
                            {customer?.name ?? "Customer"} currently owes{" "}
                            <Text style={{ fontWeight: "800", color: colors.error }}>
                                {formatCurrency(currentBalance)}
                            </Text>
                        </Text>

                        {/* Amount input */}
                        <View style={styles.amountInputRow}>
                            <Text style={styles.rupeePrefix}>₹</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={paymentInput}
                                onChangeText={setPaymentInput}
                                placeholder="0.00"
                                keyboardType="numeric"
                                placeholderTextColor="#9ca3af"
                                autoFocus
                            />
                        </View>

                        {/* Quick amount chips */}
                        {quickAmounts.length > 0 && (
                            <View style={styles.quickRow}>
                                {quickAmounts.map((a) => (
                                    <TouchableOpacity
                                        key={a}
                                        style={styles.quickChip}
                                        onPress={() => setPaymentInput(String(a))}
                                    >
                                        <Text style={styles.quickChipText}>₹{a}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    style={[styles.quickChip, styles.quickChipFull]}
                                    onPress={() => setPaymentInput(String(currentBalance))}
                                >
                                    <Text style={[styles.quickChipText, { color: colors.success }]}>
                                        Full ₹{currentBalance % 1 === 0 ? currentBalance : currentBalance.toFixed(2)}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Confirm */}
                        <TouchableOpacity
                            style={[styles.confirmBtn, recording && { opacity: 0.7 }]}
                            onPress={handleRecordPayment}
                            disabled={recording}
                        >
                            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                            <Text style={styles.confirmBtnText}>
                                {recording ? "Recording..." : "Confirm Payment"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setShowPaymentModal(false)}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

    scroll: { padding: spacing.md, paddingBottom: 8 },

    // Balance card
    balanceCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFF1F2",
        borderWidth: 1,
        borderColor: "#FECDD3",
        borderRadius: 16,
        padding: 20,
        marginBottom: spacing.lg,
    },
    balanceLeft: { flex: 1 },
    balanceLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.6, marginBottom: 4 },
    balanceValue: { fontSize: 28, fontWeight: "800", color: colors.error },
    balanceSub: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
    clearedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    clearedText: { fontSize: 13, color: colors.success, fontWeight: "600" },
    recordBtn: {
        backgroundColor: colors.success,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: "center",
        gap: 4,
        marginLeft: 12,
    },
    recordBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 16 },

    // Section title
    sectionTitle: {
        fontSize: 11,
        fontWeight: "700",
        color: "#94A3B8",
        letterSpacing: 0.8,
        marginBottom: spacing.md,
        marginTop: spacing.sm,
    },

    // Contact form
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        height: 52,
    },
    input: { flex: 1, fontSize: 15, color: colors.text },

    // Bill history
    emptyBills: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
    emptyBillsText: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
    billList: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        marginBottom: spacing.md,
    },
    billRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    billIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    billInfo: { flex: 1 },
    billDate: { fontSize: 13, fontWeight: "600", color: colors.text },
    billMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    billRight: { flexDirection: "row", alignItems: "center", gap: 4 },
    billAmount: { fontSize: 14, fontWeight: "700", color: colors.primary },

    // Footer save button
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    saveBtn: {
        backgroundColor: colors.primary,
        height: 54,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    saveBtnDisabled: { backgroundColor: "#CBD5E1" },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    // Payment modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingBottom: 32,
    },
    modalHandle: {
        width: 44,
        height: 5,
        backgroundColor: "#E5E7EB",
        borderRadius: 2.5,
        alignSelf: "center",
        marginTop: 14,
        marginBottom: 20,
    },
    modalTitle: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 6 },
    modalSub: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
    amountInputRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0FDF4",
        borderWidth: 2,
        borderColor: colors.success,
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 64,
        marginBottom: 16,
    },
    rupeePrefix: { fontSize: 22, fontWeight: "700", color: colors.success, marginRight: 8 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: "700", color: colors.text },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    quickChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: "#F1F5F9",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickChipFull: { borderColor: colors.success, backgroundColor: "#F0FDF4" },
    quickChipText: { fontSize: 14, fontWeight: "600", color: colors.text },
    confirmBtn: {
        backgroundColor: colors.success,
        height: 54,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 12,
    },
    confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    cancelBtn: {
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtnText: { fontSize: 15, color: colors.textSecondary, fontWeight: "600" },
});
