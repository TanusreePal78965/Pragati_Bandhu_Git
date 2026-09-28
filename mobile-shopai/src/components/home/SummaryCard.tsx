import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface SummaryCardProps {
    title: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    subtitle?: string;
    style?: ViewStyle;
}

export default function SummaryCard({
    title,
    value,
    icon,
    color,
    subtitle,
    style,
}: SummaryCardProps) {
    return (
        <View style={[styles.container, style]}>
            <View style={[styles.iconContainer, { backgroundColor: color + "15" }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={[styles.value, { color }]}>{value}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: spacing.roundness,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
        fontWeight: "500",
        textTransform: "uppercase",
    },
    value: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        marginTop: 2,
    },
    subtitle: {
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
});
