import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

import AuthNavigator from "./AuthNavigator";
import BottomTabNavigator from "./BottomTabNavigator";
import ShopSetupScreen from "../screens/auth/ShopSetupScreen";
import NewBillScreen from "../screens/billing/NewBillScreen";
import AddProductScreen from "../screens/products/AddProductScreen";
import ManageCategoriesScreen from "../screens/settings/ManageCategoriesScreen";
import ManageBrandsScreen from "../screens/settings/ManageBrandsScreen";
import AddCategoryScreen from "../screens/settings/AddCategoryScreen";
import AddBrandScreen from "../screens/settings/AddBrandScreen";
import AddCustomerScreen from "../screens/customers/AddCustomerScreen";
import BillsScreen from "../screens/billing/BillsScreen";
import BillDetailScreen from "../screens/billing/BillDetailScreen";
import EditShopScreen from "../screens/settings/EditShopScreen";
import ShopDeactivatedScreen from "../screens/auth/ShopDeactivatedScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const { isReady, isAuthenticated, isShopSetup, isShopActive } = useAuth();

    // Splash guard: don't render navigator until AsyncStorage check is done.
    // Prevents the login screen from flashing on a returning authenticated user.
    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
                <ActivityIndicator size="large" color="#1a57db" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!isAuthenticated ? (
                    // ── Unauthenticated: only auth screens accessible ──────────
                    <Stack.Screen name="Auth" component={AuthNavigator} />
                ) : !isShopSetup ? (
                    // ── Authenticated but no shop yet: force shop setup ────────
                    <Stack.Screen name="ShopSetup" component={ShopSetupScreen} />
                ) : !isShopActive ? (
                    // ── Shop deactivated by admin ──────────────────────────────
                    <Stack.Screen name="ShopDeactivated" component={ShopDeactivatedScreen} />
                ) : (
                    // ── Authenticated + shop ready: full app accessible ────────
                    <>
                        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />

                        {/* Stack screens / modals outside the tab bar */}
                        <Stack.Screen name="NewBill" component={NewBillScreen} />
                        <Stack.Screen name="AddProduct" component={AddProductScreen} />
                        <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
                        <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
                        <Stack.Screen name="ManageBrands" component={ManageBrandsScreen} />
                        <Stack.Screen name="AddBrand" component={AddBrandScreen} />
                        <Stack.Screen name="AddCustomer" component={AddCustomerScreen} />
                        <Stack.Screen name="Bills" component={BillsScreen} />
                        <Stack.Screen name="BillDetail" component={BillDetailScreen} />
                        <Stack.Screen name="EditShop" component={EditShopScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
