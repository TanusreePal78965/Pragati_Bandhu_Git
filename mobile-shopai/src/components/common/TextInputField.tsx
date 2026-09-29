import React from "react";
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

interface TextInputFieldProps {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
    error?: string;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
}

export default function TextInputField({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType = "default",
    error,
    containerStyle,
    inputStyle,
}: TextInputFieldProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    error && styles.inputError,
                    inputStyle,
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.secondary}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: "600",
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: spacing.roundness,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: typography.sizes.md,
        color: colors.text,
    },
    inputError: {
        borderColor: colors.error,
    },
    errorText: {
        fontSize: typography.sizes.xs,
        color: colors.error,
        marginTop: spacing.xs,
    },
});
