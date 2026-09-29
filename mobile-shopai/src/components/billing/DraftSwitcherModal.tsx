import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Pressable,
    StyleSheet,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DraftSummary } from "../../db/db";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

interface Props {
    visible: boolean;
    onClose: () => void;
    drafts: DraftSummary[];
    currentDraftId: string | null;
    onSelectDraft: (draftId: string) => void;
    onDiscardDraft: (draftId: string) => void;
    onNewBill: () => void;
}

export default function DraftSwitcherModal({
    visible,
    onClose,
    drafts,
    currentDraftId,
    onSelectDraft,
    onDiscardDraft,
    onNewBill,
}: Props) {
    const handleDiscard = (draft: DraftSummary) => {
        Alert.alert(
            "Discard Bill",
            `Discard bill for "${draft.customer_name ?? "Walk-in"}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => onDiscardDraft(draft.id),
                },
            ]
        );
    };

    const paymentColor = (mode: string) => {
        if (mode === "udhar") return "#D97706";
        if (mode === "upi") return "#7C3AED";
        return "#16A34A";
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet}>
                    <View style={styles.handle} />

                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Active Bills</Text>
                        <Text style={styles.count}>{drafts.length} open</Text>
                    </View>

                    <FlatList
                        data={drafts}
                        keyExtractor={(item) => item.id}
                        style={styles.list}
                        renderItem={({ item }) => {
                            const isCurrent = item.id === currentDraftId;
                            return (
                                <TouchableOpacity
                                    style={[styles.draftRow, isCurrent && styles.draftRowActive]}
                                    onPress={() => {
                                        if (!isCurrent) {
                                            onSelectDraft(item.id);
                                            onClose();
                                        }
                                    }}
                                    activeOpacity={isCurrent ? 1 : 0.7}
                                >
                                    <View style={styles.draftLeft}>
                                        {isCurrent && (
                                            <View style={styles.activeBadge}>
                                                <Text style={styles.activeBadgeText}>CURRENT</Text>
                                            </View>
                                        )}
                                        <Text style={styles.draftCustomer} numberOfLines={1}>
                                            {item.customer_name ?? "Walk-in Customer"}
                                        </Text>
                                        <View style={styles.draftMetaRow}>
                                            <Text style={styles.draftMeta}>
                                                {item.item_count} item{item.item_count !== 1 ? "s" : ""}
                                            </Text>
                                            <Text style={styles.draftMetaDot}>·</Text>
                                            <Text style={[styles.draftTotal]}>
                                                ₹{Number(item.total_amount).toFixed(2)}
                                            </Text>
                                            <Text style={styles.draftMetaDot}>·</Text>
                                            <Text style={[styles.draftMode, { color: paymentColor(item.payment_mode) }]}>
                                                {item.payment_mode.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    {!isCurrent ? (
                                        <TouchableOpacity
                                            style={styles.discardBtn}
                                            onPress={() => handleDiscard(item)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close-circle" size={24} color="#EF4444" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="pencil" size={18} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text style={styles.emptyText}>No active bills</Text>
                            </View>
                        }
                    />

                    <TouchableOpacity
                        style={styles.newBillBtn}
                        onPress={() => {
                            onNewBill();
                            onClose();
                        }}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                        <Text style={styles.newBillText}>Start New Bill</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingBottom: 32,
        maxHeight: "70%",
    },
    handle: {
        width: 48,
        height: 5,
        backgroundColor: "#E5E7EB",
        borderRadius: 2.5,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 20,
    },
    titleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1E293B",
    },
    count: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
    },
    list: {
        maxHeight: 340,
    },
    draftRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#F8FAFC",
    },
    draftRowActive: {
        borderColor: colors.primary,
        backgroundColor: "#EFF6FF",
    },
    draftLeft: {
        flex: 1,
        gap: 4,
    },
    activeBadge: {
        alignSelf: "flex-start",
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#fff",
        letterSpacing: 0.5,
    },
    draftCustomer: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
    },
    draftMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    draftMeta: {
        fontSize: 12,
        color: "#64748B",
        fontWeight: "500",
    },
    draftMetaDot: {
        fontSize: 12,
        color: "#CBD5E1",
    },
    draftTotal: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1E293B",
    },
    draftMode: {
        fontSize: 11,
        fontWeight: "700",
    },
    discardBtn: {
        marginLeft: 12,
    },
    empty: {
        paddingVertical: 24,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#94A3B8",
    },
    newBillBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 12,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderStyle: "dashed",
    },
    newBillText: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.primary,
    },
});
