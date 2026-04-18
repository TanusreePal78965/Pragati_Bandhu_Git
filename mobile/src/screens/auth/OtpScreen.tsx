import { useState, useRef, useEffect } from "react";
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
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { useAuth } from "../../context/AuthContext";
import { verifyOtp, sendOtp } from "../../services/authService";

type OtpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, "Otp">;
type OtpScreenRouteProp = RouteProp<AuthStackParamList, "Otp">;

const OTP_LENGTH = 6;
const RESEND_TIMER = 30;

export default function OtpScreen() {
    const navigation = useNavigation<OtpScreenNavigationProp>();
    const route = useRoute<OtpScreenRouteProp>();
    const phoneNumber = route.params?.phoneNumber ?? "";

    const { login } = useAuth();

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [error, setError] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(RESEND_TIMER);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        if (!phoneNumber) {
            navigation.navigate("Login");
        }
    }, [phoneNumber, navigation]);

    // Countdown timer for resend button
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [resendTimer]);

    const formatPhoneNumber = (phone: string): string => {
        if (phone.length === 10) {
            return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
        }
        return `+91 ${phone}`;
    };

    const handleOtpChange = (value: string, index: number) => {
        const digit = value.replace(/\D/g, "").slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);
        setError("");

        // Auto-focus next input
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
        // Auto-verify when last digit entered
        if (digit && index === OTP_LENGTH - 1) {
            const fullOtp = newOtp.join("");
            if (fullOtp.length === OTP_LENGTH) {
                handleVerifyOtp(fullOtp);
            }
        }
    };

    const handleKeyPress = (event: any, index: number) => {
        if (event.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (otpCode?: string) => {
        const code = otpCode ?? otp.join("");
        if (code.length !== OTP_LENGTH) {
            setError("Please enter the complete 6-digit OTP");
            return;
        }

        setIsVerifying(true);
        setError("");

        try {
            await verifyOtp(phoneNumber, code);

            // Flip auth state — RootNavigator re-renders:
            //   new user (no shop info) → ShopSetup
            //   returning user          → MainTabs (login checks backend for existing shop)
            await login(phoneNumber);
        } catch (e: any) {
            const msg = e?.message ?? "Incorrect OTP. Please try again.";
            setError(msg);
            setIsVerifying(false);
        }
    };

    const handleResendOtp = async () => {
        if (!canResend) return;
        setCanResend(false);
        setResendTimer(RESEND_TIMER);
        setOtp(Array(OTP_LENGTH).fill(""));
        setError("");
        inputRefs.current[0]?.focus();

        try {
            await sendOtp(phoneNumber);
        } catch {
            setError("Could not resend OTP. Please try again.");
        }
    };

    const handleChangeNumber = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" backgroundColor="#F8FAFC" />
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={handleChangeNumber}
                            activeOpacity={0.7}
                        >
                            <View style={styles.backButtonIcon}>
                                <Ionicons name="chevron-back" size={20} color="#2563EB" />
                            </View>
                            <Text style={styles.backButtonText}>Back</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Icon */}
                    <View style={styles.illustrationSection}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.iconText}>📲</Text>
                        </View>
                    </View>

                    {/* OTP Form */}
                    <View style={styles.formSection}>
                        <Text style={styles.title}>Verify OTP</Text>
                        <Text style={styles.titleBengali}>OTP যাচাই করুন</Text>

                        <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
                        <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber)}</Text>

                        {/* OTP Input Boxes */}
                        <View style={styles.otpContainer}>
                            {otp.map((digit, index) => (
                                <TextInput
                                    key={index}
                                    ref={(ref) => { inputRefs.current[index] = ref; }}
                                    style={[
                                        styles.otpInput,
                                        digit ? styles.otpInputFilled : null,
                                        error ? styles.otpInputError : null,
                                    ]}
                                    value={digit}
                                    onChangeText={(value) => handleOtpChange(value, index)}
                                    onKeyPress={(e) => handleKeyPress(e, index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                    autoFocus={index === 0}
                                    editable={!isVerifying}
                                />
                            ))}
                        </View>

                        {/* Error Message */}
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        {/* Verify Button */}
                        <TouchableOpacity
                            style={[
                                styles.verifyButton,
                                isVerifying && styles.verifyButtonDisabled,
                            ]}
                            onPress={() => handleVerifyOtp()}
                            disabled={isVerifying}
                            activeOpacity={0.8}
                        >
                            {isVerifying ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                            )}
                        </TouchableOpacity>

                        {/* Resend Section */}
                        <View style={styles.resendSection}>
                            <Text style={styles.resendText}>Didn't receive the code?</Text>
                            {canResend ? (
                                <TouchableOpacity onPress={handleResendOtp}>
                                    <Text style={styles.resendLink}>Resend OTP</Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
                            )}
                        </View>

                        {/* Change Number */}
                        <TouchableOpacity
                            style={styles.changeNumberButton}
                            onPress={handleChangeNumber}
                        >
                            <Text style={styles.changeNumberText}>Change Mobile Number</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Security Note */}
                    <View style={styles.securityNote}>
                        <Text style={styles.securityIcon}>🔒</Text>
                        <Text style={styles.securityText}>
                            Your data is safe and secure with us
                        </Text>
                    </View>
                    <Text style={styles.supportText}>For assitance call 7003354703</Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 24 },
    header: { marginBottom: 16 },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingVertical: 8,
        paddingRight: 16,
        gap: 10,
    },
    backButtonIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    backButtonText: { fontSize: 16, color: "#475569", fontWeight: "500" },
    illustrationSection: { alignItems: "center", marginBottom: 32 },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#DBEAFE",
        alignItems: "center",
        justifyContent: "center",
    },
    iconText: { fontSize: 48 },
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
    title: { fontSize: 24, fontWeight: "700", color: "#0F172A", textAlign: "center" },
    titleBengali: { fontSize: 18, color: "#64748B", textAlign: "center", marginBottom: 16 },
    subtitle: { fontSize: 15, color: "#64748B", textAlign: "center" },
    phoneNumber: {
        fontSize: 18,
        fontWeight: "600",
        color: "#0F172A",
        textAlign: "center",
        marginBottom: 24,
    },
    otpContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 8,
    },
    otpInput: {
        flex: 1,
        height: 56,
        borderWidth: 2,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        fontSize: 24,
        fontWeight: "700",
        textAlign: "center",
        color: "#0F172A",
        backgroundColor: "#F8FAFC",
    },
    otpInputFilled: { borderColor: "#2563EB", backgroundColor: "#EEF2FF" },
    otpInputError: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
    errorText: { color: "#DC2626", fontSize: 14, marginBottom: 12, textAlign: "center" },
    verifyButton: {
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
    verifyButtonDisabled: { backgroundColor: "#93C5FD" },
    verifyButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
    resendSection: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 20,
        gap: 6,
    },
    resendText: { fontSize: 14, color: "#64748B" },
    resendLink: { fontSize: 14, color: "#2563EB", fontWeight: "600" },
    timerText: { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
    changeNumberButton: { marginTop: 16, paddingVertical: 12, alignItems: "center" },
    changeNumberText: { fontSize: 14, color: "#64748B", textDecorationLine: "underline" },
    securityNote: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 32,
        gap: 8,
    },
    securityIcon: { fontSize: 16 },
    securityText: { fontSize: 13, color: "#94A3B8" },
    supportText: {
        marginTop: 20,
        fontSize: 12,
        color: "#64748B",
        textAlign: "center",
    }
});
