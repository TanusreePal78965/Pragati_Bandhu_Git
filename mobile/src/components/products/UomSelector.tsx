import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { getAllProducts } from "../../db/db";

const POPULAR_UOMS = [
    "Pcs", "kg", "gm", "Liter", "ml", "Box", "Pack", "Dozen", "Pair", "Set", "Quintal", "Meter", "ft", "Bag", "Carton", "Strip", "Bottle"
];

export const ALL_KNOWN_UOMS = POPULAR_UOMS;

interface UomSelectorProps {
    selectedUom: string;
    onSelect: (uom: string) => void;
}

export default function UomSelector({ selectedUom, onSelect }: UomSelectorProps) {
    const isCustom = !POPULAR_UOMS.includes(selectedUom) && selectedUom !== "";
    const [showCustomInput, setShowCustomInput] = useState(isCustom);
    const [customValue, setCustomValue] = useState(isCustom ? selectedUom : "");

    // Dynamically sort UOMs by usage frequency in existing products
    const sortedUoms = useMemo(() => {
        try {
            const products = getAllProducts();
            const counts: Record<string, number> = {};
            products.forEach((p) => {
                if (p.uom) {
                    counts[p.uom] = (counts[p.uom] || 0) + 1;
                }
            });

            return [...POPULAR_UOMS].sort((a, b) => {
                const countA = counts[a] || 0;
                const countB = counts[b] || 0;
                if (countB !== countA) {
                    return countB - countA;
                }
                return POPULAR_UOMS.indexOf(a) - POPULAR_UOMS.indexOf(b);
            });
        } catch {
            return POPULAR_UOMS;
        }
    }, []);

    const handleKnownSelect = (uom: string) => {
        setShowCustomInput(false);
        onSelect(uom);
    };

    const handleOtherPress = () => {
        setShowCustomInput(true);
        if (customValue) {
            onSelect(customValue);
        }
    };

    const handleCustomChange = (text: string) => {
        setCustomValue(text);
        onSelect(text);
    };

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
            >
                {sortedUoms.map((uom) => {
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

                <TouchableOpacity
                    style={[styles.chip, styles.chipOther, showCustomInput && styles.chipActive]}
                    onPress={handleOtherPress}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="create-outline"
                        size={12}
                        color={showCustomInput ? "#fff" : colors.textSecondary}
                    />
                    <Text style={[styles.chipText, showCustomInput && styles.chipTextActive]}>
                        Custom
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {showCustomInput && (
                <View style={styles.customInputRow}>
                    <TextInput
                        style={styles.customInput}
                        placeholder="Type unit (e.g. Tablet, Vial)"
                        placeholderTextColor="#9ca3af"
                        value={customValue}
                        onChangeText={handleCustomChange}
                        autoFocus
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 6 },
    scrollContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 2,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#f1f5f9",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#cbd5e1",
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipOther: {
        borderColor: "#cbd5e1",
        backgroundColor: "#f8fafc",
    },
    chipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#334155",
    },
    chipTextActive: {
        color: "#fff",
    },
    customInputRow: {
        marginTop: 4,
    },
    customInput: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 36,
        fontSize: 13,
        color: colors.text,
    },
});
