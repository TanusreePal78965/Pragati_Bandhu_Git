import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/auth/LoginScreen";
import OtpScreen from "../screens/auth/OtpScreen";
import ShopSetupScreen from "../screens/auth/ShopSetupScreen";
import HelpCenterScreen from "../screens/settings/HelpCenterScreen";
import PrivacyPolicyScreen from "../screens/settings/PrivacyPolicyScreen";
import TermsOfServiceScreen from "../screens/settings/TermsOfServiceScreen";

export type AuthStackParamList = {
    Login: undefined;
    Otp: { phoneNumber: string } | undefined;
    ShopSetup: undefined;
    HelpCenter: undefined;
    PrivacyPolicy: undefined;
    TermsOfService: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
            <Stack.Screen name="ShopSetup" component={ShopSetupScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        </Stack.Navigator>
    );
}
