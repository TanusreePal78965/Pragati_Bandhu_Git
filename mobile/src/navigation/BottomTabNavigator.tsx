import React, { useEffect, useRef, useState } from "react";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, Text, TouchableOpacity, Animated, LayoutChangeEvent, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";

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

const triggerHaptic = () => {
    try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
        // Fallback
    }
    Vibration.vibrate(25);
};

interface TabButtonProps {
    route: any;
    isFocused: boolean;
    options: any;
    onPress: () => void;
    onLongPress: () => void;
}

function TabButton({ route, isFocused, options, onPress, onLongPress }: TabButtonProps) {
    const iconScale = useRef(new Animated.Value(isFocused ? 1.1 : 0.9)).current;

    useEffect(() => {
        Animated.spring(iconScale, {
            toValue: isFocused ? 1.15 : 0.9,
            friction: 5,
            tension: 140,
            useNativeDriver: true,
        }).start();
    }, [isFocused]);

    let iconName: keyof typeof Ionicons.glyphMap;

    switch (route.name) {
        case "Home":
            iconName = isFocused ? "home" : "home-outline";
            break;
        case "Inventory":
            iconName = isFocused ? "grid" : "grid-outline";
            break;
        case "Customers":
            iconName = isFocused ? "people" : "people-outline";
            break;
        case "Reports":
            iconName = isFocused ? "stats-chart" : "stats-chart-outline";
            break;
        case "Settings":
            iconName = isFocused ? "options" : "options-outline";
            break;
        default:
            iconName = "ellipse-outline";
    }

    const label =
        options.tabBarLabel !== undefined
            ? String(options.tabBarLabel)
            : options.title !== undefined
            ? options.title
            : route.name;

    const activeColor = colors.primary; // App primary blue (#1a57db)
    const inactiveColor = "#64748b";

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
            style={styles.tabItem}
        >
            <Animated.View
                style={{
                    transform: [{ scale: iconScale }],
                    alignItems: "center",
                }}
            >
                <Ionicons
                    name={iconName}
                    size={20}
                    color={isFocused ? activeColor : inactiveColor}
                />
            </Animated.View>
            <Text
                style={[
                    styles.tabLabel,
                    isFocused ? styles.activeTabLabel : styles.inactiveTabLabel,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const [barWidth, setBarWidth] = useState(0);
    const slideAnim = useRef(new Animated.Value(state.index)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: state.index,
            friction: 7,
            tension: 130,
            useNativeDriver: true,
        }).start();
    }, [state.index]);

    const handleLayout = (e: LayoutChangeEvent) => {
        setBarWidth(e.nativeEvent.layout.width);
    };

    const numTabs = state.routes.length;
    const tabWidth = barWidth > 0 ? (barWidth - 8) / numTabs : 0;

    const translateX = slideAnim.interpolate({
        inputRange: state.routes.map((_, i) => i),
        outputRange: state.routes.map((_, i) => i * tabWidth),
    });

    return (
        <View style={styles.tabBarContainer}>
            <View style={styles.pillBar} onLayout={handleLayout}>
                {barWidth > 0 && tabWidth > 0 && (
                    <Animated.View
                        style={[
                            styles.slidingPill,
                            {
                                width: tabWidth,
                                transform: [{ translateX }],
                            },
                        ]}
                    />
                )}
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        triggerHaptic();
                        const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        triggerHaptic();
                        navigation.emit({
                            type: "tabLongPress",
                            target: route.key,
                        });
                    };

                    return (
                        <TabButton
                            key={route.key}
                            route={route}
                            isFocused={isFocused}
                            options={options}
                            onPress={onPress}
                            onLongPress={onLongPress}
                        />
                    );
                })}
            </View>
        </View>
    );
}

export default function BottomTabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
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
    tabBarContainer: {
        position: "absolute",
        bottom: Platform.OS === "ios" ? 24 : 12,
        left: 10,
        right: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    pillBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#f8fafc",
        borderRadius: 36,
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
        width: "100%",
        position: "relative",
    },
    slidingPill: {
        position: "absolute",
        top: 4,
        bottom: 4,
        left: 4,
        backgroundColor: "#ffffff",
        borderRadius: 28,
        borderWidth: 1,
        borderColor: "#cbd5e1",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        paddingHorizontal: 1,
        borderRadius: 28,
        minHeight: 50,
        zIndex: 1,
    },
    tabLabel: {
        fontSize: 10,
        letterSpacing: -0.2,
        marginTop: 2,
        textAlign: "center",
    },
    activeTabLabel: {
        color: colors.primary,
        fontWeight: "700",
    },
    inactiveTabLabel: {
        color: "#64748b",
        fontWeight: "500",
    },
});




