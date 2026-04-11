import { useEffect } from "react";
import RootNavigator from "./src/navigation/RootNavigator";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabase } from "./src/db/sqlite";

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
