import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabase } from "./src/db/sqlite";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { startSyncService, stopSyncService } from "./src/services/syncService";
import RootNavigator from "./src/navigation/RootNavigator";

/**
 * Inner component so it can access AuthContext (which requires being inside AuthProvider).
 */
function AppContent() {
  const { setShopActive } = useAuth();

  useEffect(() => {
    try {
      initDatabase();
    } catch (e) {
      console.error('DB init failed:', e);
    }
    startSyncService(() => setShopActive(false)); // no-op for basic plan users (aiConsent = false)

    return () => {
      stopSyncService();
    };
  }, []);

  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
