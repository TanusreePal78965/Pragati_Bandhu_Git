import * as Haptics from "expo-haptics";
import { Vibration } from "react-native";

export const haptics = {
    /** Light tap for subtle UI controls (+/- steppers, chip selection) */
    light: () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
        Vibration.vibrate(15);
    },

    /** Medium bump for primary buttons, FAB taps, mode toggles */
    medium: () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
        Vibration.vibrate(25);
    },

    /** Heavy feedback for high-stakes actions like delete, confirm payment */
    heavy: () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {}
        Vibration.vibrate(40);
    },

    /** Selection tick for pickers and list selections */
    selection: () => {
        try {
            Haptics.selectionAsync();
        } catch {}
        Vibration.vibrate(15);
    },

    /** Success pattern for checkout completed and save success */
    success: () => {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        Vibration.vibrate([0, 30, 50, 30]);
    },
};
