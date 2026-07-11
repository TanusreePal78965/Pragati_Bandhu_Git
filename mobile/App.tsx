import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { AuthProvider } from "./src/context/AuthContext";
import { stopSyncService } from "./src/services/syncService";
import RootNavigator from "./src/navigation/RootNavigator";

WebBrowser.maybeCompleteAuthSession();

/**
 * Inner component so it can access AuthContext (which requires being inside AuthProvider).
 */
function AppContent() {
  useEffect(() => {
    return () => {
      stopSyncService();
    };
  }, []);

  return <RootNavigator />;
}

export default function App() {
  const [loaded] = useFonts({
    ...Ionicons.font,
  });

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
