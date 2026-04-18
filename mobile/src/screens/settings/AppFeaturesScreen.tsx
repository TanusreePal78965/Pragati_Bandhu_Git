import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    LayoutAnimation,
    Platform,
    UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Data ────────────────────────────────────────────────────────────────────

interface FeaturePoint {
    icon: string;
    text: string;
}

interface FeatureSection {
    id: string;
    title: string;
    subtitle: string;
    iconName: string;
    accentColor: string;
    bgColor: string;
    badge?: string;
    points: FeaturePoint[];
    tip?: string;
}

const FEATURES: FeatureSection[] = [
    {
        id: "dashboard",
        title: "Dashboard",
        subtitle: "Your shop at a glance, every time you open the app",
        iconName: "home",
        accentColor: "#2563EB",
        bgColor: "#EFF6FF",
        points: [
            {
                icon: "cash-outline",
                text: "Today's Sales — see exactly how much you've earned today the moment you open the app.",
            },
            {
                icon: "alert-circle-outline",
                text: "Low Stock Alerts — products that are running below your set minimum threshold are highlighted so you never run out unexpectedly.",
            },
            {
                icon: "sparkles-outline",
                text: "AI Reorder Insights (Cloud users) — the same low-stock data is presented with an AI label and priority guidance when cloud backup is enabled.",
            },
            {
                icon: "receipt-outline",
                text: "Recent Bills — your last few transactions shown directly on the home screen for quick reference.",
            },
            {
                icon: "refresh-outline",
                text: "Auto-refresh — every time you switch back to the Home tab the data reloads from your local database instantly.",
            },
        ],
        tip: "The Home screen data is always live. If you just added a bill from the Billing tab, switch back to Home to see today's sales update immediately.",
    },
    {
        id: "products",
        title: "Products & Inventory",
        subtitle: "Add, organise, and track every item in your shop",
        iconName: "cube",
        accentColor: "#7C3AED",
        bgColor: "#F5F3FF",
        points: [
            {
                icon: "add-circle-outline",
                text: "Add Products — enter product name, purchase price, selling price, current stock quantity, and a minimum threshold level.",
            },
            {
                icon: "create-outline",
                text: "Edit Products — tap the pencil icon on any product card to update any field including price, stock count, or threshold. Changes take effect immediately.",
            },
            {
                icon: "trash-outline",
                text: "Delete Products — tap the trash icon on a product card. A confirmation alert appears before deletion. Historical bills still show the product name correctly.",
            },
            {
                icon: "search-outline",
                text: "Search — type any part of a product name or category name to filter your list in real time.",
            },
            {
                icon: "apps-outline",
                text: "Categories & Brands — organise products by creating categories (e.g. Dairy, Snacks) and brands (e.g. Amul, Britannia) from Settings → Manage Categories / Brands.",
            },
            {
                icon: "resize-outline",
                text: "Unit of Measure (UOM) — set units like Kg, Litre, Piece, Dozen, or enter a custom unit for any product.",
            },
            {
                icon: "trending-down-outline",
                text: "Automatic Stock Deduction — every time you save a bill, the stock quantity of each product in that bill is reduced automatically. No manual update needed.",
            },
        ],
        tip: "Set a realistic minimum threshold for every product (e.g. 10 for a fast-moving item). This is what drives Low Stock Alerts on the Dashboard.",
    },
    {
        id: "billing",
        title: "Billing",
        subtitle: "Create bills in seconds — cash or credit",
        iconName: "receipt",
        accentColor: "#059669",
        bgColor: "#ECFDF5",
        badge: "Most Used",
        points: [
            {
                icon: "search-outline",
                text: "Product Search — type at least 2 characters of a product name or category to see matching results. Tap to add to the bill.",
            },
            {
                icon: "add-outline",
                text: "Quantity Control — use the + / − buttons on each bill item to adjust quantity. Reducing to 0 removes the item from the bill.",
            },
            {
                icon: "cash-outline",
                text: "Cash Payment — default mode. Customer pays immediately. No customer selection needed for walk-in sales.",
            },
            {
                icon: "wallet-outline",
                text: "Udhar (Credit) — switch to Udhar mode when a customer wants to pay later. You must select a customer from your list. Their Udhar balance increases by the bill total.",
            },
            {
                icon: "eye-outline",
                text: "Estimate Preview — tap the ESTIMATE button any time to see a receipt-style preview of the current bill without saving it. Useful for showing the total to the customer before confirming.",
            },
            {
                icon: "person-outline",
                text: "Customer Selection — tap 'Select Customer' to pick from your customer list. You can search by name or phone number inside the modal.",
            },
            {
                icon: "checkmark-circle-outline",
                text: "Save Bill — tap Checkout to save the bill. Stock is deducted, udhar balance updated, and the bill appears in Bills History — all in one tap.",
            },
            {
                icon: "trash-outline",
                text: "Clear Bill — tap the trash icon in the header or 'Clear All' above items to remove all products and start fresh.",
            },
        ],
        tip: "For walk-in cash customers you don't need to select a customer at all. Just search products, set quantities, and tap Checkout.",
    },
    {
        id: "bills",
        title: "Bills History",
        subtitle: "Every bill, every transaction, always accessible",
        iconName: "time",
        accentColor: "#D97706",
        bgColor: "#FFFBEB",
        points: [
            {
                icon: "list-outline",
                text: "Full Bill List — all saved bills are listed with date, customer name (or 'Walk-in'), total amount, and payment mode badge.",
            },
            {
                icon: "document-text-outline",
                text: "Bill Detail — tap any bill to see the full itemised receipt: product names, quantities, unit prices, and grand total.",
            },
            {
                icon: "share-outline",
                text: "PDF Receipt — tap the share icon on any bill detail to generate a PDF receipt and share it via WhatsApp, email, or save to Files. The receipt includes your shop name, owner name, and phone number at the top.",
            },
            {
                icon: "archive-outline",
                text: "Permanent Record — bills are never deleted when you delete a product. The product name and price at time of sale are preserved forever.",
            },
        ],
        tip: "Send PDF receipts directly to customers on WhatsApp after a sale. It builds trust and reduces disputes over udhar amounts.",
    },
    {
        id: "customers",
        title: "Customers & Udhar",
        subtitle: "Track credit, collect payments, see who owes what",
        iconName: "people",
        accentColor: "#DC2626",
        bgColor: "#FFF1F2",
        points: [
            {
                icon: "person-add-outline",
                text: "Add Customer — save a customer's name (required), phone number, and address. They are then available in the billing screen for udhar transactions.",
            },
            {
                icon: "wallet-outline",
                text: "Udhar Balance — each customer's outstanding credit balance is shown in red on the customer list. The total across all customers is shown at the top of the screen.",
            },
            {
                icon: "create-outline",
                text: "Edit Customer — tap any customer row to edit their name, phone number, or address. Changes save immediately.",
            },
            {
                icon: "cash-outline",
                text: "Record Payment — when a customer pays back part or all of their udhar, tap 'Record Payment' on their profile. Enter the amount or use quick-fill chips (₹100, ₹200, ₹500, ₹1,000). The balance reduces immediately.",
            },
            {
                icon: "shield-checkmark-outline",
                text: "Balance Floor — the app prevents the balance from going below ₹0. You cannot accidentally enter a payment larger than what is owed.",
            },
            {
                icon: "receipt-outline",
                text: "Bill History per Customer — the last 10 bills linked to each customer are listed on their profile screen. Tap any bill to open the full receipt.",
            },
            {
                icon: "checkmark-circle-outline",
                text: "Cleared Status — when a customer's balance reaches ₹0, the card turns green and shows an 'All cleared' badge. The Record Payment button is automatically hidden.",
            },
            {
                icon: "search-outline",
                text: "Search Customers — search by name or phone number from the customer list.",
            },
        ],
        tip: "After creating a new customer, immediately create a test udhar bill for ₹1 to confirm they appear in billing's customer search. Then record a ₹1 payment to zero it out.",
    },
    {
        id: "reports",
        title: "Reports & Analytics",
        subtitle: "Understand your business — daily, weekly, monthly",
        iconName: "bar-chart",
        accentColor: "#0891B2",
        bgColor: "#ECFEFF",
        points: [
            {
                icon: "today-outline",
                text: "Three Time Periods — switch between Today, This Week (last 7 days), and This Month (1st to today) with one tap.",
            },
            {
                icon: "cash-outline",
                text: "Total Sales — sum of all bill totals in the selected period.",
            },
            {
                icon: "trending-up-outline",
                text: "Net Profit — real profit calculated from your purchase price vs selling price per item. Not an estimate — based on actual product cost data you entered.",
            },
            {
                icon: "card-outline",
                text: "Cash vs Udhar breakdown — see how much of your sales came in as immediate cash versus credit given to customers.",
            },
            {
                icon: "stats-chart-outline",
                text: "Top 5 Products — the 5 best-selling products by quantity in the selected period, with revenue per product.",
            },
            {
                icon: "list-outline",
                text: "Recent 10 Transactions — the last 10 bills with date, customer, and amount. Tap any to open the full bill detail.",
            },
            {
                icon: "document-outline",
                text: "PDF Report Export — tap 'Export PDF' to generate a shareable report containing your shop header, period summary stats, top products table, and recent transactions. Share or save it anywhere.",
            },
        ],
        tip: "Enter accurate purchase prices when adding products — that is what makes the Net Profit figure real. A product with purchase price = ₹0 contributes ₹0 to profit (not full selling price).",
    },
    {
        id: "data",
        title: "Data, Backup & Privacy",
        subtitle: "Your data — safe, private, and always yours",
        iconName: "cloud",
        accentColor: "#475569",
        bgColor: "#F8FAFC",
        points: [
            {
                icon: "phone-portrait-outline",
                text: "Offline-First — the entire app works without internet. Everything is saved to your phone's local database (SQLite) instantly. Internet is only needed for cloud sync.",
            },
            {
                icon: "cloud-upload-outline",
                text: "Cloud Backup (optional) — when enabled, all your data is automatically backed up to a secure cloud server (Supabase). New bills, products, and customers sync in the background.",
            },
            {
                icon: "cloud-download-outline",
                text: "Restore from Cloud — if you switch to a new phone, log in with the same number and tap 'Restore from Cloud' in Settings to get all your data back.",
            },
            {
                icon: "sync-outline",
                text: "Sync Queue — if you are offline when adding data, the changes are queued and automatically uploaded when you are back online. You can also tap 'Sync Now' in Settings to force an upload.",
            },
            {
                icon: "download-outline",
                text: "Export Backup (.json) — create a local backup file of all your data and save it to your phone or share it to cloud storage. Always shown a privacy warning before export.",
            },
            {
                icon: "folder-open-outline",
                text: "Import from Backup — restore data from a previously exported .json file. The app warns you if the backup belongs to a different shop number.",
            },
            {
                icon: "eye-off-outline",
                text: "Local-Only Mode — choose 'This Phone Only' during setup to keep all data strictly on your device. No data ever leaves your phone. You can enable cloud backup later from Settings.",
            },
            {
                icon: "lock-closed-outline",
                text: "Privacy — your data is tied to your phone number and protected by Row-Level Security on the cloud. No other shop can access your data.",
            },
        ],
        tip: "If you chose 'This Phone Only' during setup, you can still enable cloud backup later from Settings → Enable Cloud Backup. All your existing data will be uploaded automatically.",
    },
    {
        id: "settings",
        title: "Settings & Customisation",
        subtitle: "Tailor the app to your shop",
        iconName: "settings",
        accentColor: "#9333EA",
        bgColor: "#FAF5FF",
        points: [
            {
                icon: "storefront-outline",
                text: "Edit Shop Info — update your shop name, owner name, WhatsApp number, and business category from the pencil icon on the Settings profile card.",
            },
            {
                icon: "apps-outline",
                text: "Manage Categories — create and delete product categories. Categories help you organise your inventory and search products faster.",
            },
            {
                icon: "pricetag-outline",
                text: "Manage Brands — create and delete brand names. When editing a product, choose 'None' to remove a brand assignment.",
            },
            {
                icon: "help-circle-outline",
                text: "Help Center — in-app answers to common questions without needing internet.",
            },
            {
                icon: "information-circle-outline",
                text: "App Version — shows the current version. Tapping it 5 times reveals a debug export option for technical support.",
            },
            {
                icon: "log-out-outline",
                text: "Logout — signs you out but does NOT delete your local data. Log back in with the same number and everything is still there.",
            },
            {
                icon: "trash-outline",
                text: "Delete All Data — permanently erases all local data and optionally cloud data. A double-confirmation is required. This cannot be undone.",
            },
        ],
        tip: "Your shop name appears on every PDF receipt and report. Keep it accurate in Settings so every document looks professional.",
    },
];

// ─── Card component ───────────────────────────────────────────────────────────

function FeatureCard({ section }: { section: FeatureSection }) {
    const [expanded, setExpanded] = useState(false);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((v) => !v);
    };

    return (
        <View style={styles.card}>
            {/* Card header — always visible, tap to expand */}
            <TouchableOpacity style={styles.cardHeader} onPress={toggle} activeOpacity={0.7}>
                <View style={[styles.cardIconBox, { backgroundColor: section.bgColor }]}>
                    <Ionicons name={section.iconName as any} size={26} color={section.accentColor} />
                </View>
                <View style={styles.cardHeaderText}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{section.title}</Text>
                        {section.badge && (
                            <View style={[styles.badgePill, { backgroundColor: section.accentColor }]}>
                                <Text style={styles.badgePillText}>{section.badge}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
                </View>
                <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#94A3B8"
                    style={styles.chevron}
                />
            </TouchableOpacity>

            {/* Expandable content */}
            {expanded && (
                <View style={styles.cardBody}>
                    <View style={[styles.divider, { backgroundColor: section.bgColor }]} />

                    {section.points.map((point, idx) => (
                        <View key={idx} style={styles.pointRow}>
                            <View style={[styles.pointIconBox, { backgroundColor: section.bgColor }]}>
                                <Ionicons name={point.icon as any} size={16} color={section.accentColor} />
                            </View>
                            <Text style={styles.pointText}>{point.text}</Text>
                        </View>
                    ))}

                    {section.tip && (
                        <View style={[styles.tipBox, { borderLeftColor: section.accentColor }]}>
                            <View style={styles.tipHeader}>
                                <Ionicons name="bulb-outline" size={15} color={section.accentColor} />
                                <Text style={[styles.tipLabel, { color: section.accentColor }]}>Pro Tip</Text>
                            </View>
                            <Text style={styles.tipText}>{section.tip}</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AppFeaturesScreen() {
    const navigation = useNavigation();

    const [allExpanded, setAllExpanded] = useState(false);

    const toggleAll = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setAllExpanded((v) => !v);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" backgroundColor="#2563EB" translucent={true} />

            {/* ── Hero Header ──────────────────────────────────────────────── */}
            <View style={styles.hero}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <View style={styles.heroContent}>
                    <View style={styles.heroIconBox}>
                        <Ionicons name="sparkles" size={28} color="#FCD34D" />
                    </View>
                    <Text style={styles.heroTitle}>App Features</Text>
                    <Text style={styles.heroSubtitle}>
                        Everything PragatiBandhu can do for your shop — tap any section to explore
                    </Text>
                </View>

                {/* Quick-stat pills */}
                <View style={styles.heroPills}>
                    <View style={styles.heroPill}>
                        <Ionicons name="phone-portrait-outline" size={14} color="#fff" />
                        <Text style={styles.heroPillText}>Works Offline</Text>
                    </View>
                    <View style={styles.heroPill}>
                        <Ionicons name="flash-outline" size={14} color="#fff" />
                        <Text style={styles.heroPillText}>Instant Billing</Text>
                    </View>
                    <View style={styles.heroPill}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                        <Text style={styles.heroPillText}>Private & Secure</Text>
                    </View>
                </View>
            </View>

            {/* ── Content ──────────────────────────────────────────────────── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Expand/Collapse all */}
                <View style={styles.expandAllRow}>
                    <Text style={styles.sectionCount}>{FEATURES.length} feature areas</Text>
                    <TouchableOpacity onPress={toggleAll} style={styles.expandAllBtn}>
                        <Ionicons
                            name={allExpanded ? "contract-outline" : "expand-outline"}
                            size={16}
                            color="#2563EB"
                        />
                        <Text style={styles.expandAllText}>
                            {allExpanded ? "Collapse All" : "Expand All"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {FEATURES.map((section) => (
                    <ExpandControlledCard
                        key={section.id}
                        section={section}
                        forceExpanded={allExpanded}
                    />
                ))}

                {/* Footer note */}
                <View style={styles.footer}>
                    <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
                    <Text style={styles.footerText}>
                        PragatiBandhu v1.0 · Features marked with ✨ require Cloud Backup to be enabled.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Expand-controlled card wrapper ──────────────────────────────────────────

function ExpandControlledCard({
    section,
    forceExpanded,
}: {
    section: FeatureSection;
    forceExpanded: boolean;
}) {
    const [localExpanded, setLocalExpanded] = useState(false);
    const isExpanded = forceExpanded || localExpanded;

    const toggle = () => {
        if (!forceExpanded) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLocalExpanded((v) => !v);
        }
    };

    return (
        <View style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={toggle} activeOpacity={0.7}>
                <View style={[styles.cardIconBox, { backgroundColor: section.bgColor }]}>
                    <Ionicons name={section.iconName as any} size={26} color={section.accentColor} />
                </View>
                <View style={styles.cardHeaderText}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{section.title}</Text>
                        {section.badge && (
                            <View style={[styles.badgePill, { backgroundColor: section.accentColor }]}>
                                <Text style={styles.badgePillText}>{section.badge}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
                </View>
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#94A3B8"
                    style={styles.chevron}
                />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.cardBody}>
                    <View style={[styles.divider, { backgroundColor: section.bgColor }]} />

                    {section.points.map((point, idx) => (
                        <View key={idx} style={styles.pointRow}>
                            <View style={[styles.pointIconBox, { backgroundColor: section.bgColor }]}>
                                <Ionicons name={point.icon as any} size={16} color={section.accentColor} />
                            </View>
                            <Text style={styles.pointText}>{point.text}</Text>
                        </View>
                    ))}

                    {section.tip && (
                        <View style={[styles.tipBox, { borderLeftColor: section.accentColor }]}>
                            <View style={styles.tipHeader}>
                                <Ionicons name="bulb-outline" size={15} color={section.accentColor} />
                                <Text style={[styles.tipLabel, { color: section.accentColor }]}>Pro Tip</Text>
                            </View>
                            <Text style={styles.tipText}>{section.tip}</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#2563EB" },

    // Hero
    hero: {
        backgroundColor: "#2563EB",
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 24,
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    heroContent: { alignItems: "center", marginBottom: 20 },
    heroIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: "800",
        color: "#fff",
        textAlign: "center",
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        color: "rgba(255,255,255,0.8)",
        textAlign: "center",
        lineHeight: 20,
        paddingHorizontal: 16,
    },
    heroPills: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
    },
    heroPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "rgba(255,255,255,0.15)",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    heroPillText: { fontSize: 12, color: "#fff", fontWeight: "600" },

    // Scroll
    scroll: { flex: 1, backgroundColor: "#F8FAFC" },
    scrollContent: { padding: 16 },

    // Expand all row
    expandAllRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionCount: { fontSize: 13, color: "#64748B", fontWeight: "500" },
    expandAllBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: "#EFF6FF",
        borderRadius: 8,
    },
    expandAllText: { fontSize: 13, color: "#2563EB", fontWeight: "600" },

    // Card
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 14,
    },
    cardIconBox: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    cardHeaderText: { flex: 1 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    cardTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
    cardSubtitle: { fontSize: 13, color: "#64748B", lineHeight: 18 },
    chevron: { flexShrink: 0 },
    badgePill: {
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgePillText: { fontSize: 11, color: "#fff", fontWeight: "700" },

    // Card body
    cardBody: { paddingHorizontal: 16, paddingBottom: 16 },
    divider: { height: 1, marginBottom: 16, borderRadius: 1 },

    // Points
    pointRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 14,
    },
    pointIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
    },
    pointText: {
        flex: 1,
        fontSize: 14,
        color: "#374151",
        lineHeight: 21,
    },

    // Tip
    tipBox: {
        marginTop: 4,
        padding: 14,
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        borderLeftWidth: 3,
    },
    tipHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    tipLabel: { fontSize: 13, fontWeight: "700" },
    tipText: { fontSize: 13, color: "#475569", lineHeight: 20 },

    // Footer
    footer: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginTop: 8,
    },
    footerText: { flex: 1, fontSize: 12, color: "#94A3B8", lineHeight: 18 },
});
