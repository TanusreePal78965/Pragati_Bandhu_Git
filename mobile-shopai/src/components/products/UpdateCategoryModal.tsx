import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

interface UpdateCategoryModalProps {
    isVisible: boolean;
    onClose: () => void;
    selectedCount: number;
    categories: string[];
    onUpdate: (category: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    Grocery: "basket-outline",
    Dairy: "egg-outline",
    Beverages: "wine-outline",
    Snacks: "nutrition-outline",
    "Personal Care": "face-smile-outline",
    Household: "home-outline",
    Bakery: "cellular-outline",
};

export default function UpdateCategoryModal({
    isVisible,
    onClose,
    selectedCount,
    categories,
    onUpdate,
}: UpdateCategoryModalProps) {
    const [selected, setSelected] = useState(categories[0]);

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.content}>
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Title & Badge */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Update Category</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{selectedCount} Items Selected</Text>
                        </View>
                    </View>

                    {/* Category List */}
                    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.item,
                                    selected === cat && styles.selectedItem,
                                ]}
                                onPress={() => setSelected(cat)}
                            >
                                <View style={styles.itemLeft}>
                                    <View style={[
                                        styles.iconBox,
                                        selected === cat && styles.selectedIconBox
                                    ]}>
                                        <Ionicons
                                            name={(CATEGORY_ICONS[cat] || "folder-outline") as any}
                                            size={22}
                                            color={selected === cat ? colors.primary : colors.textSecondary}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.itemText,
                                            selected === cat && styles.selectedItemText,
                                        ]}
                                    >
                                        {cat}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={selected === cat ? "radio-button-on" : "radio-button-off"}
                                    size={24}
                                    color={selected === cat ? colors.primary : "#e5e7eb"}
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.updateButton}
                            onPress={() => onUpdate(selected)}
                        >
                            <Ionicons name="refresh-outline" size={20} color="#fff" />
                            <Text style={styles.updateButtonText}>Update Category</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    content: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "80%",
    },
    handle: {
        width: 48,
        height: 5,
        backgroundColor: "#e5e7eb",
        borderRadius: 2.5,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 20,
    },
    header: {
        alignItems: "center",
        paddingHorizontal: spacing.xl,
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 8,
    },
    badge: {
        backgroundColor: "#edf2ff",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    badgeText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: "600",
    },
    list: {
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.xl,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderWidth: 1,
        borderColor: "#f3f4f6",
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: "#fff",
    },
    selectedItem: {
        borderColor: colors.primary,
        backgroundColor: "#f8faff",
    },
    itemLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    selectedIconBox: {
        // Option to change icon background if needed
    },
    itemText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
    },
    selectedItemText: {
        color: colors.primary,
    },
    actions: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
        gap: 12,
    },
    updateButton: {
        backgroundColor: colors.primary,
        width: "100%",
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    updateButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    cancelButton: {
        width: "100%",
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: "#f9fafb",
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontWeight: "700",
        fontSize: 16,
    },
});
