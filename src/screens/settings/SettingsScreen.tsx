import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { spacing } from "../../theme/spacing";

export default function SettingsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Settings</Text>
            </View>
            <View style={styles.content}>
                <Text style={styles.placeholder}>Settings implementation coming soon.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: spacing.md,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: "700",
        color: colors.text,
    },
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    placeholder: {
        color: colors.textSecondary,
    },
});
