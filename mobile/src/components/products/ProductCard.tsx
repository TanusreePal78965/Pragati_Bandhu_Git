import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
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
    price: number;
    selected?: boolean;
    onPress: () => void;
    onEdit?: () => void;
    onUpdateStock?: () => void;
}

export default function ProductCard({
    name,
    category,
    stock,
    threshold,
    unit,
    price,
    selected,
    onPress,
    onEdit,
    onUpdateStock,
}: ProductCardProps) {
    const isOut = stock === 0;
    const isLowStock = stock > 0 && stock <= threshold;

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.contentMain} onPress={onPress} activeOpacity={0.7}>
                {/* Checkbox */}
                <View style={styles.checkboxContainer}>
                    <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={22}
                        color={selected ? colors.primary : colors.border}
                    />
                </View>

                {/* Name & Category */}
                <View style={styles.info}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.category}>{category.toUpperCase()}</Text>
                </View>

                {/* Price & Stock Status */}
                <View style={styles.stockInfo}>
                    <Text style={styles.price}>₹{price}</Text>
                    <Text
                        style={[
                            styles.stockText,
                            isOut || isLowStock ? styles.lowStock : styles.normalStock,
                        ]}
                    >
                        {isOut
                            ? "Out"
                            : isLowStock
                            ? `${stock} Left`
                            : `${stock} ${unit}`}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Edit & Stock Actions */}
            <View style={styles.actions}>
                {onUpdateStock && (
                    <TouchableOpacity onPress={onUpdateStock} style={styles.actionButton} activeOpacity={0.7}>
                        <Image
                            source={require("../../../assets/restock-icon.png")}
                            style={styles.restockIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onEdit} style={styles.actionButton} activeOpacity={0.7}>
                    <Ionicons name="pencil" size={16} color={colors.secondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
    },
    contentMain: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    checkboxContainer: {
        marginRight: spacing.sm,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    category: {
        fontSize: 10,
        fontWeight: "600",
        color: colors.textSecondary,
        marginTop: 2,
    },
    stockInfo: {
        alignItems: "flex-end",
        marginRight: spacing.md,
    },
    price: {
        fontSize: typography.sizes.md,
        fontWeight: "700",
        color: colors.text,
    },
    stockText: {
        fontSize: 12,
        fontWeight: "600",
        marginTop: 2,
    },
    normalStock: {
        color: colors.success,
    },
    lowStock: {
        color: colors.error,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    actionButton: {
        padding: 4,
    },
    restockIcon: {
        width: 26,
        height: 26,
    },
});
