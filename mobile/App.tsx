import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { AuthProvider } from "./src/context/AuthContext";
import { VersionProvider, useVersion } from "./src/context/VersionContext";
import { stopSyncService } from "./src/services/syncService";
import RootNavigator from "./src/navigation/RootNavigator";
import { ForceUpdateModal } from "./src/components/ForceUpdateModal";
import { MaintenanceModal } from "./src/components/MaintenanceModal";
import { SoftUpdateModal } from "./src/components/SoftUpdateModal";

import { AlertProvider } from "./src/context/AlertContext";

WebBrowser.maybeCompleteAuthSession();

/**
 * Inner component so it can access AuthContext and VersionContext.
 */
function AppContent() {
  const {
    isForceUpdate,
    isSoftUpdate,
    isMaintenance,
    maintenanceMessage,
    updateTitle,
    updateMessage,
    storeUrl,
    checkVersion,
    dismissSoftUpdate,
  } = useVersion();

  useEffect(() => {
    // Check version rules on app launch
    checkVersion();

    // Re-check whenever user returns from Play Store / App Store to app
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkVersion();
      }
    });

    return () => {
      subscription.remove();
      stopSyncService();
    };
  }, [checkVersion]);

  return (
    <>
      <RootNavigator />
      <MaintenanceModal
        visible={isMaintenance}
        message={maintenanceMessage}
        onRetry={checkVersion}
      />
      <ForceUpdateModal
        visible={!isMaintenance && isForceUpdate}
        title={updateTitle}
        message={updateMessage}
        storeUrl={storeUrl}
      />
      <SoftUpdateModal
        visible={!isMaintenance && !isForceUpdate && isSoftUpdate}
        title={updateTitle}
        message={updateMessage}
        storeUrl={storeUrl}
        onDismiss={dismissSoftUpdate}
      />
    </>
  );
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
        <VersionProvider>
          <AlertProvider>
            <AppContent />
          </AlertProvider>
        </VersionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
