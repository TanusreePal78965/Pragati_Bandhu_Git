import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, Text } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

import HomeScreen from "../screens/home/HomeScreen";
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
                    fontSize: 11,
                    fontWeight: "600",
                    marginBottom: Platform.OS === 'ios' ? 0 : 4,
                },
                tabBarStyle: {
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 34 : 20,
                    left: 20,
                    right: 20,
                    height: 64,
                    backgroundColor: colors.surface,
                    borderRadius: 20,
                    borderTopWidth: 0,
                    paddingTop: 8,
                    paddingBottom: 8,
                    // Shadow for iOS
                    shadowColor: "#000",
                    shadowOffset: {
                        width: 0,
                        height: 5,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    // Elevation for Android
                    elevation: 8,
                    // Ensure transparency for the floating effect
                    borderTopColor: 'transparent',
                },
                tabBarItemStyle: {
                    height: 56,
                },
                tabBarIcon: ({ focused, color }) => {
                    let iconName: keyof typeof Ionicons.glyphMap;

                    switch (route.name) {
                        case "Home":
                            iconName = focused ? "grid" : "grid-outline";
                            break;
                        case "Inventory":
                            iconName = focused ? "cube" : "cube-outline";
                            break;
                        case "Customers":
                            iconName = focused ? "people-circle" : "people-circle-outline";
                            break;
                        case "Reports":
                            iconName = focused ? "stats-chart" : "stats-chart-outline";
                            break;
                        case "Settings":
                            iconName = focused ? "options" : "options-outline";
                            break;
                        default:
                            iconName = "ellipse";
                    }

                    return (
                        <View style={[
                            styles.iconContainer,
                            focused && styles.activeIconContainer
                        ]}>
                            <Ionicons name={iconName} size={focused ? 24 : 22} color={color} />
                        </View>
                    );
                },
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: "Home" }}
            />
            <Tab.Screen
                name="Inventory"
                component={ProductsScreen}
                options={{ tabBarLabel: "Inventory" }}
            />
            <Tab.Screen
                name="Customers"
                component={CustomersScreen}
                options={{ tabBarLabel: "Customers" }}
            />
            <Tab.Screen
                name="Reports"
                component={ReportsScreen}
                options={{ tabBarLabel: "Reports" }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ tabBarLabel: "Settings" }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    activeIconContainer: {
        // Option to add a background pill or something for the focused icon
        // Currently just making it pop a bit more via icon size and weight
    },
});

