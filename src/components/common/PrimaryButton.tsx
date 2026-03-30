import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from "react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

interface PrimaryButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
}

export default function PrimaryButton({
    title,
    onPress,
    loading = false,
    disabled = false,
    style,
    textStyle,
    icon,
}: PrimaryButtonProps) {
    const buttonStyles = [
        styles.button,
        disabled && styles.disabled,
        style,
    ];

    return (
        <TouchableOpacity
            style={buttonStyles}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <Text style={[styles.text, textStyle]}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.primary,
        borderRadius: spacing.roundness,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabled: {
        backgroundColor: colors.secondary,
        shadowOpacity: 0,
        elevation: 0,
    },
    text: {
        color: "#fff",
        fontSize: typography.sizes.md,
        fontWeight: "600",
        // fontFamily: typography.fontFamily.semiBold,
    },
    iconContainer: {
        marginRight: spacing.sm,
    },
});
