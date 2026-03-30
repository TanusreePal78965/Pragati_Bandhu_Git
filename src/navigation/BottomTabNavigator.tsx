import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, Text } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

import HomeScreen from "../screens/home/HomeScreen";
import NewBillScreen from "../screens/billing/NewBillScreen"; // Or Add Screen
import ProductsScreen from "../screens/products/ProductsScreen";
import CustomersScreen from "../screens/customers/CustomersScreen";
import ReportsScreen from "../screens/reports/ReportsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";

export type BottomTabParamList = {
    Home: undefined;
    Inventory: undefined;
    Customers: undefined;
    Reports: undefined;
    Settings: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

export default function BottomTabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.tabInactive,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: "700",
                    marginBottom: Platform.OS === 'ios' ? 0 : 6,
                    textTransform: "uppercase"
                },
                tabBarStyle: {
                    height: Platform.OS === 'ios' ? 88 : 64,
                    backgroundColor: colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 8,
                },
                tabBarIcon: ({ focused, color }) => {
                    let iconName: keyof typeof Ionicons.glyphMap;

                    switch (route.name) {
                        case "Home":
                            iconName = focused ? "home" : "home-outline";
                            break;
                        case "Inventory":
                            iconName = focused ? "archive" : "archive-outline";
                            break;
                        case "Customers":
                            iconName = focused ? "people" : "people-outline";
                            break;
                        case "Reports":
                            iconName = focused ? "stats-chart" : "stats-chart-outline";
                            break;
                        case "Settings":
                            iconName = focused ? "settings" : "settings-outline";
                            break;
                        default:
                            iconName = "ellipse";
                    }

                    return <Ionicons name={iconName} size={22} color={color} />;
                },
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: "HOME" }}
            />
            <Tab.Screen
                name="Inventory"
                component={ProductsScreen}
                options={{ tabBarLabel: "INVENTORY" }}
            />
            <Tab.Screen
                name="Customers"
                component={CustomersScreen}
                options={{ tabBarLabel: "CUSTOMERS" }}
            />
            <Tab.Screen
                name="Reports"
                component={ReportsScreen}
                options={{ tabBarLabel: "REPORTS" }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ tabBarLabel: "SETTINGS" }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    // Keep this for later if needed for FAB implementation
});
