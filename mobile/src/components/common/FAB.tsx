import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

interface FABProps {
    onPress: () => void;
    iconName?: keyof typeof Ionicons.glyphMap;
    offsetTabBar?: boolean;
    style?: ViewStyle;
}

/**
 * Standardized Floating Action Button (FAB) for the application.
 * Identical look and feel across all screens.
 */
export default function FAB({ onPress, iconName = "add", offsetTabBar = false, style }: FABProps) {
    return (
        <TouchableOpacity
            style={[
                styles.fab,
                offsetTabBar && styles.fabWithOffset,
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Ionicons name={iconName} size={32} color="#fff" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        right: spacing.md,
        bottom: spacing.md,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    fabWithOffset: {
        bottom: spacing.tabBarOffset + spacing.md,
    },
});
