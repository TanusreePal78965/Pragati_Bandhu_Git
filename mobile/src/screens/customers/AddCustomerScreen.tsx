import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function AddCustomerScreen() {
    const navigation = useNavigation();
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [initialBalance, setInitialBalance] = useState("");
    const [address, setAddress] = useState("");

    const handleSave = () => {
        // Logic to save customer would go here
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Customer</Text>
                <View style={{ width: 40 }} /> {/* Spacer for symmetry */}
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>
                            Add your customers to track their Udhar (Outstanding balance) and transaction history.
                        </Text>
                    </View>

                    {/* Form Fields */}
                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Customer Full Name *</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color={colors.secondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter full name"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="call-outline" size={20} color={colors.secondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter 10-digit number"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Initial Udhar Balance (Optional)</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.currencyPrefix}>₹</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    value={initialBalance}
                                    onChangeText={setInitialBalance}
                                />
                            </View>
                            <Text style={styles.inputHelp}>Amount the customer already owes you</Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Address (Optional)</Text>
                            <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 12 }]}>
                                <Ionicons name="location-outline" size={20} color={colors.secondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                    placeholder="Enter street name, colony..."
                                    multiline
                                    numberOfLines={3}
                                    value={address}
                                    onChangeText={setAddress}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>

                {/* Fixed Save Button at the bottom */}
                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={[styles.saveButton, !name && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!name}
                    >
                        <Text style={styles.saveButtonText}>Save Customer</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm,
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
    },
    infoBox: {
        flexDirection: "row",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        gap: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(59, 130, 246, 0.2)",
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: "#1E40AF",
        lineHeight: 18,
    },
    form: {
        gap: 20,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 56,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputIcon: {
        marginRight: 10,
    },
    currencyPrefix: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.text,
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
    },
    inputHelp: {
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: 4,
    },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: "#fff",
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    saveButtonDisabled: {
        backgroundColor: "#CBD5E1",
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});
