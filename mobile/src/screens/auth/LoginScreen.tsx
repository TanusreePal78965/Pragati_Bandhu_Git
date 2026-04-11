import { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { sendOtp } from "../../services/authService";

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, "Login">;

export default function LoginScreen() {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleGetOtp = async () => {
        const clean = phoneNumber.replace(/\D/g, "");
        if (!clean) {
            setError("Please enter your mobile number");
            return;
        }
        if (clean.length !== 10) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const data = await sendOtp(clean);
            // Navigate and pass devOtp for auto-fill during development
            navigation.navigate("Otp", { phoneNumber: clean, devOtp: data.__dev_otp });
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ??
                "Could not send OTP. Please check your connection.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhoneNumberChange = (text: string) => {
        const cleaned = text.replace(/\D/g, "").slice(0, 10);
        setPhoneNumber(cleaned);
        if (error) setError("");
    };

    const isButtonDisabled = isLoading || phoneNumber.length < 10;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo/Brand Section */}
                    <View style={styles.brandSection}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>🏪</Text>
                        </View>
                        <Text style={styles.appName}>PragatiBandhu</Text>
                        <Text style={styles.tagline}>Your Shop's Best Friend</Text>
                        <Text style={styles.taglineBengali}>আপনার দোকানের বন্ধু</Text>
                    </View>

                    {/* Login Form */}
                    <View style={styles.formSection}>
                        <Text style={styles.welcomeText}>Welcome!</Text>
                        <Text style={styles.welcomeTextBengali}>স্বাগতম!</Text>
                        <Text style={styles.instructionText}>
                            Enter your mobile number to continue
                        </Text>

                        {/* Phone Input */}
                        <View style={[styles.inputContainer, error ? styles.inputError : null]}>
                            <View style={styles.countryCode}>
                                <Text style={styles.countryCodeText}>+91</Text>
                            </View>
                            <TextInput
                                style={styles.phoneInput}
                                placeholder="Enter Mobile Number"
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={handlePhoneNumberChange}
                                maxLength={10}
                                editable={!isLoading}
                            />
                        </View>

                        {/* Error Message */}
                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : null}

                        {/* Get OTP Button */}
                        <TouchableOpacity
                            style={[
                                styles.otpButton,
                                isButtonDisabled && styles.otpButtonDisabled,
                            ]}
                            onPress={handleGetOtp}
                            activeOpacity={0.8}
                            disabled={isButtonDisabled}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.otpButtonText}>Get OTP</Text>
                            )}
                        </TouchableOpacity>

                        {/* Terms */}
                        <Text style={styles.termsText}>
                            By continuing, you agree to our{" "}
                            <Text style={styles.termsLink}>Terms of Service</Text>
                            {" "}and{" "}
                            <Text style={styles.termsLink}>Privacy Policy</Text>
                        </Text>
                    </View>

                    {/* Features Section */}
                    <View style={styles.featuresSection}>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>📱</Text>
                            <Text style={styles.featureText}>Works Offline</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>📝</Text>
                            <Text style={styles.featureText}>Easy Billing</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Text style={styles.featureIcon}>💰</Text>
                            <Text style={styles.featureText}>Track Udhar</Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
    },
    brandSection: {
        alignItems: "center",
        marginTop: 40,
        marginBottom: 40,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 24,
        backgroundColor: "#EEF2FF",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    logoText: {
        fontSize: 48,
    },
    appName: {
        fontSize: 28,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 4,
    },
    tagline: {
        fontSize: 16,
        color: "#475569",
        marginBottom: 2,
    },
    taglineBengali: {
        fontSize: 14,
        color: "#64748B",
    },
    formSection: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: "700",
        color: "#0F172A",
        textAlign: "center",
    },
    welcomeTextBengali: {
        fontSize: 18,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 8,
    },
    instructionText: {
        fontSize: 15,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 24,
    },
    inputContainer: {
        flexDirection: "row",
        borderWidth: 2,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 12,
    },
    inputError: {
        borderColor: "#FCA5A5",
    },
    countryCode: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 16,
        justifyContent: "center",
        borderRightWidth: 2,
        borderRightColor: "#E2E8F0",
    },
    countryCodeText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#475569",
    },
    phoneInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 18,
        color: "#0F172A",
        letterSpacing: 1,
    },
    errorText: {
        color: "#DC2626",
        fontSize: 14,
        marginBottom: 12,
        textAlign: "center",
    },
    otpButton: {
        backgroundColor: "#2563EB",
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 8,
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    otpButtonDisabled: {
        backgroundColor: "#93C5FD",
        shadowOpacity: 0.1,
    },
    otpButtonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "700",
    },
    termsText: {
        fontSize: 12,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 16,
        lineHeight: 18,
    },
    termsLink: {
        color: "#2563EB",
        fontWeight: "500",
    },
    featuresSection: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 40,
        paddingHorizontal: 16,
    },
    featureItem: {
        alignItems: "center",
    },
    featureIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    featureText: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "500",
    },
});
