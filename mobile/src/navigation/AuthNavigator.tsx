import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/auth/LoginScreen";
import OtpScreen from "../screens/auth/OtpScreen";
import ShopSetupScreen from "../screens/auth/ShopSetupScreen";

export type AuthStackParamList = {
    Login: undefined;
    Otp: { phoneNumber: string; devOtp?: string } | undefined;
    ShopSetup: undefined;
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
        </Stack.Navigator>
    );
}
