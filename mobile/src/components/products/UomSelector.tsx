import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

const UOM_GROUPS: { label: string; emoji: string; items: string[] }[] = [
    {
        label: "Weight",
        emoji: "⚖️",
        items: ["kg", "gm", "mg", "Quintal"],
    },
    {
        label: "Volume",
        emoji: "💧",
        items: ["Liter", "ml"],
    },
    {
        label: "Count",
        emoji: "🔢",
        items: ["Pcs", "Dozen", "Pair", "Set"],
    },
    {
        label: "Packaging",
        emoji: "📦",
        items: ["Pack", "Box", "Bag", "Carton", "Sachet", "Strip", "Bottle", "Roll", "Ream", "Bundle"],
    },
    {
        label: "Length",
        emoji: "📏",
        items: ["Meter", "ft"],
    },
];

// Flat list of all known UOMs for checking "is custom"
export const ALL_KNOWN_UOMS = UOM_GROUPS.flatMap((g) => g.items);

interface UomSelectorProps {
    selectedUom: string;
    onSelect: (uom: string) => void;
}

export default function UomSelector({ selectedUom, onSelect }: UomSelectorProps) {
    const isCustom = !ALL_KNOWN_UOMS.includes(selectedUom);
    const [showCustomInput, setShowCustomInput] = useState(isCustom);
    const [customValue, setCustomValue] = useState(isCustom ? selectedUom : "");

    const handleKnownSelect = (uom: string) => {
        setShowCustomInput(false);
        onSelect(uom);
    };

    const handleOtherPress = () => {
        setShowCustomInput(true);
        onSelect(customValue || "");
    };

    const handleCustomChange = (text: string) => {
        setCustomValue(text);
        onSelect(text);
    };

    return (
        <View style={styles.container}>
            {UOM_GROUPS.map((group) => (
                <View key={group.label} style={styles.group}>
                    <Text style={styles.groupLabel}>
                        {group.emoji}  {group.label}
                    </Text>
                    <View style={styles.chipsWrap}>
                        {group.items.map((uom) => {
                            const active = selectedUom === uom && !showCustomInput;
                            return (
                                <TouchableOpacity
                                    key={uom}
                                    style={[styles.chip, active && styles.chipActive]}
                                    onPress={() => handleKnownSelect(uom)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {uom}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ))}

            {/* Other / Custom */}
            <View style={styles.group}>
                <Text style={styles.groupLabel}>✏️  Other</Text>
                <View style={styles.chipsWrap}>
                    <TouchableOpacity
                        style={[styles.chip, styles.chipOther, showCustomInput && styles.chipActive]}
                        onPress={handleOtherPress}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="create-outline"
                            size={13}
                            color={showCustomInput ? "#fff" : colors.textSecondary}
                        />
                        <Text style={[styles.chipText, showCustomInput && styles.chipTextActive]}>
                            Custom
                        </Text>
                    </TouchableOpacity>
                </View>

                {showCustomInput && (
                    <View style={styles.customInputRow}>
                        <TextInput
                            style={styles.customInput}
                            placeholder="Type your unit (e.g. Vial, Tablet, Ampule)"
                            placeholderTextColor="#9ca3af"
                            value={customValue}
                            onChangeText={handleCustomChange}
                            autoFocus
                        />
                    </View>
                )}
            </View>

            {/* Selected indicator */}
            {selectedUom ? (
                <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    <Text style={styles.selectedText}>
                        Selected: <Text style={styles.selectedValue}>{selectedUom}</Text>
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 16 },
    group: { gap: 8 },
    groupLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#9ca3af",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    chipsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#f3f4f6",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "transparent",
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipOther: {
        borderColor: "#e5e7eb",
        backgroundColor: "#f9fafb",
    },
    chipText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#374151",
    },
    chipTextActive: {
        color: "#fff",
    },
    customInputRow: {
        marginTop: 4,
    },
    customInput: {
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderRadius: 10,
        paddingHorizontal: 14,
        height: 44,
        fontSize: 15,
        color: colors.text,
    },
    selectedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#eff6ff",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: "flex-start",
    },
    selectedText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    selectedValue: {
        color: colors.primary,
        fontWeight: "700",
    },
});
