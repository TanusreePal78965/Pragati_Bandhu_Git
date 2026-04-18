import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabase } from "./src/db/sqlite";
import { AuthProvider } from "./src/context/AuthContext";
import { stopSyncService } from "./src/services/syncService";
import RootNavigator from "./src/navigation/RootNavigator";

/**
 * Inner component so it can access AuthContext (which requires being inside AuthProvider).
 */
function AppContent() {
  useEffect(() => {
    try {
      initDatabase();
    } catch (e) {
      console.error('DB init failed:', e);
    }

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
