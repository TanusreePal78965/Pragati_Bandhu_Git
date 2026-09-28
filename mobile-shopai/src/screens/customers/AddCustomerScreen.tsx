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
import ScreenHeader from "../../components/common/ScreenHeader";
import { insertCustomer } from "../../db/db";
import { useAlert } from "../../context/AlertContext";
import { haptics } from "../../utils/haptics";

export default function AddCustomerScreen() {
    const navigation = useNavigation();
    const { showAlert } = useAlert();
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [initialBalance, setInitialBalance] = useState("");
    const [address, setAddress] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        if (!name.trim()) return;
        setSaving(true);
        haptics.success();
        try {
            insertCustomer({
                name: name.trim(),
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
                udhar_balance: parseFloat(initialBalance) || 0,
            });
            navigation.goBack();
        } catch (e) {
            showAlert("Error", "Could not save customer. Please try again.", undefined, "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="dark-content" />
            <ScreenHeader title="Add New Customer" showBack={true} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={18} color="#1E40AF" />
                        <Text style={styles.infoText}>
                            Add your customers to track their Udhar (Outstanding balance) and transaction history.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Customer Full Name *</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter full name"
                                    placeholderTextColor="#94A3B8"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="call-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter 10-digit number"
                                    placeholderTextColor="#94A3B8"
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
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={initialBalance}
                                    onChangeText={setInitialBalance}
                                />
                            </View>
                            <Text style={styles.inputHelp}>Amount the customer already owes you</Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Address (Optional)</Text>
                            <View style={[styles.inputWrapper, styles.addressWrapper]}>
                                <Ionicons name="location-outline" size={18} color={colors.textSecondary} style={[styles.inputIcon, { marginTop: 2 }]} />
                                <TextInput
                                    style={[styles.input, styles.addressInput]}
                                    placeholder="Enter street name, colony..."
                                    placeholderTextColor="#94A3B8"
                                    multiline
                                    numberOfLines={2}
                                    value={address}
                                    onChangeText={setAddress}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveButton, (!name.trim() || saving) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!name.trim() || saving}
                    >
                        <Text style={styles.saveButtonText}>
                            {saving ? "Saving..." : "Save Customer"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    content: { flex: 1 },
    scrollContent: { padding: spacing.md },
    infoBox: {
        flexDirection: "row",
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: spacing.md,
        gap: 8,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#DBEAFE",
    },
    infoText: { flex: 1, fontSize: 12, color: "#1E40AF", lineHeight: 16 },
    form: { gap: 12 },
    inputContainer: { gap: 4 },
    label: { fontSize: 13, fontWeight: "600", color: colors.text },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputIcon: { marginRight: 8 },
    currencyPrefix: { fontSize: 15, fontWeight: "600", color: colors.text, marginRight: 6 },
    input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
    addressWrapper: {
        alignItems: "flex-start",
        paddingVertical: 8,
        height: 64,
    },
    addressInput: {
        height: 48,
        textAlignVertical: "top",
    },
    inputHelp: { fontSize: 11, color: colors.textSecondary, marginTop: 2, marginLeft: 2 },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    saveButtonDisabled: { backgroundColor: "#CBD5E1" },
    saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

