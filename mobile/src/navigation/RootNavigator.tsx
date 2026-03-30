import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthNavigator from "./AuthNavigator";
import BottomTabNavigator from "./BottomTabNavigator";
import NewBillScreen from "../screens/billing/NewBillScreen";
import AddProductScreen from "../screens/products/AddProductScreen";
import ManageCategoriesScreen from "../screens/settings/ManageCategoriesScreen";
import ManageBrandsScreen from "../screens/settings/ManageBrandsScreen";
import AddCategoryScreen from "../screens/settings/AddCategoryScreen";
import AddBrandScreen from "../screens/settings/AddBrandScreen";
import AddCustomerScreen from "../screens/customers/AddCustomerScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* Auth flow starts here */}
                <Stack.Screen name="Auth" component={AuthNavigator} />
                
                {/* App flow ends up here */}
                <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
                
                {/* Modal screens or screens outside of tabs */}
                <Stack.Screen name="NewBill" component={NewBillScreen} />
                <Stack.Screen name="AddProduct" component={AddProductScreen} />
                <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
                <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
                <Stack.Screen name="ManageBrands" component={ManageBrandsScreen} />
                <Stack.Screen name="AddBrand" component={AddBrandScreen} />
                <Stack.Screen name="AddCustomer" component={AddCustomerScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
