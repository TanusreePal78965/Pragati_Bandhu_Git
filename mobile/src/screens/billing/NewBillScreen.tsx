import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    StatusBar,
    ScrollView,
    Modal,
    Alert,
    Pressable,
    SafeAreaView as RNSafeAreaView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import {
    getAllProducts,
    getAllCustomers,
    getAllCategories,
    getCustomerById,
    createDraft,
    upsertDraft,
    upsertDraftItems,
    getDraftById,
    getAllDrafts,
    deleteDraft,
    finalizeDraft,
    getReservationsMap,
    cleanupOldDrafts,
    DraftSummary,
    Product,
    Customer,
    Category,
} from "../../db/db";
import DraftSwitcherModal from "../../components/billing/DraftSwitcherModal";

interface BillItem {
    product_id: string;
    product_name: string;
    qty: number;           // always in base units
    unit_price: number;    // always per base unit
    purchase_price: number;// purchase price per base unit
    uom: string;           // base UOM (e.g. "Pcs")
    units_per_pack: number | null;
    purchase_uom: string | null;
    is_pack_mode: boolean; // currently selling in pack units
}

export default function NewBillScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    const [draftId, setDraftId] = useState<string | null>(null);
    const [paymentMode, setPaymentMode] = useState<"cash" | "udhar" | "upi">("cash");
    const [billItems, setBillItems] = useState<BillItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerSearch, setCustomerSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [showEstimate, setShowEstimate] = useState(false);
    const [allDrafts, setAllDrafts] = useState<DraftSummary[]>([]);
    const [showDraftSwitcher, setShowDraftSwitcher] = useState(false);
    const [reservedQtyMap, setReservedQtyMap] = useState<Record<string, number>>({});
    const [editingQty, setEditingQty] = useState<Record<string, string>>({});
    const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
    const [discountType, setDiscountType] = useState<"none" | "5" | "10" | "15" | "20" | "custom">("none");
    const [customDiscountText, setCustomDiscountText] = useState("");
    const [customDiscountMode, setCustomDiscountMode] = useState<"percent" | "flat">("percent");
    const [activeDiscountPercent, setActiveDiscountPercent] = useState<number>(0);
    const [showDiscountSection, setShowDiscountSection] = useState(false);
    const [showDiscountWarningModal, setShowDiscountWarningModal] = useState(false);
    const [pendingDiscountType, setPendingDiscountType] = useState<"none" | "5" | "10" | "15" | "20" | "custom">("none");
    const [pendingDiscountPercent, setPendingDiscountPercent] = useState<number>(0);
    const [warningItemsList, setWarningItemsList] = useState<{ name: string; discountedPrice: number; purchasePrice: number; uom: string }[]>([]);

    const [showProductSelectModal, setShowProductSelectModal] = useState(false);
    const [modalSearch, setModalSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedModalItems, setSelectedModalItems] = useState<Record<string, { qty: number; isPackMode: boolean }>>({});

    const isDraftLoadedRef = useRef(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Initialise draft on mount ─────────────────────────────────────────────
    useEffect(() => {
        cleanupOldDrafts();
        const paramDraftId: string | undefined = route.params?.draftId;
        if (paramDraftId) {
            const { draft, items } = getDraftById(paramDraftId);
            if (draft) {
                const allProds = getAllProducts();
                setDraftId(paramDraftId);
                setPaymentMode(draft.payment_mode);
                setBillItems(
                    items.map((i) => {
                        const prod = allProds.find((p) => p.id === i.product_id);
                        return {
                            product_id: i.product_id,
                            product_name: i.product_name,
                            qty: i.qty,
                            unit_price: i.unit_price,
                            purchase_price: prod ? prod.purchase_price : 0,
                            uom: i.uom,
                            units_per_pack: i.units_per_pack,
                            purchase_uom: i.purchase_uom,
                            is_pack_mode: i.is_pack_mode === 1,
                        };
                    })
                );
                if (draft.customer_id) {
                    const customer = getCustomerById(draft.customer_id);
                    if (customer) setSelectedCustomer(customer);
                }
                if (draft.discount_type && draft.discount_type !== 'none') {
                    if (draft.discount_type === 'custom_flat') {
                        setDiscountType('custom');
                        setCustomDiscountMode('flat');
                        setActiveDiscountPercent(draft.discount_percent ?? 0);
                        setCustomDiscountText(String(draft.discount_amount ?? 0));
                    } else if (draft.discount_type === 'custom_percent') {
                        setDiscountType('custom');
                        setCustomDiscountMode('percent');
                        setActiveDiscountPercent(draft.discount_percent ?? 0);
                        setCustomDiscountText(String(draft.discount_percent ?? 0));
                    } else {
                        setDiscountType(draft.discount_type as any);
                        setActiveDiscountPercent(draft.discount_percent ?? 0);
                    }
                }
            } else {
                // Draft was deleted (e.g. cleanup) — create fresh
                const newId = createDraft();
                setDraftId(newId);
            }
        } else {
            const newId = createDraft();
            setDraftId(newId);
        }
        isDraftLoadedRef.current = true;
    }, []); // only on mount

    // ── Refresh products, customers, drafts list, reservation map on focus ────
    useFocusEffect(
        useCallback(() => {
            setProducts(getAllProducts());
            setCustomers(getAllCustomers());
            setAllDrafts(getAllDrafts());
            setCategories(getAllCategories());
        }, [])
    );

    // Update reservation map whenever draftId is known
    useEffect(() => {
        if (draftId) {
            setReservedQtyMap(getReservationsMap(draftId));
        }
    }, [draftId]);

    // ── Auto-save draft on any cart/customer/mode change ─────────────────────
    useEffect(() => {
        if (!isDraftLoadedRef.current || !draftId) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            upsertDraft(
                draftId,
                selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
                paymentMode
            );
            upsertDraftItems(
                draftId,
                billItems.map((i) => ({
                    product_id: i.product_id,
                    product_name: i.product_name,
                    qty: i.qty,
                    unit_price: i.unit_price,
                    line_total: i.qty * i.unit_price,
                    display_qty: getDisplayQty(i),
                    uom: i.uom,
                    units_per_pack: i.units_per_pack,
                    purchase_uom: i.purchase_uom,
                    is_pack_mode: i.is_pack_mode,
                }))
            );
            // Refresh drafts list so switcher shows latest totals
            setAllDrafts(getAllDrafts());
        }, 400);
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [draftId, billItems, selectedCustomer, paymentMode]);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const getDisplayQty = (item: BillItem): string => {
        if (item.is_pack_mode && item.units_per_pack && item.purchase_uom) {
            return `${item.qty / item.units_per_pack} ${item.purchase_uom}`;
        }
        return `${item.qty} ${item.uom}`;
    };

    const getDisplayPrice = (item: BillItem): string => {
        if (item.is_pack_mode && item.units_per_pack && item.purchase_uom) {
            return `₹${(item.unit_price * item.units_per_pack).toFixed(2)} / ${item.purchase_uom}`;
        }
        return `₹${item.unit_price.toFixed(2)} / ${item.uom}`;
    };

    const getQtyStepDisplay = (item: BillItem): number => {
        if (item.is_pack_mode && item.units_per_pack) {
            return item.qty / item.units_per_pack;
        }
        return item.qty;
    };

    // Available qty for a product considering other drafts' reservations
    const availQty = (productId: string, stockQty: number): number =>
        Math.max(0, stockQty - (reservedQtyMap[productId] ?? 0));

    // ── Cart actions ──────────────────────────────────────────────────────────

    const searchResults = search.trim().length > 1
        ? products.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.category_name ?? "").toLowerCase().includes(search.toLowerCase())
        ).slice(0, 8)
        : [];

    const addProduct = (product: Product) => {
        const avail = availQty(product.id, product.stock_quantity);
        if (avail <= 0) {
            Alert.alert("Out of Stock", `"${product.name}" is out of stock or fully reserved in another bill.`);
            return;
        }
        const existing = billItems.find((i) => i.product_id === product.id);
        if (existing) {
            if (existing.qty >= avail) {
                Alert.alert("Stock Limit", `Only ${avail} unit(s) of "${product.name}" available.`);
                return;
            }
            setBillItems((prev) =>
                prev.map((i) =>
                    i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i
                )
            );
        } else {
            setBillItems((prev) => [
                ...prev,
                {
                    product_id: product.id,
                    product_name: product.name,
                    qty: 1,
                    unit_price: product.selling_price,
                    purchase_price: product.purchase_price ?? 0,
                    uom: product.uom,
                    units_per_pack: product.units_per_pack ?? null,
                    purchase_uom: product.purchase_uom ?? null,
                    is_pack_mode: false,
                },
            ]);
        }
        setSearch("");
    };

    const updateQty = (productId: string, delta: number) => {
        if (editingQty[productId] !== undefined) {
            setEditingQty((prev) => {
                const copy = { ...prev };
                delete copy[productId];
                return copy;
            });
        }
        const item = billItems.find((i) => i.product_id === productId);
        const product = products.find((p) => p.id === productId);
        if (!item || !product) return;

        const avail = availQty(product.id, product.stock_quantity);
        const step = item.is_pack_mode && item.units_per_pack ? item.units_per_pack : 1;
        const baseStep = delta > 0 ? step : -step;

        if (delta > 0) {
            if (item.qty + step > avail) {
                const availPacks = item.units_per_pack
                    ? Math.floor(avail / item.units_per_pack)
                    : avail;
                const unit = item.is_pack_mode && item.purchase_uom ? item.purchase_uom : product.uom;
                Alert.alert("Stock Limit", `Only ${availPacks} ${unit}(s) of "${product.name}" available.`);
                return;
            }
        }
        setBillItems((prev) =>
            prev
                .map((i) => (i.product_id === productId ? { ...i, qty: i.qty + baseStep } : i))
                .filter((i) => i.qty > 0)
        );
    };

    const handleQtyTextChange = (productId: string, text: string) => {
        const sanitized = text.replace(/[^0-9.]/g, "");
        const dots = (sanitized.match(/\./g) || []).length;
        if (dots > 1) return;

        setEditingQty((prev) => ({ ...prev, [productId]: sanitized }));

        if (sanitized === "" || sanitized === ".") {
            return;
        }

        const newQty = parseFloat(sanitized);
        if (isNaN(newQty) || newQty < 0) return;

        const product = products.find((p) => p.id === productId);
        const item = billItems.find((i) => i.product_id === productId);
        if (!product || !item) return;

        const factor = item.is_pack_mode && item.units_per_pack ? item.units_per_pack : 1;
        const baseQty = newQty * factor;

        const avail = availQty(product.id, product.stock_quantity);
        if (baseQty > avail) {
            const availDisplay = item.is_pack_mode && item.units_per_pack
                ? Math.floor(avail / item.units_per_pack)
                : avail;
            const unit = item.is_pack_mode && item.purchase_uom ? item.purchase_uom : product.uom;
            Alert.alert("Stock Limit", `Only ${availDisplay} ${unit}(s) of "${product.name}" available.`);
            
            const snappedText = String(availDisplay);
            setEditingQty((prev) => ({ ...prev, [productId]: snappedText }));
            setBillItems((prev) =>
                prev.map((i) => (i.product_id === productId ? { ...i, qty: avail } : i))
            );
            return;
        }

        setBillItems((prev) =>
            prev.map((i) => (i.product_id === productId ? { ...i, qty: baseQty } : i))
        );
    };

    const handleQtyBlur = (productId: string) => {
        const item = billItems.find((i) => i.product_id === productId);
        if (!item) {
            setEditingQty((prev) => {
                const copy = { ...prev };
                delete copy[productId];
                return copy;
            });
            return;
        }

        const currentText = editingQty[productId];
        const parsed = parseFloat(currentText);

        if (!currentText || isNaN(parsed) || parsed <= 0) {
            const defaultQty = item.is_pack_mode && item.units_per_pack ? item.units_per_pack : 1;
            setBillItems((prev) =>
                prev.map((i) => (i.product_id === productId ? { ...i, qty: defaultQty } : i))
            );
        }

        setEditingQty((prev) => {
            const copy = { ...prev };
            delete copy[productId];
            return copy;
        });
    };

    const togglePackMode = (productId: string) => {
        setBillItems((prev) =>
            prev.map((i) => {
                if (i.product_id !== productId || !i.units_per_pack) return i;
                const newPackMode = !i.is_pack_mode;
                const snappedQty = newPackMode
                    ? Math.max(i.units_per_pack, Math.round(i.qty / i.units_per_pack) * i.units_per_pack)
                    : i.qty;
                return { ...i, is_pack_mode: newPackMode, qty: snappedQty };
            })
        );
    };

    // ── Price Edit Handlers ───────────────────────────────────────────────────

    const getUnitPriceDisplay = (item: BillItem): string => {
        if (item.is_pack_mode && item.units_per_pack) {
            return String(Number((item.unit_price * item.units_per_pack).toFixed(2)));
        }
        return String(Number(item.unit_price.toFixed(2)));
    };

    const handlePriceTextChange = (productId: string, text: string) => {
        const sanitized = text.replace(/[^0-9.]/g, "");
        const dots = (sanitized.match(/\./g) || []).length;
        if (dots > 1) return;

        setEditingPrice((prev) => ({ ...prev, [productId]: sanitized }));

        if (sanitized === "" || sanitized === ".") {
            return;
        }

        const inputPrice = parseFloat(sanitized);
        if (isNaN(inputPrice)) return;

        const item = billItems.find((i) => i.product_id === productId);
        if (!item) return;

        const effectivePurchasePrice = item.is_pack_mode && item.units_per_pack
            ? item.purchase_price * item.units_per_pack
            : item.purchase_price;

        if (inputPrice > effectivePurchasePrice) {
            const newUnitPrice = item.is_pack_mode && item.units_per_pack
                ? inputPrice / item.units_per_pack
                : inputPrice;

            setBillItems((prev) =>
                prev.map((i) => (i.product_id === productId ? { ...i, unit_price: newUnitPrice } : i))
            );
        }
    };

    const handlePriceBlur = (productId: string) => {
        const item = billItems.find((i) => i.product_id === productId);
        if (!item) {
            setEditingPrice((prev) => {
                const copy = { ...prev };
                delete copy[productId];
                return copy;
            });
            return;
        }

        const currentText = editingPrice[productId];
        const parsed = parseFloat(currentText);

        const effectivePurchasePrice = item.is_pack_mode && item.units_per_pack
            ? item.purchase_price * item.units_per_pack
            : item.purchase_price;

        const unitStr = item.is_pack_mode && item.purchase_uom ? item.purchase_uom : item.uom;

        if (!currentText || isNaN(parsed) || parsed <= effectivePurchasePrice) {
            Alert.alert(
                "Invalid Price",
                `Selling price cannot be equal to or less than the purchase price (₹${effectivePurchasePrice.toFixed(2)} per ${unitStr}).`
            );
        }

        setEditingPrice((prev) => {
            const copy = { ...prev };
            delete copy[productId];
            return copy;
        });
    };

    const totalItems = billItems.reduce((acc, i) => acc + i.qty, 0);
    const subtotal = billItems.reduce((acc, i) => acc + i.qty * i.unit_price, 0);
    const discountAmount = subtotal * (activeDiscountPercent / 100);
    const grandTotal = Math.max(0, subtotal - discountAmount);

    const checkDiscountWarnings = (percent: number) => {
        if (percent <= 0 || billItems.length === 0) return [];
        const warnings: { name: string; discountedPrice: number; purchasePrice: number; uom: string }[] = [];

        billItems.forEach((item) => {
            const factor = item.is_pack_mode && item.units_per_pack ? item.units_per_pack : 1;
            const effectiveSelling = item.unit_price * factor;
            const effectivePurchase = item.purchase_price * factor;
            const discountedSelling = effectiveSelling * (1 - percent / 100);

            if (discountedSelling <= effectivePurchase && effectiveSelling > 0) {
                warnings.push({
                    name: item.product_name,
                    discountedPrice: discountedSelling,
                    purchasePrice: effectivePurchase,
                    uom: item.is_pack_mode && item.purchase_uom ? item.purchase_uom : item.uom,
                });
            }
        });
        return warnings;
    };

    const handleApplyDiscount = (
        type: "none" | "5" | "10" | "15" | "20" | "custom",
        percent: number
    ) => {
        if (type === "none" || percent <= 0) {
            setDiscountType("none");
            setActiveDiscountPercent(0);
            return;
        }

        const warnings = checkDiscountWarnings(percent);
        if (warnings.length > 0) {
            setPendingDiscountType(type);
            setPendingDiscountPercent(percent);
            setWarningItemsList(warnings);
            setShowDiscountWarningModal(true);
        } else {
            setDiscountType(type);
            setActiveDiscountPercent(percent);
        }
    };

    const confirmDiscountModal = () => {
        setDiscountType(pendingDiscountType);
        setActiveDiscountPercent(pendingDiscountPercent);
        setShowDiscountWarningModal(false);
    };

    const cancelDiscountModal = () => {
        setShowDiscountWarningModal(false);
    };

    // ── Navigation / draft actions ────────────────────────────────────────────

    const saveNow = () => {
        if (!draftId) return;
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        const finalDiscountType = discountType === "custom"
            ? (customDiscountMode === "flat" ? "custom_flat" : "custom_percent")
            : discountType;

        upsertDraft(
            draftId,
            selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
            paymentMode,
            activeDiscountPercent,
            discountAmount,
            finalDiscountType
        );
        upsertDraftItems(
            draftId,
            billItems.map((i) => ({
                product_id: i.product_id,
                product_name: i.product_name,
                qty: i.qty,
                unit_price: i.unit_price,
                line_total: i.qty * i.unit_price,
                display_qty: getDisplayQty(i),
                uom: i.uom,
                units_per_pack: i.units_per_pack,
                purchase_uom: i.purchase_uom,
                is_pack_mode: i.is_pack_mode,
            }))
        );
    };

    const handleBack = () => {
        if (draftId) {
            if (billItems.length === 0) {
                deleteDraft(draftId);
            } else {
                saveNow();
            }
        }
        navigation.goBack();
    };

    const handleDiscard = () => {
        Alert.alert(
            "Discard Bill",
            "Discard this bill? All items will be lost.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => {
                        if (draftId) deleteDraft(draftId);
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const handleHoldAndNew = () => {
        if (draftId) {
            if (billItems.length === 0) {
                deleteDraft(draftId);
            } else {
                saveNow();
            }
        }
        navigation.replace("NewBill");
    };

    const handleSelectDraft = (targetDraftId: string) => {
        if (targetDraftId === draftId) return;
        if (draftId) {
            if (billItems.length === 0) {
                deleteDraft(draftId);
            } else {
                saveNow();
            }
        }
        navigation.replace("NewBill", { draftId: targetDraftId });
    };

    const handleDiscardOtherDraft = (targetDraftId: string) => {
        deleteDraft(targetDraftId);
        setAllDrafts(getAllDrafts());
        setReservedQtyMap(getReservationsMap(draftId));
    };

    // ── Finalize ──────────────────────────────────────────────────────────────

    const handleFinalize = () => {
        if (billItems.length === 0) {
            Alert.alert("Empty Bill", "Please add at least one product to the bill.");
            return;
        }
        if (paymentMode === "udhar" && !selectedCustomer) {
            Alert.alert("Customer Required", "Please select a customer for Udhar payment.");
            return;
        }
        if (!draftId) return;

        setSaving(true);
        try {
            const finalDiscountType = discountType === "custom"
                ? (customDiscountMode === "flat" ? "custom_flat" : "custom_percent")
                : discountType;

            finalizeDraft(
                draftId,
                selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
                paymentMode,
                billItems.map((i) => {
                    const discountedUnitPrice = i.unit_price * (1 - activeDiscountPercent / 100);
                    return {
                        product_id: i.product_id,
                        product_name: i.product_name,
                        qty: i.qty,
                        unit_price: discountedUnitPrice,
                        line_total: i.qty * discountedUnitPrice,
                        display_qty: getDisplayQty(i),
                    };
                }),
                activeDiscountPercent,
                discountAmount,
                finalDiscountType
            );
            Alert.alert("Bill Saved!", `₹${grandTotal.toFixed(2)} bill saved successfully.`, [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert("Error", "Could not save bill. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const filteredCustomers = customerSearch.trim()
        ? customers.filter(
            (c) =>
                c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                (c.phone ?? "").includes(customerSearch)
        )
        : customers;

    const otherDraftCount = allDrafts.filter((d) => d.id !== draftId).length;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Bill</Text>
                </View>
                <View style={styles.headerRight}>
                    {/* Drafts switcher button */}
                    <TouchableOpacity
                        style={styles.draftsBtn}
                        onPress={() => {
                            setAllDrafts(getAllDrafts());
                            setShowDraftSwitcher(true);
                        }}
                    >
                        <Ionicons name="layers-outline" size={18} color={colors.primary} />
                        <Text style={styles.draftsBtnText}>Bills</Text>
                        {otherDraftCount > 0 && (
                            <View style={styles.draftsBadge}>
                                <Text style={styles.draftsBadgeText}>{otherDraftCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Discard current bill */}
                    {billItems.length > 0 && (
                        <TouchableOpacity onPress={handleDiscard} style={{ marginLeft: 8 }}>
                            <Ionicons name="trash-outline" size={22} color={colors.error} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Customer Details */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>CUSTOMER DETAILS</Text>
                    <TouchableOpacity onPress={() => setShowCustomerModal(true)}>
                        <Text style={styles.changeLink}>
                            {selectedCustomer ? "Change" : "Select Customer"}
                        </Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={styles.customerCard}
                    onPress={() => setShowCustomerModal(true)}
                >
                    <View style={styles.customerInfo}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.customerText}>
                            <Text style={styles.customerName}>
                                {selectedCustomer?.name ?? "Walk-in Customer"}
                            </Text>
                            <Text style={styles.customerPhone}>
                                {selectedCustomer?.phone ?? "Tap to select customer"}
                            </Text>
                        </View>
                    </View>
                    {selectedCustomer && (
                        <View style={styles.udharInfo}>
                            <Text style={styles.udharLabel}>CURRENT UDHAR</Text>
                            <Text style={styles.udharValue}>
                                ₹{selectedCustomer.udhar_balance.toFixed(2)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Product Search & Catalog Select Row */}
                <View style={styles.searchRow}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search product..."
                            placeholderTextColor="#94a3b8"
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch("")}>
                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.catalogSelectBtn}
                        onPress={() => {
                            const initialMap: Record<string, { qty: number; isPackMode: boolean }> = {};
                            billItems.forEach((i) => {
                                initialMap[i.product_id] = { qty: i.qty, isPackMode: i.is_pack_mode };
                            });
                            setSelectedModalItems(initialMap);
                            setModalSearch("");
                            setSelectedCategory(null);
                            setShowProductSelectModal(true);
                        }}
                    >
                        <Ionicons name="grid-outline" size={18} color={colors.primary} />
                        <Text style={styles.catalogSelectBtnText}>Catalog</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                        {searchResults.map((product) => {
                            const avail = availQty(product.id, product.stock_quantity);
                            return (
                                <TouchableOpacity
                                    key={product.id}
                                    style={[styles.searchResultItem, avail === 0 && styles.searchResultItemDisabled]}
                                    onPress={() => addProduct(product)}
                                >
                                    <View style={styles.searchResultInfo}>
                                        <Text style={styles.searchResultName}>{product.name}</Text>
                                        <Text style={styles.searchResultMeta}>
                                            {product.category_name ?? "No category"} ·{" "}
                                            <Text style={avail === 0 ? styles.availQtyZero : avail <= 5 ? styles.availQtyLow : styles.availQtyOk}>
                                                Avail: {avail}
                                            </Text>
                                        </Text>
                                    </View>
                                    <Text style={styles.searchResultPrice}>
                                        ₹{product.selling_price.toFixed(2)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
                {search.trim().length > 1 && searchResults.length === 0 && (
                    <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>No products found for "{search}"</Text>
                    </View>
                )}

                {/* Payment Mode */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>PAYMENT MODE</Text>
                </View>
                <View style={styles.paymentModeContainer}>
                    <TouchableOpacity
                        style={[styles.paymentBtn, paymentMode === "cash" && styles.paymentBtnActive]}
                        onPress={() => setPaymentMode("cash")}
                    >
                        <Ionicons name="cash-outline" size={18} color={paymentMode === "cash" ? colors.primary : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "cash" && styles.paymentBtnTextActive]}>
                            Cash
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.paymentBtn, paymentMode === "upi" && styles.paymentBtnUpiActive]}
                        onPress={() => setPaymentMode("upi")}
                    >
                        <Ionicons name="phone-portrait-outline" size={18} color={paymentMode === "upi" ? "#7C3AED" : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "upi" && styles.paymentBtnUpiText]}>
                            UPI
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.paymentBtn, paymentMode === "udhar" && styles.paymentBtnActive]}
                        onPress={() => setPaymentMode("udhar")}
                    >
                        <Ionicons name="wallet-outline" size={18} color={paymentMode === "udhar" ? colors.primary : "#94a3b8"} />
                        <Text style={[styles.paymentBtnText, paymentMode === "udhar" && styles.paymentBtnTextActive]}>
                            Udhar
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Bill Items */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>ITEMS ({billItems.length})</Text>
                    {billItems.length > 0 && (
                        <TouchableOpacity onPress={() => setBillItems([])}>
                            <Text style={styles.changeLink}>Clear All</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {billItems.length === 0 ? (
                    <View style={styles.emptyBill}>
                        <Ionicons name="receipt-outline" size={28} color={colors.border} />
                        <Text style={styles.emptyBillText}>Search for products above to add them to this bill</Text>
                    </View>
                ) : (
                    billItems.map((item) => (
                        <View key={item.product_id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemName}>{item.product_name}</Text>
                                <Text style={styles.itemLineTotal}>
                                    ₹{(item.qty * item.unit_price).toFixed(2)}
                                </Text>
                            </View>
                            <View style={styles.itemDetailsRow}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.pricePrefix}>₹</Text>
                                        <TextInput
                                            style={styles.priceInput}
                                            value={
                                                editingPrice[item.product_id] !== undefined
                                                    ? editingPrice[item.product_id]
                                                    : getUnitPriceDisplay(item)
                                            }
                                            keyboardType="decimal-pad"
                                            onChangeText={(text) => handlePriceTextChange(item.product_id, text)}
                                            onBlur={() => handlePriceBlur(item.product_id)}
                                            selectTextOnFocus
                                        />
                                        <Text style={styles.priceUnitText}>
                                            / {item.is_pack_mode && item.purchase_uom ? item.purchase_uom : item.uom}
                                        </Text>
                                    </View>
                                    {item.units_per_pack && item.purchase_uom && (
                                        <TouchableOpacity
                                            style={[
                                                styles.unitToggleBtn,
                                                item.is_pack_mode && styles.unitToggleBtnActive,
                                            ]}
                                            onPress={() => togglePackMode(item.product_id)}
                                        >
                                            <Ionicons
                                                name="cube-outline"
                                                size={12}
                                                color={item.is_pack_mode ? colors.primary : "#94A3B8"}
                                            />
                                            <Text style={[
                                                styles.unitToggleText,
                                                item.is_pack_mode && styles.unitToggleTextActive,
                                            ]}>
                                                {item.is_pack_mode ? item.purchase_uom : item.uom}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={styles.qtyContainer}>
                                    <TouchableOpacity
                                        style={styles.qtyBtn}
                                        onPress={() => updateQty(item.product_id, -1)}
                                    >
                                        <Ionicons name="remove" size={16} color="#475569" />
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.qtyInput}
                                        value={editingQty[item.product_id] !== undefined ? editingQty[item.product_id] : String(getQtyStepDisplay(item))}
                                        keyboardType="decimal-pad"
                                        onChangeText={(text) => handleQtyTextChange(item.product_id, text)}
                                        onBlur={() => handleQtyBlur(item.product_id)}
                                        selectTextOnFocus
                                    />
                                    <TouchableOpacity
                                        style={[styles.qtyBtn, styles.qtyAddBtn]}
                                        onPress={() => updateQty(item.product_id, 1)}
                                    >
                                        <Ionicons name="add" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Discount Bar (Anchored on top of Total Items section) */}
            <View style={styles.discountFooterContainer}>
                <TouchableOpacity
                    style={[
                        styles.discountToggleRow,
                        activeDiscountPercent > 0 && styles.discountToggleRowActive,
                    ]}
                    onPress={() => setShowDiscountSection(!showDiscountSection)}
                >
                    <View style={styles.discountToggleLeft}>
                        <Ionicons
                            name="pricetag-outline"
                            size={18}
                            color={activeDiscountPercent > 0 ? colors.primary : "#64748B"}
                        />
                        <Text
                            style={[
                                styles.discountToggleTitle,
                                activeDiscountPercent > 0 && styles.discountToggleTitleActive,
                            ]}
                        >
                            {activeDiscountPercent > 0
                                ? `Discount: ${activeDiscountPercent}% OFF (-₹${discountAmount.toFixed(2)})`
                                : "Add Discount"}
                        </Text>
                    </View>
                    <View style={styles.discountToggleRight}>
                        {activeDiscountPercent > 0 && (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleApplyDiscount("none", 0);
                                    setShowDiscountSection(false);
                                }}
                                style={styles.clearDiscountBadge}
                            >
                                <Text style={styles.clearDiscountText}>Remove</Text>
                            </TouchableOpacity>
                        )}
                        <Ionicons
                            name={showDiscountSection ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={activeDiscountPercent > 0 ? colors.primary : "#94A3B8"}
                        />
                    </View>
                </TouchableOpacity>

                {/* Discount Options */}
                {showDiscountSection && (
                    <View style={styles.discountExpandableCard}>
                        <View style={styles.discountChipsRow}>
                            {(["none", "5", "10", "15", "20", "custom"] as const).map((opt) => {
                                const isActive = discountType === opt;
                                const label = opt === "none" ? "0%" : opt === "custom" ? "Custom" : `${opt}%`;
                                return (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[styles.discountChip, isActive && styles.discountChipActive]}
                                        onPress={() => {
                                            if (opt === "custom") {
                                                setDiscountType("custom");
                                                const p = parseFloat(customDiscountText) || 0;
                                                if (p > 0) handleApplyDiscount("custom", p);
                                            } else if (opt === "none") {
                                                setDiscountType("none");
                                                handleApplyDiscount("none", 0);
                                            } else {
                                                const p = parseInt(opt, 10);
                                                handleApplyDiscount(opt, p);
                                            }
                                        }}
                                    >
                                        <Text style={[styles.discountChipText, isActive && styles.discountChipTextActive]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {discountType === "custom" && (
                            <View style={styles.customDiscountWrapper}>
                                <View style={styles.customModeSelector}>
                                    <TouchableOpacity
                                        style={[
                                            styles.customModeBtn,
                                            customDiscountMode === "percent" && styles.customModeBtnActive,
                                        ]}
                                        onPress={() => {
                                            setCustomDiscountMode("percent");
                                            const p = parseFloat(customDiscountText) || 0;
                                            if (p > 0) handleApplyDiscount("custom", p);
                                        }}
                                    >
                                        <Text style={[styles.customModeText, customDiscountMode === "percent" && styles.customModeTextActive]}>
                                            % Percentage
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.customModeBtn,
                                            customDiscountMode === "flat" && styles.customModeBtnActive,
                                        ]}
                                        onPress={() => {
                                            setCustomDiscountMode("flat");
                                            const amt = parseFloat(customDiscountText) || 0;
                                            if (amt > 0 && subtotal > 0) {
                                                const p = Math.min(100, (amt / subtotal) * 100);
                                                handleApplyDiscount("custom", p);
                                            }
                                        }}
                                    >
                                        <Text style={[styles.customModeText, customDiscountMode === "flat" && styles.customModeTextActive]}>
                                            ₹ Flat Amount
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.customDiscountContainer}>
                                    <Text style={styles.currencyPrefix}>
                                        {customDiscountMode === "flat" ? "₹" : "%"}
                                    </Text>
                                    <TextInput
                                        style={styles.customDiscountInput}
                                        placeholder={
                                            customDiscountMode === "flat"
                                                ? "Enter flat discount amount (e.g. 50)"
                                                : "Enter discount % (e.g. 7.5)"
                                        }
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="decimal-pad"
                                        value={customDiscountText}
                                        onChangeText={(text) => {
                                            const sanitized = text.replace(/[^0-9.]/g, "");
                                            setCustomDiscountText(sanitized);
                                            const val = parseFloat(sanitized);
                                            if (!isNaN(val) && val >= 0) {
                                                if (customDiscountMode === "percent") {
                                                    if (val <= 100) handleApplyDiscount("custom", val);
                                                } else {
                                                    const p = subtotal > 0 ? Math.min(100, (val / subtotal) * 100) : 0;
                                                    handleApplyDiscount("custom", p);
                                                }
                                            }
                                        }}
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Footer totals */}
            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    <Text style={styles.totalItemsLabel}>TOTAL ITEMS</Text>
                    <Text style={styles.totalItemsValue}>{String(totalItems).padStart(2, "0")} Items</Text>
                </View>
                <View style={styles.footerRight}>
                    {activeDiscountPercent > 0 && (
                        <Text style={styles.subtotalLabel}>
                            Subtotal: ₹{subtotal.toFixed(2)} (-{activeDiscountPercent}%)
                        </Text>
                    )}
                    <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                    <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
                </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsContainer}>
                {/* Hold & New Bill */}
                <TouchableOpacity style={styles.holdBtn} onPress={handleHoldAndNew}>
                    <Ionicons name="pause-circle-outline" size={18} color="#475569" />
                    <Text style={styles.holdBtnText}>HOLD</Text>
                </TouchableOpacity>

                {/* Estimate */}
                <TouchableOpacity
                    style={styles.estimateBtn}
                    onPress={() => {
                        if (billItems.length === 0) {
                            Alert.alert("Empty Bill", "Add at least one product to preview an estimate.");
                            return;
                        }
                        setShowEstimate(true);
                    }}
                >
                    <Ionicons name="document-text-outline" size={18} color="#475569" />
                    <Text style={styles.estimateBtnText}>ESTIMATE</Text>
                </TouchableOpacity>

                {/* Checkout */}
                <TouchableOpacity
                    style={[styles.checkoutBtn, saving && { opacity: 0.7 }]}
                    onPress={handleFinalize}
                    disabled={saving}
                >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.checkoutBtnText}>
                        {saving ? "SAVING..." : "CHECKOUT"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Draft Switcher Modal */}
            <DraftSwitcherModal
                visible={showDraftSwitcher}
                onClose={() => setShowDraftSwitcher(false)}
                drafts={allDrafts}
                currentDraftId={draftId}
                onSelectDraft={handleSelectDraft}
                onDiscardDraft={handleDiscardOtherDraft}
                onNewBill={handleHoldAndNew}
            />

            {/* Estimate Preview Modal */}
            <Modal visible={showEstimate} transparent={false} animationType="slide">
                <RNSafeAreaView style={styles.estimateContainer}>
                    <View style={styles.estimateHeader}>
                        <TouchableOpacity onPress={() => setShowEstimate(false)} style={styles.estimateCloseBtn}>
                            <Ionicons name="close" size={24} color="#475569" />
                        </TouchableOpacity>
                        <Text style={styles.estimateHeaderTitle}>Estimate Preview</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.estimateScroll} keyboardShouldPersistTaps="handled">
                        <View style={styles.estimateBadgeRow}>
                            <View style={styles.estimateBadge}>
                                <Ionicons name="document-text-outline" size={14} color="#92400e" />
                                <Text style={styles.estimateBadgeText}>ESTIMATE — NOT SAVED</Text>
                            </View>
                            <Text style={styles.estimateDate}>
                                {new Date().toLocaleDateString("en-IN", {
                                    day: "2-digit", month: "short", year: "numeric",
                                })}
                            </Text>
                        </View>

                        <View style={styles.estimateSection}>
                            <Text style={styles.estimateSectionLabel}>CUSTOMER</Text>
                            <Text style={styles.estimateCustomerName}>
                                {selectedCustomer?.name ?? "Walk-in Customer"}
                            </Text>
                            {selectedCustomer?.phone && (
                                <Text style={styles.estimateCustomerPhone}>{selectedCustomer.phone}</Text>
                            )}
                        </View>

                        <View style={styles.estimatePaymentRow}>
                            <View style={[
                                styles.estimatePaymentBadge,
                                { backgroundColor: paymentMode === "udhar" ? "#FEF3C7" : "#DCFCE7" }
                            ]}>
                                <Ionicons
                                    name={paymentMode === "udhar" ? "wallet-outline" : "cash-outline"}
                                    size={14}
                                    color={paymentMode === "udhar" ? "#D97706" : "#16a34a"}
                                />
                                <Text style={[
                                    styles.estimatePaymentText,
                                    { color: paymentMode === "udhar" ? "#D97706" : "#16a34a" }
                                ]}>
                                    {paymentMode === "udhar" ? "Udhar (Credit)" : "Cash Payment"}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.estimateDivider} />

                        <Text style={styles.estimateSectionLabel}>ITEMS</Text>
                        {billItems.map((item, idx) => (
                            <View key={item.product_id} style={styles.estimateItem}>
                                <View style={styles.estimateItemLeft}>
                                    <Text style={styles.estimateItemIdx}>{idx + 1}.</Text>
                                    <View>
                                        <Text style={styles.estimateItemName}>{item.product_name}</Text>
                                        <Text style={styles.estimateItemMeta}>
                                            {getDisplayPrice(item)} × {getQtyStepDisplay(item)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.estimateItemTotal}>
                                    ₹{(item.qty * item.unit_price).toFixed(2)}
                                </Text>
                            </View>
                        ))}

                        <View style={styles.estimateDivider} />

                        <View style={styles.estimateTotalRow}>
                            <Text style={styles.estimateTotalLabel}>Total Items</Text>
                            <Text style={styles.estimateTotalValue}>{totalItems}</Text>
                        </View>
                        <View style={[styles.estimateTotalRow, styles.estimateGrandRow]}>
                            <Text style={styles.estimateGrandLabel}>GRAND TOTAL</Text>
                            <Text style={styles.estimateGrandValue}>₹{grandTotal.toFixed(2)}</Text>
                        </View>

                        <View style={styles.estimateDisclaimer}>
                            <Ionicons name="information-circle-outline" size={16} color="#92400e" />
                            <Text style={styles.estimateDisclaimerText}>
                                This is a preview only. Tap "Checkout" on the billing screen to finalise and record this bill.
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={styles.estimateFooter}>
                        <TouchableOpacity
                            style={styles.estimateCloseFooterBtn}
                            onPress={() => setShowEstimate(false)}
                        >
                            <Text style={styles.estimateCloseFooterText}>Close Preview</Text>
                        </TouchableOpacity>
                    </View>
                </RNSafeAreaView>
            </Modal>

            {/* Below Purchase Price Discount Warning Modal */}
            <Modal
                visible={showDiscountWarningModal}
                transparent
                animationType="fade"
                onRequestClose={cancelDiscountModal}
            >
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.warningModalContent}>
                        <View style={styles.warningIconBadge}>
                            <Ionicons name="warning" size={32} color="#D97706" />
                        </View>
                        <Text style={styles.warningModalTitle}>Below Purchase Price Warning</Text>
                        <Text style={styles.warningModalMessage}>
                            Applying {pendingDiscountPercent}% discount will reduce selling price equal to or below purchase price for {warningItemsList.length} item(s):
                        </Text>
                        <ScrollView style={styles.warningItemsScroll}>
                            {warningItemsList.map((item, idx) => (
                                <View key={idx} style={styles.warningItemCard}>
                                    <Text style={styles.warningItemCardName}>{item.name}</Text>
                                    <View style={styles.warningItemCardPrices}>
                                        <Text style={styles.warningItemCardDiscounted}>
                                            Discounted: ₹{item.discountedPrice.toFixed(2)}
                                        </Text>
                                        <Text style={styles.warningItemCardPurchase}>
                                            Cost: ₹{item.purchasePrice.toFixed(2)} / {item.uom}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <View style={styles.warningModalActions}>
                            <TouchableOpacity style={styles.warningCancelBtn} onPress={cancelDiscountModal}>
                                <Text style={styles.warningCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.warningOkayBtn} onPress={confirmDiscountModal}>
                                <Text style={styles.warningOkayBtnText}>Okay</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Customer Picker Modal */}
            <Modal visible={showCustomerModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowCustomerModal(false)}>
                    <Pressable style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Select Customer</Text>

                        <TextInput
                            style={styles.modalSearch}
                            placeholder="Search customer..."
                            value={customerSearch}
                            onChangeText={setCustomerSearch}
                            placeholderTextColor="#94a3b8"
                        />

                        <FlatList
                            data={filteredCustomers}
                            keyExtractor={(item) => item.id}
                            style={styles.modalList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.customerOption,
                                        selectedCustomer?.id === item.id && styles.customerOptionActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedCustomer(item);
                                        setShowCustomerModal(false);
                                        setCustomerSearch("");
                                    }}
                                >
                                    <View>
                                        <Text style={styles.customerOptionName}>{item.name}</Text>
                                        <Text style={styles.customerOptionPhone}>
                                            {item.phone ?? "No phone"} · Udhar: ₹{item.udhar_balance.toFixed(2)}
                                        </Text>
                                    </View>
                                    {selectedCustomer?.id === item.id && (
                                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.noResultsText}>No customers found</Text>
                            }
                        />

                        <TouchableOpacity
                            style={styles.walkInBtn}
                            onPress={() => {
                                setSelectedCustomer(null);
                                setShowCustomerModal(false);
                            }}
                        >
                            <Text style={styles.walkInBtnText}>Walk-in (No customer)</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Product Selection Full Modal */}
            <Modal
                visible={showProductSelectModal}
                animationType="slide"
                onRequestClose={() => setShowProductSelectModal(false)}
            >
                <SafeAreaView style={styles.fullModalContainer}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowProductSelectModal(false)} style={styles.modalBackBtn}>
                            <Ionicons name="arrow-back" size={24} color="#1e293b" />
                        </TouchableOpacity>
                        <Text style={styles.modalHeaderTitle}>Select Products</Text>
                        <TouchableOpacity onPress={() => setSelectedModalItems({})} style={styles.clearAllBtn}>
                            <Text style={styles.clearAllText}>Reset</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search & Category Filter */}
                    <View style={styles.modalFilterContainer}>
                        <View style={styles.modalSearchBox}>
                            <Ionicons name="search" size={18} color="#94a3b8" />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search product or category..."
                                placeholderTextColor="#94a3b8"
                                value={modalSearch}
                                onChangeText={setModalSearch}
                            />
                            {modalSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setModalSearch("")}>
                                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCategoryScroll}>
                            <TouchableOpacity
                                style={[styles.categoryChip, selectedCategory === null && styles.categoryChipActive]}
                                onPress={() => setSelectedCategory(null)}
                            >
                                <Text style={[styles.categoryChipText, selectedCategory === null && styles.categoryChipTextActive]}>
                                    All Products
                                </Text>
                            </TouchableOpacity>
                            {categories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                                    onPress={() => setSelectedCategory(cat.id)}
                                >
                                    <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Product List */}
                    <FlatList
                        data={products.filter((p) => {
                            const matchesSearch = !modalSearch.trim() ||
                                p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                                (p.category_name ?? "").toLowerCase().includes(modalSearch.toLowerCase());
                            const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
                            return matchesSearch && matchesCategory;
                        })}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.modalProductList}
                        renderItem={({ item }) => {
                            const avail = availQty(item.id, item.stock_quantity);
                            const selectedData = selectedModalItems[item.id] || { qty: 0, isPackMode: false };
                            const currentQty = selectedData.qty;
                            const isPack = selectedData.isPackMode;

                            const step = isPack && item.units_per_pack ? item.units_per_pack : 1;
                            const displayQtyCount = isPack && item.units_per_pack ? (currentQty / item.units_per_pack) : currentQty;
                            const displayUnitLabel = isPack && item.purchase_uom ? item.purchase_uom : item.uom;
                            const displayPrice = isPack && item.units_per_pack ? item.selling_price * item.units_per_pack : item.selling_price;

                            return (
                                <View style={styles.modalProductCard}>
                                    <View style={styles.modalProductInfo}>
                                        <Text style={styles.modalProductName}>{item.name}</Text>
                                        <View style={styles.modalProductMeta}>
                                            <Text style={styles.modalProductPrice}>₹{displayPrice.toFixed(2)} / {displayUnitLabel}</Text>
                                            <Text style={[styles.modalProductStock, avail <= 0 && { color: "#EF4444" }]}>
                                                {avail > 0 ? `Stock: ${avail} ${item.uom}` : "Out of Stock"}
                                            </Text>
                                        </View>
                                        {Boolean(item.units_per_pack && item.purchase_uom) && (
                                            <TouchableOpacity
                                                style={styles.modalPackToggle}
                                                onPress={() => {
                                                    const newIsPack = !isPack;
                                                    setSelectedModalItems((prev) => ({
                                                        ...prev,
                                                        [item.id]: { qty: currentQty, isPackMode: newIsPack },
                                                    }));
                                                }}
                                            >
                                                <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                                                <Text style={styles.modalPackToggleText}>
                                                    Unit: {isPack ? item.purchase_uom : item.uom}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={styles.modalStepperRow}>
                                        {currentQty > 0 ? (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.modalStepperBtn}
                                                    onPress={() => {
                                                        const nextQty = Math.max(0, currentQty - step);
                                                        setSelectedModalItems((prev) => {
                                                            const copy = { ...prev };
                                                            if (nextQty <= 0) {
                                                                delete copy[item.id];
                                                            } else {
                                                                copy[item.id] = { qty: nextQty, isPackMode: isPack };
                                                            }
                                                            return copy;
                                                        });
                                                    }}
                                                >
                                                    <Ionicons name="remove" size={16} color={colors.primary} />
                                                </TouchableOpacity>
                                                <Text style={styles.modalQtyText}>
                                                    {displayQtyCount} {displayUnitLabel}
                                                </Text>
                                                <TouchableOpacity
                                                    style={[styles.modalStepperBtn, currentQty + step > avail && styles.modalStepperBtnDisabled]}
                                                    onPress={() => {
                                                        if (currentQty + step > avail) {
                                                            Alert.alert("Stock Limit", `Only ${avail} ${item.uom} available.`);
                                                            return;
                                                        }
                                                        setSelectedModalItems((prev) => ({
                                                            ...prev,
                                                            [item.id]: { qty: currentQty + step, isPackMode: isPack },
                                                        }));
                                                    }}
                                                >
                                                    <Ionicons name="add" size={16} color={colors.primary} />
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.modalAddBtn, avail <= 0 && styles.modalAddBtnDisabled]}
                                                onPress={() => {
                                                    if (avail <= 0) {
                                                        Alert.alert("Out of Stock", `"${item.name}" is out of stock.`);
                                                        return;
                                                    }
                                                    setSelectedModalItems((prev) => ({
                                                        ...prev,
                                                        [item.id]: { qty: step, isPackMode: false },
                                                    }));
                                                }}
                                            >
                                                <Ionicons name="add" size={16} color="#fff" />
                                                <Text style={styles.modalAddBtnText}>ADD</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        }}
                        ListEmptyComponent={
                            <Text style={styles.noResultsText}>No products match search criteria.</Text>
                        }
                    />

                    {/* Footer Action Bar */}
                    <View style={styles.modalFooter}>
                        <View>
                            <Text style={styles.modalFooterCount}>
                                {Object.values(selectedModalItems).filter((v) => v.qty > 0).length} Product(s) Selected
                            </Text>
                            <Text style={styles.modalFooterSubtotal}>
                                Subtotal: ₹
                                {Object.entries(selectedModalItems)
                                    .reduce((acc, [pid, data]) => {
                                        const prod = products.find((p) => p.id === pid);
                                        return acc + (prod ? data.qty * prod.selling_price : 0);
                                    }, 0)
                                    .toFixed(2)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.modalApplyBtn}
                            onPress={() => {
                                const newItems: BillItem[] = [];
                                Object.entries(selectedModalItems).forEach(([productId, data]) => {
                                    if (data.qty > 0) {
                                        const prod = products.find((p) => p.id === productId);
                                        if (prod) {
                                            newItems.push({
                                                product_id: prod.id,
                                                product_name: prod.name,
                                                qty: data.qty,
                                                unit_price: prod.selling_price,
                                                purchase_price: prod.purchase_price ?? 0,
                                                uom: prod.uom,
                                                units_per_pack: prod.units_per_pack ?? null,
                                                purchase_uom: prod.purchase_uom ?? null,
                                                is_pack_mode: data.isPackMode,
                                            });
                                        }
                                    }
                                });
                                setBillItems(newItems);
                                setShowProductSelectModal(false);
                            }}
                        >
                            <Text style={styles.modalApplyBtnText}>Add to Bill</Text>
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        height: 56,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    draftsBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#DBEAFE",
    },
    draftsBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    draftsBadge: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 3,
    },
    draftsBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
    scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 20 },
    searchContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: "#1e293b" },
    searchResults: {
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginTop: 4,
        overflow: "hidden",
    },
    searchResultItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    searchResultItemDisabled: { opacity: 0.5 },
    searchResultInfo: { flex: 1 },
    searchResultName: { fontSize: 14, fontWeight: "600", color: colors.text },
    searchResultMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    availQtyOk: { color: "#16A34A", fontWeight: "700" },
    availQtyLow: { color: "#D97706", fontWeight: "700" },
    availQtyZero: { color: "#EF4444", fontWeight: "700" },
    searchResultPrice: { fontSize: 14, fontWeight: "700", color: colors.primary, marginLeft: 8 },
    noResults: { paddingVertical: 8, alignItems: "center" },
    noResultsText: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
        marginBottom: 4,
    },
    sectionLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", letterSpacing: 0.5 },
    changeLink: { fontSize: 12, fontWeight: "600", color: colors.primary },
    customerCard: {
        backgroundColor: "#EFF6FF",
        borderRadius: 12,
        padding: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#DBEAFE",
    },
    customerInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#DBEAFE",
        alignItems: "center",
        justifyContent: "center",
    },
    customerText: { gap: 1 },
    customerName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
    customerPhone: { fontSize: 12, color: "#64748B" },
    udharInfo: { alignItems: "flex-end" },
    udharLabel: { fontSize: 9, fontWeight: "700", color: "#94A3B8" },
    udharValue: { fontSize: 14, fontWeight: "800", color: "#EF4444", marginTop: 1 },
    paymentModeContainer: { flexDirection: "row", gap: 8 },
    paymentBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 38,
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        gap: 6,
    },
    paymentBtnActive: { borderColor: colors.primary, backgroundColor: "#EFF6FF" },
    paymentBtnUpiActive: { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" },
    paymentBtnText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
    paymentBtnTextActive: { color: colors.primary },
    paymentBtnUpiText: { color: "#7C3AED" },
    emptyBill: { alignItems: "center", paddingVertical: 16, gap: 4 },
    emptyBillText: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: "center",
        maxWidth: "80%",
    },
    itemCard: {
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    itemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    itemName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1e293b" },
    itemLineTotal: { fontSize: 14, fontWeight: "800", color: colors.primary },
    itemDetailsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    priceContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    pricePrefix: { fontSize: 12, fontWeight: "700", color: "#1e293b" },
    priceInput: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.primary,
        paddingVertical: 0,
        paddingHorizontal: 2,
        minWidth: 36,
        textAlign: "center",
    },
    priceUnitText: { fontSize: 11, fontWeight: "600", color: "#64748B" },
    subtotalLabel: { fontSize: 10, fontWeight: "600", color: "#64748B" },
    // Discount Section
    discountFooterContainer: {
        paddingHorizontal: spacing.md,
        backgroundColor: "#F8FAFC",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    discountToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    discountToggleRowActive: {
        backgroundColor: "#EFF6FF",
        borderColor: "#DBEAFE",
    },
    discountToggleLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    discountToggleTitle: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
    },
    discountToggleTitleActive: {
        fontWeight: "700",
        color: colors.primary,
    },
    discountToggleRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    clearDiscountBadge: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    clearDiscountText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#DC2626",
    },
    discountExpandableCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    discountChipsRow: {
        flexDirection: "row",
        gap: 6,
        marginBottom: 8,
        flexWrap: "wrap",
    },
    discountChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "#F1F5F9",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    discountChipActive: {
        backgroundColor: "#EFF6FF",
        borderColor: colors.primary,
    },
    discountChipText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#64748B",
    },
    discountChipTextActive: {
        color: colors.primary,
    },
    customDiscountWrapper: {
        marginTop: 4,
        gap: 6,
    },
    customModeSelector: {
        flexDirection: "row",
        gap: 6,
    },
    customModeBtn: {
        flex: 1,
        paddingVertical: 6,
        alignItems: "center",
        borderRadius: 6,
        backgroundColor: "#E2E8F0",
    },
    customModeBtnActive: {
        backgroundColor: colors.primary,
    },
    customModeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#475569",
    },
    customModeTextActive: {
        color: "#FFFFFF",
    },
    customDiscountContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingHorizontal: 10,
    },
    customDiscountInput: {
        flex: 1,
        height: 38,
        fontSize: 13,
        fontWeight: "600",
        color: "#1e293b",
    },
    percentSymbol: {
        fontSize: 14,
        fontWeight: "700",
        color: "#64748B",
        marginLeft: 4,
    },
    currencyPrefix: {
        fontSize: 14,
        fontWeight: "700",
        color: "#64748B",
        marginRight: 6,
    },
    // Warning Modal
    modalOverlayCenter: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.md,
    },
    warningModalContent: {
        width: "90%",
        maxHeight: "80%",
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        alignItems: "center",
    },
    warningIconBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#FEF3C7",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    warningModalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: 8,
        textAlign: "center",
    },
    warningModalMessage: {
        fontSize: 13,
        color: "#475569",
        textAlign: "center",
        marginBottom: 12,
    },
    warningItemsScroll: {
        width: "100%",
        maxHeight: 180,
        marginBottom: 16,
    },
    warningItemCard: {
        backgroundColor: "#FFFBEB",
        borderWidth: 1,
        borderColor: "#FCD34D",
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
    },
    warningItemCardName: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1e293b",
    },
    warningItemCardPrices: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 4,
    },
    warningItemCardDiscounted: {
        fontSize: 11,
        fontWeight: "700",
        color: "#DC2626",
    },
    warningItemCardPurchase: {
        fontSize: 11,
        fontWeight: "600",
        color: "#475569",
    },
    warningModalActions: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    warningCancelBtn: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    warningCancelBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#475569",
    },
    warningOkayBtn: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    warningOkayBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#fff",
    },
    unitToggleBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    unitToggleBtnActive: {
        backgroundColor: "#EFF6FF",
        borderColor: colors.primary,
    },
    unitToggleText: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
    unitToggleTextActive: { color: colors.primary },
    qtyContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 6,
        overflow: "hidden",
    },
    qtyBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
    qtyAddBtn: { backgroundColor: colors.primary },
    qtyValue: { width: 34, textAlign: "center", fontSize: 14, fontWeight: "700", color: "#1e293b" },
    qtyInput: {
        width: 40,
        textAlign: "center",
        fontSize: 14,
        fontWeight: "700",
        color: "#1e293b",
        paddingVertical: 0,
        paddingHorizontal: 2,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        backgroundColor: "#F8FAFC",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    footerLeft: { gap: 1 },
    totalItemsLabel: { fontSize: 10, fontWeight: "600", color: "#64748B" },
    totalItemsValue: { fontSize: 15, fontWeight: "800", color: "#000" },
    footerRight: { alignItems: "flex-end", gap: 1 },
    grandTotalLabel: { fontSize: 10, fontWeight: "600", color: "#64748B" },
    grandTotalValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
    actionsContainer: {
        flexDirection: "row",
        paddingHorizontal: spacing.md,
        paddingBottom: 12,
        gap: 8,
        backgroundColor: "#F8FAFC",
    },
    holdBtn: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 46,
        height: 46,
        backgroundColor: "#F1F5F9",
        borderRadius: 10,
        gap: 1,
    },
    holdBtnText: { fontSize: 8, fontWeight: "700", color: "#475569" },
    estimateBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 46,
        backgroundColor: "#F1F5F9",
        borderRadius: 10,
        gap: 4,
    },
    estimateBtnText: { fontSize: 12, fontWeight: "700", color: "#475569" },
    checkoutBtn: {
        flex: 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 46,
        backgroundColor: colors.primary,
        borderRadius: 10,
        gap: 6,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    checkoutBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    // Customer Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        maxHeight: "75%",
    },
    modalHandle: {
        width: 48,
        height: 5,
        backgroundColor: "#e5e7eb",
        borderRadius: 2.5,
        alignSelf: "center",
        marginTop: 12,
        marginBottom: 20,
    },
    modalTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 16 },
    modalSearch: {
        backgroundColor: "#f3f4f6",
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        fontSize: 15,
        color: colors.text,
        marginBottom: 12,
    },
    modalList: { maxHeight: 320 },
    customerOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    customerOptionActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
    customerOptionName: { fontSize: 16, fontWeight: "600", color: colors.text },
    customerOptionPhone: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    walkInBtn: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
    },
    walkInBtnText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
    // Estimate Modal
    estimateContainer: { flex: 1, backgroundColor: "#fff" },
    estimateHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    estimateCloseBtn: { width: 40, alignItems: "flex-start" },
    estimateHeaderTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
    estimateScroll: { padding: 20, paddingBottom: 40 },
    estimateBadgeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    estimateBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#FEF3C7",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    estimateBadgeText: { fontSize: 11, fontWeight: "800", color: "#92400e", letterSpacing: 0.5 },
    estimateDate: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    estimateSection: { marginBottom: 16 },
    estimateSectionLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.8, marginBottom: 6 },
    estimateCustomerName: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
    estimateCustomerPhone: { fontSize: 13, color: "#64748B", marginTop: 2 },
    estimatePaymentRow: { marginBottom: 16 },
    estimatePaymentBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    estimatePaymentText: { fontSize: 13, fontWeight: "700" },
    estimateDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 },
    estimateItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F8FAFC",
    },
    estimateItemLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
    estimateItemIdx: { fontSize: 13, color: "#94A3B8", fontWeight: "600", width: 18, marginTop: 2 },
    estimateItemName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
    estimateItemMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
    estimateItemTotal: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
    estimateTotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    estimateTotalLabel: { fontSize: 14, color: "#64748B", fontWeight: "500" },
    estimateTotalValue: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
    estimateGrandRow: {
        marginTop: 6,
        paddingTop: 12,
        borderTopWidth: 2,
        borderTopColor: "#F1F5F9",
    },
    estimateGrandLabel: { fontSize: 16, fontWeight: "800", color: "#1e293b", letterSpacing: 0.5 },
    estimateGrandValue: { fontSize: 24, fontWeight: "800", color: colors.primary },
    estimateDisclaimer: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: "#FFFBEB",
        padding: 14,
        borderRadius: 10,
        marginTop: 20,
    },
    estimateDisclaimerText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 19 },
    estimateFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    estimateCloseFooterBtn: {
        backgroundColor: "#F1F5F9",
        height: 52,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    estimateCloseFooterText: { fontSize: 16, fontWeight: "700", color: "#475569" },

    // Search Row & Catalog Select Button
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
    },
    catalogSelectBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 12,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#DBEAFE",
        gap: 6,
    },
    catalogSelectBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.primary,
    },

    // Full Modal Styles
    fullModalContainer: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    modalBackBtn: {
        padding: 4,
    },
    modalHeaderTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
    },
    clearAllBtn: {
        padding: 4,
    },
    clearAllText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.error,
    },
    modalFilterContainer: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    modalSearchBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginVertical: 6,
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: "500",
        color: "#1E293B",
        marginLeft: 6,
        padding: 0,
    },
    modalCategoryScroll: {
        flexDirection: "row",
        marginTop: 6,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        marginRight: 6,
    },
    categoryChipActive: {
        backgroundColor: colors.primary,
    },
    categoryChipText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
    },
    categoryChipTextActive: {
        color: "#FFFFFF",
    },
    modalProductList: {
        padding: 16,
        gap: 10,
    },
    modalProductCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    modalProductInfo: {
        flex: 1,
        marginRight: 12,
    },
    modalProductName: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
    },
    modalProductMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
    },
    modalProductPrice: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.primary,
    },
    modalProductStock: {
        fontSize: 11,
        fontWeight: "600",
        color: "#16A34A",
    },
    modalPackToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
    },
    modalPackToggleText: {
        fontSize: 11,
        fontWeight: "600",
        color: colors.primary,
    },
    modalStepperRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    modalStepperBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#EFF6FF",
        borderWidth: 1,
        borderColor: "#DBEAFE",
        justifyContent: "center",
        alignItems: "center",
    },
    modalStepperBtnDisabled: {
        opacity: 0.4,
    },
    modalQtyText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1E293B",
        minWidth: 44,
        textAlign: "center",
    },
    modalAddBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4,
    },
    modalAddBtnDisabled: {
        backgroundColor: "#94a3b8",
    },
    modalAddBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    modalFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
    },
    modalFooterCount: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
    },
    modalFooterSubtotal: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },
    modalApplyBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.primary,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
    },
    modalApplyBtnText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
    },
});
