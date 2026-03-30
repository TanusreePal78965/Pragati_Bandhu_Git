import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface ProductCardProps {
    name: string;
    category: string;
    stock: number;
    threshold: number;
    unit: string;
    onPress: () => void;
}

export default function ProductCard({
    name,
    category,
    stock,
    threshold,
    unit,
    onPress,
}: ProductCardProps) {
    const isLowStock = stock <= threshold;

    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <View style={styles.content}>
                <View style={styles.info}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.category}>{category}</Text>
                </View>
                <View style={styles.stockInfo}>
                    <Text style={[styles.stockValue, isLowStock && styles.lowStock]}>
                        {stock} {unit}
                    </Text>
                    <Text style={styles.stockLabel}>Available</Text>
                </View>
                <TouchableOpacity style={styles.editButton}>
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>
            {isLowStock && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                    <Text style={styles.badgeText}>LOW STOCK</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: spacing.roundness,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        position: "relative",
        overflow: "hidden",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    info: {
        flex: 2,
    },
    name: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    category: {
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    stockInfo: {
        flex: 1,
        alignItems: "center",
    },
    stockValue: {
        fontSize: typography.sizes.lg,
        fontWeight: "700",
        color: colors.text,
    },
    lowStock: {
        color: colors.error,
    },
    stockLabel: {
        fontSize: 10,
        color: colors.textSecondary,
        textTransform: "uppercase",
    },
    editButton: {
        padding: spacing.xs,
    },
    badge: {
        position: "absolute",
        top: 0,
        right: 0,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderBottomLeftRadius: 8,
    },
    badgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
    },
});
