import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { haptics } from "../../utils/haptics";

export type AlertType = "success" | "error" | "warning" | "info" | "confirm";

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
}

export interface CustomAlertOptions {
    title: string;
    message?: string;
    type?: AlertType;
    icon?: keyof typeof Ionicons.glyphMap;
    buttons?: AlertButton[];
    onDismiss?: () => void;
}

interface Props extends CustomAlertOptions {
    visible: boolean;
}

export function CustomAlertModal({
    visible,
    title,
    message,
    type = "info",
    icon,
    buttons = [{ text: "OK", style: "default" }],
    onDismiss,
}: Props) {
    if (!visible) return null;

    const getTypeConfig = () => {
        let effectiveType = type;
        if (type === "info" && title) {
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes("saved") || lowerTitle.includes("success") || lowerTitle.includes("updated") || lowerTitle.includes("copied")) {
                effectiveType = "success";
            } else if (lowerTitle.includes("error") || lowerTitle.includes("failed") || lowerTitle.includes("invalid") || lowerTitle.includes("discard")) {
                effectiveType = "error";
            } else if (lowerTitle.includes("warning") || lowerTitle.includes("notice") || lowerTitle.includes("empty")) {
                effectiveType = "warning";
            }
        }

        switch (effectiveType) {
            case "success":
                return {
                    bg: "#ECFDF5",
                    color: "#059669",
                    iconName: icon || "checkmark-circle",
                };
            case "error":
                return {
                    bg: "#FEF2F2",
                    color: "#DC2626",
                    iconName: icon || "close-circle",
                };
            case "warning":
                return {
                    bg: "#FFFBEB",
                    color: "#D97706",
                    iconName: icon || "warning",
                };
            case "confirm":
                return {
                    bg: "#EEF2FF",
                    color: "#4F46E5",
                    iconName: icon || "help-circle",
                };
            case "info":
            default:
                return {
                    bg: "#EFF6FF",
                    color: colors.primary,
                    iconName: icon || "information-circle",
                };
        }
    };

    const typeConfig = getTypeConfig();

    const displayButtons = buttons.length > 0 ? buttons : [{ text: "OK", style: "default" as const }];

    const handleButtonPress = (btn: AlertButton) => {
        if (btn.style === "destructive") {
            haptics.medium();
        } else {
            haptics.light();
        }
        if (btn.onPress) {
            btn.onPress();
        }
        if (onDismiss) {
            onDismiss();
        }
    };

    const handleDismissOverlay = () => {
        // If there's only 1 action button with onPress, trigger it on backdrop tap too
        if (displayButtons.length === 1 && displayButtons[0].onPress) {
            displayButtons[0].onPress();
        }
        if (onDismiss) {
            onDismiss();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleDismissOverlay}
        >
            <TouchableWithoutFeedback onPress={handleDismissOverlay}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.card}>
                            {/* Header Icon */}
                            <View style={[styles.iconContainer, { backgroundColor: typeConfig.bg }]}>
                                <Ionicons name={typeConfig.iconName as any} size={32} color={typeConfig.color} />
                            </View>

                            {/* Title & Message */}
                            <Text style={styles.title}>{title}</Text>
                            {!!message && <Text style={styles.message}>{message}</Text>}

                            {/* Buttons */}
                            <View
                                style={[
                                    styles.buttonRow,
                                    displayButtons.length === 2 ? styles.twoButtons : styles.stackedButtons,
                                ]}
                            >
                                {displayButtons.map((btn, idx) => {
                                    const isCancel = btn.style === "cancel";
                                    const isDestructive = btn.style === "destructive";

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            activeOpacity={0.8}
                                            style={[
                                                styles.btn,
                                                displayButtons.length === 2 && styles.btnHalf,
                                                isCancel && styles.btnCancel,
                                                isDestructive && styles.btnDestructive,
                                                !isCancel && !isDestructive && styles.btnPrimary,
                                            ]}
                                            onPress={() => handleButtonPress(btn)}
                                        >
                                            <Text
                                                style={[
                                                    styles.btnText,
                                                    isCancel && styles.btnTextCancel,
                                                    isDestructive && styles.btnTextDestructive,
                                                    !isCancel && !isDestructive && styles.btnTextPrimary,
                                                ]}
                                            >
                                                {btn.text}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    card: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 19,
        fontWeight: "700",
        color: "#0F172A",
        textAlign: "center",
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        fontWeight: "400",
        color: "#475569",
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 20,
    },
    buttonRow: {
        width: "100%",
        marginTop: 4,
    },
    twoButtons: {
        flexDirection: "row",
        gap: 10,
    },
    stackedButtons: {
        flexDirection: "column",
        gap: 10,
    },
    btn: {
        height: 48,
        width: "100%",
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    btnHalf: {
        flex: 1,
        width: undefined,
    },
    btnPrimary: {
        backgroundColor: colors.primary,
    },
    btnDestructive: {
        backgroundColor: colors.error,
    },
    btnCancel: {
        backgroundColor: "#F1F5F9",
    },
    btnText: {
        fontSize: 15,
        fontWeight: "600",
    },
    btnTextPrimary: {
        color: "#FFFFFF",
    },
    btnTextDestructive: {
        color: "#FFFFFF",
    },
    btnTextCancel: {
        color: "#475569",
    },
});
