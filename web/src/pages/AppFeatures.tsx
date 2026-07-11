import { useState } from 'react';
import { Home, Package, FileText, Clock, Users, BarChart2, Cloud, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import '../App.css';

const FEATURES = [
    {
        id: "dashboard",
        title: "Dashboard",
        subtitle: "Your shop at a glance, every time you open the app",
        bgColor: "#EFF6FF",
        accentColor: "#2563EB",
        badge: "",
        points: [
            "Today's Sales — see exactly how much you've earned today the moment you open the app.",
            "Low Stock Alerts — products that are running below your set minimum threshold are highlighted so you never run out unexpectedly.",
            "AI Reorder Insights (Cloud users) — the same low-stock data is presented with an AI label and priority guidance when cloud backup is enabled.",
            "Recent Bills — your last few transactions shown directly on the home screen for quick reference.",
            "Auto-refresh — every time you switch back to the Home tab the data reloads from your local database instantly."
        ],
        tip: "The Home screen data is always live. If you just added a bill from the Billing tab, switch back to Home to see today's sales update immediately."
    },
    {
        id: "products",
        title: "Products & Inventory",
        subtitle: "Add, organise, and track every item in your shop",
        bgColor: "#F5F3FF",
        accentColor: "#7C3AED",
        badge: "",
        points: [
            "Add Products — enter product name, purchase price, selling price, current stock quantity, and a minimum threshold level.",
            "Edit Products — tap the pencil icon on any product card to update any field including price, stock count, or threshold. Changes take effect immediately.",
            "Delete Products — tap the trash icon on a product card. A confirmation alert appears before deletion. Historical bills still show the product name correctly.",
            "Search — type any part of a product name or category name to filter your list in real time.",
            "Categories & Brands — organise products by creating categories (e.g. Dairy, Snacks) and brands (e.g. Amul, Britannia) from Settings → Manage Categories / Brands.",
            "Unit of Measure (UOM) — set units like Kg, Litre, Piece, Dozen, or enter a custom unit for any product.",
            "Automatic Stock Deduction — every time you save a bill, the stock quantity of each product in that bill is reduced automatically. No manual update needed."
        ],
        tip: "Set a realistic minimum threshold for every product (e.g. 10 for a fast-moving item). This is what drives Low Stock Alerts on the Dashboard."
    },
    {
        id: "billing",
        title: "Billing",
        subtitle: "Create bills in seconds — cash or credit",
        bgColor: "#ECFDF5",
        accentColor: "#059669",
        badge: "Most Used",
        points: [
            "Product Search — type at least 2 characters of a product name or category to see matching results. Tap to add to the bill.",
            "Quantity Control — use the + / − buttons on each bill item to adjust quantity. Reducing to 0 removes the item from the bill.",
            "Cash Payment — default mode. Customer pays immediately. No customer selection needed for walk-in sales.",
            "Udhar (Credit) — switch to Udhar mode when a customer wants to pay later. You must select a customer from your list. Their Udhar balance increases by the bill total.",
            "Estimate Preview — tap the ESTIMATE button any time to see a receipt-style preview of the current bill without saving it. Useful for showing the total to the customer before confirming.",
            "Customer Selection — tap 'Select Customer' to pick from your customer list. You can search by name or phone number inside the modal.",
            "Save Bill — tap Checkout to save the bill. Stock is deducted, udhar balance updated, and the bill appears in Bills History — all in one tap.",
            "Clear Bill — tap the trash icon in the header or 'Clear All' above items to remove all products and start fresh."
        ],
        tip: "For walk-in cash customers you don't need to select a customer at all. Just search products, set quantities, and tap Checkout."
    },
    {
        id: "bills",
        title: "Bills History",
        subtitle: "Every bill, every transaction, always accessible",
        bgColor: "#FFFBEB",
        accentColor: "#D97706",
        badge: "",
        points: [
            "Full Bill List — all saved bills are listed with date, customer name (or 'Walk-in'), total amount, and payment mode badge.",
            "Bill Detail — tap any bill to see the full itemised receipt: product names, quantities, unit prices, and grand total.",
            "PDF Receipt — tap the share icon on any bill detail to generate a PDF receipt and share it via WhatsApp, email, or save to Files. The receipt includes your shop name, owner name, and phone number at the top.",
            "Permanent Record — bills are never deleted when you delete a product. The product name and price at time of sale are preserved forever."
        ],
        tip: "Send PDF receipts directly to customers on WhatsApp after a sale. It builds trust and reduces disputes over udhar amounts."
    },
    {
        id: "customers",
        title: "Customers & Udhar",
        subtitle: "Track credit, collect payments, see who owes what",
        bgColor: "#FFF1F2",
        accentColor: "#DC2626",
        badge: "",
        points: [
            "Add Customer — save a customer's name (required), phone number, and address. They are then available in the billing screen for udhar transactions.",
            "Udhar Balance — each customer's outstanding credit balance is shown in red on the customer list. The total across all customers is shown at the top of the screen.",
            "Edit Customer — tap any customer row to edit their name, phone number, or address. Changes save immediately.",
            "Record Payment — when a customer pays back part or all of their udhar, tap 'Record Payment' on their profile. Enter the amount or use quick-fill chips (₹100, ₹200, ₹500, ₹1,000). The balance reduces immediately.",
            "Balance Floor — the app prevents the balance from going below ₹0. You cannot accidentally enter a payment larger than what is owed.",
            "Bill History per Customer — the last 10 bills linked to each customer are listed on their profile screen. Tap any bill to open the full receipt.",
            "Cleared Status — when a customer's balance reaches ₹0, the card turns green and shows an 'All cleared' badge. The Record Payment button is automatically hidden.",
            "Search Customers — search by name or phone number from the customer list."
        ],
        tip: "After creating a new customer, immediately create a test udhar bill for ₹1 to confirm they appear in billing's customer search. Then record a ₹1 payment to zero it out."
    },
    {
        id: "reports",
        title: "Reports & Analytics",
        subtitle: "Understand your business — daily, weekly, monthly",
        bgColor: "#ECFEFF",
        accentColor: "#0891B2",
        badge: "",
        points: [
            "Three Time Periods — switch between Today, This Week (last 7 days), and This Month (1st to today) with one tap.",
            "Total Sales — sum of all bill totals in the selected period.",
            "Net Profit — real profit calculated from your purchase price vs selling price per item. Not an estimate — based on actual product cost data you entered.",
            "Cash vs Udhar breakdown — see how much of your sales came in as immediate cash versus credit given to customers.",
            "Top 5 Products — the 5 best-selling products by quantity in the selected period, with revenue per product.",
            "Recent 10 Transactions — the last 10 bills with date, customer, and amount. Tap any to open the full bill detail.",
            "PDF Report Export — tap 'Export PDF' to generate a shareable report containing your shop header, period summary stats, top products table, and recent transactions. Share or save it anywhere."
        ],
        tip: "Enter accurate purchase prices when adding products — that is what makes the Net Profit figure real. A product with purchase price = ₹0 contributes ₹0 to profit (not full selling price)."
    },
    {
        id: "data",
        title: "Data, Backup & Privacy",
        subtitle: "Your data — safe, private, and always yours",
        bgColor: "#F8FAFC",
        accentColor: "#475569",
        badge: "",
        points: [
            "Offline-First — the entire app works without internet. Everything is saved to your phone's local database (SQLite) instantly. Internet is only needed for cloud sync.",
            "Cloud Backup (optional) — when enabled, all your data is automatically backed up to a secure cloud server (Supabase). New bills, products, and customers sync in the background.",
            "Restore from Cloud — if you switch to a new phone, log in with the same number and tap 'Restore from Cloud' in Settings to get all your data back.",
            "Sync Queue — if you are offline when adding data, the changes are queued and automatically uploaded when you are back online. You can also tap 'Sync Now' in Settings to force an upload.",
            "Export Backup (.json) — create a local backup file of all your data and save it to your phone or share it to cloud storage. Always shown a privacy warning before export.",
            "Import from Backup — restore data from a previously exported .json file. The app warns you if the backup belongs to a different shop number.",
            "Local-Only Mode — choose 'This Phone Only' during setup to keep all data strictly on your device. No data ever leaves your phone. You can enable cloud backup later from Settings.",
            "Privacy — your data is tied to your phone number and protected by Row-Level Security on the cloud. No other shop can access your data."
        ],
        tip: "If you chose 'This Phone Only' during setup, you can still enable cloud backup later from Settings → Enable Cloud Backup. All your existing data will be uploaded automatically."
    },
    {
        id: "settings",
        title: "Settings & Customisation",
        subtitle: "Tailor the app to your shop",
        bgColor: "#FAF5FF",
        accentColor: "#9333EA",
        badge: "",
        points: [
            "Edit Shop Info — update your shop name, owner name, WhatsApp number, and business category from the pencil icon on the Settings profile card.",
            "Manage Categories — create and delete product categories. Categories help you organise your inventory and search products faster.",
            "Manage Brands — create and delete brand names. When editing a product, choose 'None' to remove a brand assignment.",
            "Help Center — in-app answers to common questions without needing internet.",
            "App Version — shows the current version. Tapping it 5 times reveals a debug export option for technical support.",
            "Logout — signs you out but does NOT delete your local data. Log back in with the same number and everything is still there.",
            "Delete All Data — permanently erases all local data and optionally cloud data. A double-confirmation is required. This cannot be undone."
        ],
        tip: "Your shop name appears on every PDF receipt and report. Keep it accurate in Settings so every document looks professional."
    }
];

const ICON_MAP: Record<string, any> = {
  dashboard: Home,
  products: Package,
  billing: FileText,
  bills: Clock,
  customers: Users,
  reports: BarChart2,
  data: Cloud,
  settings: Settings,
};

function FeatureCard({ section }: { section: typeof FEATURES[0] }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = ICON_MAP[section.id];

    return (
        <div 
            style={{ 
                backgroundColor: 'white', 
                borderRadius: '16px', 
                marginBottom: '1rem', 
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}
        >
            <div 
                style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: section.bgColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: section.accentColor }}>
                    {Icon && <Icon size={24} />}
                </div>
                
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>{section.title}</h3>
                        {section.badge && (
                            <span style={{ backgroundColor: section.accentColor, color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 'bold' }}>
                                {section.badge}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{section.subtitle}</p>
                </div>
                
                <div style={{ color: 'var(--text-muted)' }}>
                    {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {expanded && (
                <div style={{ padding: '0 1.5rem 1.5rem' }}>
                    <div style={{ height: '1px', backgroundColor: section.bgColor, marginBottom: '1rem' }} />
                    <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                        {section.points.map((point, idx) => (
                            <li key={idx} style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>{point}</li>
                        ))}
                    </ul>

                    {section.tip && (
                        <div style={{ 
                            marginTop: '1.5rem', 
                            padding: '1rem', 
                            backgroundColor: '#F8FAFC', 
                            borderLeft: `4px solid ${section.accentColor}`,
                            borderRadius: '0 8px 8px 0',
                            fontSize: '0.9rem'
                        }}>
                            <strong style={{ color: section.accentColor, display: 'block', marginBottom: '0.25rem' }}>Pro Tip:</strong>
                            <span style={{ color: 'var(--text-secondary)' }}>{section.tip}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function AppFeatures() {
  return (
    <div className="content-wrapper">
      <div className="glass-card" style={{ maxWidth: '800px', margin: '2rem auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '2rem' }}>App Features</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                Everything Pragati Bandhu can do for your shop — tap any section to explore
            </p>
        </div>
        
        <div>
            {FEATURES.map((section) => (
                <FeatureCard key={section.id} section={section} />
            ))}
        </div>
      </div>
    </div>
  );
}
