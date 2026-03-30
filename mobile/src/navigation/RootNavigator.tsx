import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthNavigator from "./AuthNavigator";
import BottomTabNavigator from "./BottomTabNavigator";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* Auth flow starts here */}
                <Stack.Screen name="Auth" component={AuthNavigator} />
                
                {/* App flow ends up here */}
                <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
