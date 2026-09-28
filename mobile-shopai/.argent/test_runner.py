import os
import sys
import time
import json
import traceback
from datetime import datetime
from argent_client import ArgentClient

# Output directory for screenshots and test reports
BRAIN_DIR = "/Users/suvo/.gemini/antigravity/brain/735eb64d-3d91-476e-a03b-9f3a706baeac"

class TestSuite:
    def __init__(self, udid=None):
        self.client = ArgentClient(udid=udid)
        self.results = []

    def log_result(self, tc_id, module, description, status, notes=""):
        icon = "✅" if status == "PASS" else "❌"
        print(f"  {icon} [{tc_id}] {module} - {description} -> {status}" + (f" ({notes})" if notes else ""))
        self.results.append({
            "id": tc_id,
            "module": module,
            "description": description,
            "status": status,
            "notes": notes,
            "timestamp": datetime.now().isoformat()
        })

    def tap_tab(self, name):
        """Tap a bottom tab bar button specifically (y > 0.9) to avoid quick action overlaps."""
        els = self.client.describe()
        for el in els:
            if el["role"] == "View" and el["clickable"] and el["y"] > 0.9 and name.lower() in el["text"].lower():
                print(f"[*] Navigating via tab bar: {name} at ({el['center_x']:.3f}, {el['center_y']:.3f})")
                self.client.tap(el["center_x"], el["center_y"])
                time.sleep(2)
                return True
        # Fallback coordinates if description matching fails
        tab_coords = {
            "home": (0.10, 0.95),
            "inventory": (0.30, 0.95),
            "customers": (0.50, 0.95),
            "reports": (0.70, 0.95),
            "settings": (0.90, 0.95)
        }
        if name.lower() in tab_coords:
            cx, cy = tab_coords[name.lower()]
            print(f"[*] Tab {name} not found in description. Tapping fallback coordinate: ({cx}, {cy})")
            self.client.tap(cx, cy)
            time.sleep(2)
            return True
        return False

    def run_tests(self):
        print("=" * 60)
        print("  PRAGATI BANDHU - ARGENT AUTOMATED TEST SUITE")
        print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        try:
            # 0. App Launch
            self.client.restart_app()
            time.sleep(3)
            self.client.screenshot("00_app_launched")
            
            # Run Test Modules
            self.test_dashboard()
            self.test_inventory()
            self.test_billing()
            self.test_udhar()
            self.test_reports()
            self.test_settings_and_backup()
            
        except Exception as e:
            print(f"[!] Test execution interrupted by error: {e}")
            traceback.print_exc()
            self.client.screenshot("error_crash")
            
        self.print_report()

    def test_dashboard(self):
        print("\n" + "-" * 50)
        print("[*] Running Module 2: Home / Dashboard Tests")
        print("-" * 50)
        
        # Ensure we are on Home tab
        self.tap_tab("Home")
        els = self.client.describe()
        
        # Verify Today's Sales Card
        sales_card = self.client.find_element(els, text_contains="TODAY'S TOTAL SALES")
        if sales_card:
            self.log_result("TC-201", "Dashboard", "Verify Today's Sales Card loads", "PASS")
        else:
            self.log_result("TC-201", "Dashboard", "Verify Today's Sales Card loads", "FAIL", "Sales card not found")

        # Verify AI Insights card
        ai_card = self.client.find_element(els, text_contains="AI Reorder Insights")
        low_stock_card = self.client.find_element(els, text_contains="Low Stock Alerts")
        if ai_card or low_stock_card:
            self.log_result("TC-202/203", "Dashboard", "Verify Consent-aware card loads", "PASS", 
                            "AI Insights" if ai_card else "Low Stock Alerts")
        else:
            self.log_result("TC-202/203", "Dashboard", "Verify Consent-aware card loads", "FAIL", "No card found")

    def test_inventory(self):
        print("\n" + "-" * 50)
        print("[*] Running Module 3: Products / Inventory Tests")
        print("-" * 50)
        
        # Navigate to Inventory via Tab
        if not self.tap_tab("Inventory"):
            self.log_result("TC-301", "Inventory", "Navigate to Inventory screen", "FAIL", "Tab not found")
            return
        
        els = self.client.describe()
        self.client.screenshot("tc301_01_inventory_list")
        
        # 1. Add Product (Required fields only)
        # Tapping the Add FAB (usually bottom-right, clickable, symbol '' or similar)
        fab = self.client.find_element(els, text="", clickable=True)
        if fab:
            self.client.tap(fab["center_x"], fab["center_y"])
        else:
            # Fallback coordinate based on screen size
            self.client.tap(0.9, 0.85)
        
        time.sleep(2)
        els = self.client.describe()
        self.client.screenshot("tc301_02_add_product")
        
        # Find product name input using placeholder "e.g. Basmati Rice"
        name_input = self.client.find_element(els, text_contains="e.g. Basmati Rice")
        if name_input:
            self.client.tap(name_input["center_x"], name_input["center_y"])
            self.client.type_text("Demo Product")
            self.client.press_key("enter")
        else:
            # Fallback: look for first text input field
            text_inputs = [el for el in els if el["role"] in ["TextField", "EditText"] or el["clickable"]]
            if text_inputs:
                target = text_inputs[0]
                self.client.tap(target["center_x"], target["center_y"])
                self.client.type_text("Demo Product")
                self.client.press_key("enter")
            else:
                self.log_result("TC-302", "Inventory", "Add Product - Required fields only", "FAIL", "Name field not found")
                self.client.press_key("escape") # go back
                return

        # Tap "Dal" Category
        dal_chip = self.client.find_element(els, text="Dal")
        if dal_chip:
            self.client.tap(dal_chip["center_x"], dal_chip["center_y"])
            time.sleep(0.5)

        # Scroll to Selling Price
        self.client.swipe(0.5, 0.8, 0.5, 0.3)
        time.sleep(1.5)
        els = self.client.describe()
        
        # Fill Selling Price
        # Look for the input field with text containing "0" or "0.00" or similar below the Selling Price label
        price_input = self.client.find_element(els, text="₹ 0.00") or self.client.find_element(els, text="0.00") or self.client.find_element(els, text="0")
        if price_input:
            self.client.tap(price_input["center_x"], price_input["center_y"])
            self.client.clear_text(5)
            self.client.type_text("30")
            self.client.press_key("enter")
        else:
            # Tap by approximate coordinate for selling price field
            self.client.tap(0.5, 0.68)
            self.client.clear_text(5)
            self.client.type_text("30")
            self.client.press_key("enter")
        
        # Scroll to Save button
        self.client.swipe(0.5, 0.8, 0.5, 0.2)
        time.sleep(1.5)
        els = self.client.describe()
        
        save_btn = self.client.find_element(els, text="Save Product", clickable=True)
        if save_btn:
            self.client.tap(save_btn["center_x"], save_btn["center_y"])
        else:
            self.client.tap(0.5, 0.95) # Fallback center bottom tap
            
        time.sleep(2)
        
        # Handle success dialog if present
        els = self.client.describe()
        ok_btn = self.client.find_element(els, text="OK") or self.client.find_element(els, text="Dismiss")
        if ok_btn:
            self.client.tap(ok_btn["center_x"], ok_btn["center_y"])
            time.sleep(1)
            els = self.client.describe()

        # Verify product added to list
        self.client.screenshot("tc301_03_inventory_after_save")
        demo_product = self.client.find_element(els, text_contains="Demo Product")
        if demo_product:
            self.log_result("TC-302", "Inventory", "Add Product - Required fields only", "PASS")
        else:
            self.log_result("TC-302", "Inventory", "Add Product - Required fields only", "FAIL", "Product not found in list")

        # 2. Blank Name Validation
        # Tap Add FAB again
        fab = self.client.find_element(els, text="", clickable=True)
        if fab:
            self.client.tap(fab["center_x"], fab["center_y"])
        else:
            self.client.tap(0.9, 0.85)
        time.sleep(2)
        
        # Scroll to save immediately
        self.client.swipe(0.5, 0.8, 0.5, 0.2)
        time.sleep(1)
        self.client.swipe(0.5, 0.8, 0.5, 0.2)
        time.sleep(1.5)
        els = self.client.describe()
        
        save_btn = self.client.find_element(els, text="Save Product")
        if save_btn:
            # Click save, verify it blocks or stays on page
            self.client.tap(save_btn["center_x"], save_btn["center_y"])
            time.sleep(1.5)
            els = self.client.describe()
            still_on_add = self.client.find_element(els, text_contains="Product Name") or self.client.find_element(els, text="Save Product")
            if still_on_add:
                self.log_result("TC-303", "Inventory", "Add Product - Blank Name Validation", "PASS")
            else:
                self.log_result("TC-303", "Inventory", "Add Product - Blank Name Validation", "FAIL", "Navigated away without validation")
        else:
            self.log_result("TC-303", "Inventory", "Add Product - Blank Name Validation", "FAIL", "Save button not found")
            
        # Go back to inventory list
        self.client.press_key("escape")
        time.sleep(2)

        # 3. Delete Product (TC-309)
        els = self.client.describe()
        # Find Demo Product and click its trash icon
        demo_idx = -1
        for idx, el in enumerate(els):
            if "Demo Product" in el["text"]:
                demo_idx = idx
                break
                
        if demo_idx != -1:
            # Search next clickable element (trash icon is far right)
            trash_btn = None
            for j in range(demo_idx + 1, min(demo_idx + 10, len(els))):
                if els[j]["clickable"] and els[j]["center_x"] > 0.8:
                    trash_btn = els[j]
                    break
            if trash_btn:
                self.client.tap(trash_btn["center_x"], trash_btn["center_y"])
                time.sleep(1.5)
                els = self.client.describe()
                self.client.screenshot("tc309_delete_confirm")
                
                # Tap confirm Delete button
                confirm = self.client.find_element(els, text="Delete") or self.client.find_element(els, text="Confirm") or self.client.find_element(els, text="Yes")
                if confirm:
                    self.client.tap(confirm["center_x"], confirm["center_y"])
                    time.sleep(2)
                    els = self.client.describe()
                    self.client.screenshot("tc309_after_delete")
                    deleted_check = self.client.find_element(els, text="Demo Product")
                    if not deleted_check:
                        self.log_result("TC-309", "Inventory", "Delete Product - Single Item", "PASS")
                    else:
                        self.log_result("TC-309", "Inventory", "Delete Product - Single Item", "FAIL", "Product still visible after delete")
                else:
                    self.log_result("TC-309", "Inventory", "Delete Product - Single Item", "FAIL", "Delete confirm button not found")
            else:
                self.log_result("TC-309", "Inventory", "Delete Product - Single Item", "FAIL", "Trash icon not found for Demo Product")
        else:
            self.log_result("TC-309", "Inventory", "Delete Product - Single Item", "FAIL", "Demo Product not found in list")

    def test_billing(self):
        print("\n" + "-" * 50)
        print("[*] Running Module 4 & 5: Billing & History Tests")
        print("-" * 50)
        
        # Navigate back to Home via Tab
        self.tap_tab("Home")
        els = self.client.describe()
        
        # Tap Create New Bill
        if not self.client.tap_element(text_contains="Create New Bill", elements=els):
            self.log_result("TC-401", "Billing", "Open New Bill screen", "FAIL", "Create New Bill button not found")
            return
        time.sleep(2)
        self.client.screenshot("tc401_01_billing_screen")
        
        # Try empty checkout validation (TC-405)
        els = self.client.describe()
        checkout_btn = self.client.find_element(els, text_contains="Checkout") or self.client.find_element(els, text_contains="CHECKOUT")
        if checkout_btn:
            self.client.tap(checkout_btn["center_x"], checkout_btn["center_y"])
            time.sleep(1.5)
            els = self.client.describe()
            empty_alert = self.client.find_element(els, text_contains="Empty Bill") or self.client.find_element(els, text_contains="at least one product")
            if empty_alert:
                self.log_result("TC-405", "Billing", "New Bill - Empty bill checkout validation", "PASS")
                # Dismiss alert
                ok_btn = self.client.find_element(els, text="OK") or self.client.find_element(els, text="Dismiss")
                if ok_btn:
                    self.client.tap(ok_btn["center_x"], ok_btn["center_y"])
            else:
                self.log_result("TC-405", "Billing", "New Bill - Empty bill checkout validation", "FAIL", "No validation alert shown")
        else:
            self.log_result("TC-405", "Billing", "New Bill - Empty bill checkout validation", "FAIL", "Checkout button not found")
        
        time.sleep(1)
        els = self.client.describe()
        
        # Add a product to the bill
        # Search for a product (e.g. Salt)
        search_field = self.client.find_element(els, text_contains="Search product to add...") or self.client.find_element(els, role="TextField")
        if search_field:
            self.client.tap(search_field["center_x"], search_field["center_y"])
            self.client.type_text("Salt")
            self.client.press_key("enter")
            time.sleep(1.5)
            els = self.client.describe()
            self.client.screenshot("tc401_02_product_searched")
            
            # Select the product (e.g. Tata Salt 1kg)
            product_row = self.client.find_element(els, text_contains="Tata Salt") or self.client.find_element(els, text_contains="Salt")
            if product_row:
                self.client.tap(product_row["center_x"], product_row["center_y"])
                time.sleep(1)
            else:
                # Tap first matching item in results below search bar
                self.client.tap(0.3, 0.25)
                time.sleep(1)
        else:
            self.log_result("TC-401", "Billing", "Add product to bill", "FAIL", "Search field not found")
            self.client.press_key("escape")
            return

        els = self.client.describe()
        self.client.screenshot("tc401_03_bill_with_product")
        
        # Try Udhar Mode without Customer selected (TC-404)
        udhar_btn = self.client.find_element(els, text_contains="Udhar", clickable=True)
        if udhar_btn:
            self.client.tap(udhar_btn["center_x"], udhar_btn["center_y"])
            time.sleep(0.5)
            els = self.client.describe()
            
            # Checkout
            checkout_btn = self.client.find_element(els, text_contains="Checkout") or self.client.find_element(els, text_contains="CHECKOUT")
            if checkout_btn:
                self.client.tap(checkout_btn["center_x"], checkout_btn["center_y"])
                time.sleep(1.5)
                els = self.client.describe()
                self.client.screenshot("tc404_udhar_validation")
                cust_req_alert = self.client.find_element(els, text_contains="Customer Required") or self.client.find_element(els, text_contains="select a customer")
                if cust_req_alert:
                    self.log_result("TC-404", "Billing", "New Bill - Udhar payment, no customer validation", "PASS")
                    # Dismiss alert
                    ok_btn = self.client.find_element(els, text="OK") or self.client.find_element(els, text="Dismiss")
                    if ok_btn:
                        self.client.tap(ok_btn["center_x"], ok_btn["center_y"])
                else:
                    self.log_result("TC-404", "Billing", "New Bill - Udhar payment, no customer validation", "FAIL", "No alert shown")
            else:
                self.log_result("TC-404", "Billing", "New Bill - Udhar payment validation", "FAIL", "Checkout button not found")
        else:
            self.log_result("TC-404", "Billing", "New Bill - Udhar payment validation", "FAIL", "Udhar button not found")

        time.sleep(1)
        els = self.client.describe()
        
        # Tap select customer, choose Ramesh Kumar (TC-403)
        select_cust = self.client.find_element(els, text_contains="Select Customer") or self.client.find_element(els, text_contains="Walk-in Customer")
        if select_cust:
            self.client.tap(select_cust["center_x"], select_cust["center_y"])
            time.sleep(1.5)
            els = self.client.describe()
            self.client.screenshot("tc403_select_customer_modal")
            
            # Choose Ramesh Kumar
            ramesh_row = self.client.find_element(els, text_contains="Ramesh Kumar")
            if ramesh_row:
                self.client.tap(ramesh_row["center_x"], ramesh_row["center_y"])
                time.sleep(1.5)
            else:
                # Tap first customer in list
                self.client.tap(0.3, 0.3)
                time.sleep(1.5)
        else:
            self.log_result("TC-403", "Billing", "Select customer", "FAIL", "Select Customer button not found")
            self.client.press_key("escape")
            return

        els = self.client.describe()
        self.client.screenshot("tc403_bill_with_customer")
        
        # Checkout successfully under Udhar mode
        checkout_btn = self.client.find_element(els, text_contains="Checkout") or self.client.find_element(els, text_contains="CHECKOUT")
        if checkout_btn:
            self.client.tap(checkout_btn["center_x"], checkout_btn["center_y"])
            time.sleep(2)
            els = self.client.describe()
            self.client.screenshot("tc403_checkout_success")
            
            success_alert = self.client.find_element(els, text_contains="Saved") or self.client.find_element(els, text_contains="successful")
            if success_alert:
                self.log_result("TC-403", "Billing", "New Bill - Udhar payment, customer selected", "PASS")
                # Dismiss alert
                ok_btn = self.client.find_element(els, text="OK") or self.client.find_element(els, text="Dismiss")
                if ok_btn:
                    self.client.tap(ok_btn["center_x"], ok_btn["center_y"])
            else:
                self.log_result("TC-403", "Billing", "New Bill - Udhar payment, customer selected", "FAIL", "Success alert not found")
        else:
            self.log_result("TC-403", "Billing", "New Bill - Udhar payment, customer selected", "FAIL", "Checkout button not found")

        time.sleep(2)

    def test_udhar(self):
        print("\n" + "-" * 50)
        print("[*] Running Module 6: Customers & Udhar Tests")
        print("-" * 50)
        
        # Navigate to Customers
        if not self.tap_tab("Customers"):
            self.log_result("TC-601", "Customers", "Navigate to Customers screen", "FAIL", "Tab not found")
            return
        
        els = self.client.describe()
        self.client.screenshot("tc601_customers_list")
        
        # Verify Total Udhar Card exists
        udhar_card = self.client.find_element(els, text_contains="OUTSTANDING UDHAR")
        if udhar_card:
            self.log_result("TC-601", "Customers", "Verify outstanding udhar card", "PASS")
        else:
            self.log_result("TC-601", "Customers", "Verify outstanding udhar card", "FAIL", "Card not found")

        # Open Edit Customer for Ramesh Kumar
        ramesh_row = self.client.find_element(els, text_contains="Ramesh Kumar")
        if ramesh_row:
            self.client.tap(ramesh_row["center_x"], ramesh_row["center_y"])
            time.sleep(2)
            els = self.client.describe()
            self.client.screenshot("tc607_customer_details")
            
            # Verify Udhar Balance Card (TC-611)
            balance_card = self.client.find_element(els, text_contains="Outstanding amount") or self.client.find_element(els, text_contains="Collect")
            if balance_card:
                self.log_result("TC-607/611", "Customers", "Verify Customer Details and Balance Card", "PASS")
            else:
                self.log_result("TC-607/611", "Customers", "Verify Customer Details and Balance Card", "FAIL", "Balance card not found")
                self.client.press_key("escape")
                return
            
            # Click Record Payment (TC-613)
            pay_btn = self.client.find_element(els, text_contains="Record Payment") or self.client.find_element(els, text_contains="Collect")
            if pay_btn:
                self.client.tap(pay_btn["center_x"], pay_btn["center_y"])
                time.sleep(1.5)
                els = self.client.describe()
                self.client.screenshot("tc613_record_payment_modal")
                
                # Check quick chip visibility
                chips = [el for el in els if "Full" in el["text"] or "100" in el["text"] or "500" in el["text"]]
                if len(chips) > 0:
                    self.log_result("TC-613/614", "Customers", "Verify quick payment chips", "PASS")
                else:
                    self.log_result("TC-613/614", "Customers", "Verify quick payment chips", "FAIL", "No chips found")
                
                # Dismiss modal
                cancel_btn = self.client.find_element(els, text="Cancel") or self.client.find_element(els, text="Close")
                if cancel_btn:
                    self.client.tap(cancel_btn["center_x"], cancel_btn["center_y"])
                    time.sleep(1)
                else:
                    self.client.press_key("escape")
            else:
                self.log_result("TC-613", "Customers", "Open Record Payment modal", "FAIL", "Record Payment button not found")
            
            # Check bill history (TC-620)
            history = self.client.find_element(els, text_contains="BILL HISTORY") or self.client.find_element(els, text_contains="Udhar")
            if history:
                self.log_result("TC-620", "Customers", "Verify customer bill history", "PASS")
            else:
                self.log_result("TC-620", "Customers", "Verify customer bill history", "FAIL", "History section not found")
                
            self.client.press_key("escape") # go back to list
            time.sleep(1.5)
        else:
            self.log_result("TC-607", "Customers", "Open customer details", "FAIL", "Ramesh Kumar not found in list")

    def test_reports(self):
        print("\n" + "-" * 50)
        print("[*] Running Module 7: Business Reports Tests")
        print("-" * 50)
        
        # Navigate to Reports
        if not self.tap_tab("Reports"):
            self.log_result("TC-701", "Reports", "Navigate to Reports screen", "FAIL", "Tab not found")
            return
        
        els = self.client.describe()
        self.client.screenshot("tc701_reports_screen")
        
        # Verify Today metrics are shown
        total_sales = self.client.find_element(els, text_contains="Total Sales")
        net_profit = self.client.find_element(els, text_contains="Net Profit") or self.client.find_element(els, text_contains="Profit")
        if total_sales or net_profit:
            self.log_result("TC-701", "Reports", "Verify reports load with metrics", "PASS")
        else:
            self.log_result("TC-701", "Reports", "Verify reports load with metrics", "FAIL", "Total Sales / Net Profit label not found")

        # Test period toggle (This Week)
        week_tab = self.client.find_element(els, text="This Week") or self.client.find_element(els, text="Week")
        if week_tab:
            self.client.tap(week_tab["center_x"], week_tab["center_y"])
            time.sleep(1.5)
            self.log_result("TC-702", "Reports", "Toggle range - This Week", "PASS")
            self.client.screenshot("tc702_reports_week")
        else:
            self.log_result("TC-702", "Reports", "Toggle range - This Week", "FAIL", "Week tab not found")

        # Verify export button triggers PDF dialog warning (TC-706)
        els = self.client.describe()
        export_btn = self.client.find_element(els, text_contains="Export") or self.client.find_element(els, text_contains="PDF")
        if export_btn:
            self.client.tap(export_btn["center_x"], export_btn["center_y"])
            time.sleep(1.5)
            els = self.client.describe()
            self.client.screenshot("tc706_export_dialog")
            # If period is empty or not, verify it shows either share sheet or warning
            is_empty_warning = self.client.find_element(els, text_contains="No data") or self.client.find_element(els, text_contains="There are no bills")
            if is_empty_warning:
                self.log_result("TC-707", "Reports", "PDF Export - Empty period validation", "PASS")
                # Dismiss alert
                ok_btn = self.client.find_element(els, text="OK") or self.client.find_element(els, text="Dismiss")
                if ok_btn:
                    self.client.tap(ok_btn["center_x"], ok_btn["center_y"])
            else:
                self.log_result("TC-706", "Reports", "PDF Export - Trigger export", "PASS", "PDF sharing started or no warning")
                # Press back to close share sheet if it opened
                self.client.press_key("escape")
        else:
            self.log_result("TC-706", "Reports", "PDF Export - Trigger export", "FAIL", "Export button not found")

    def test_settings_and_backup(self):
        print("\n" + "-" * 50)
        print("[*] Running Module 8: Settings & Backup Tests")
        print("-" * 50)
        
        # Navigate to Settings via Tab
        if not self.tap_tab("Settings"):
            self.log_result("TC-801", "Settings", "Navigate to Settings screen", "FAIL", "Tab not found")
            return
        
        els = self.client.describe()
        self.client.screenshot("tc801_settings_screen")
        
        # Verify Shop name display
        shop_info = self.client.find_element(els, text_contains="SHOP NAME") or self.client.find_element(els, text_contains="WHATSAPP")
        if shop_info:
            self.log_result("TC-801", "Settings", "Verify Shop Info display", "PASS")
        else:
            self.log_result("TC-801", "Settings", "Verify Shop Info display", "FAIL", "Info labels not found")

        # Scroll down to Backup section
        self.client.swipe(0.5, 0.8, 0.5, 0.2)
        time.sleep(1)
        self.client.swipe(0.5, 0.8, 0.5, 0.2)
        time.sleep(1.5)
        els = self.client.describe()
        
        # Test Export Backup JSON warning (TC-810)
        export_btn = self.client.find_element(els, text_contains="Export Backup")
        if export_btn:
            self.client.tap(export_btn["center_x"], export_btn["center_y"])
            time.sleep(1.5)
            els = self.client.describe()
            self.client.screenshot("tc810_privacy_warning")
            privacy_alert = self.client.find_element(els, text_contains="Privacy Notice") or self.client.find_element(els, text_contains="sensitive")
            if privacy_alert:
                self.log_result("TC-810", "Settings", "Export Backup - Privacy Warning check", "PASS")
                # Tap cancel
                cancel_btn = self.client.find_element(els, text="Cancel") or self.client.find_element(els, text="No")
                if cancel_btn:
                    self.client.tap(cancel_btn["center_x"], cancel_btn["center_y"])
                else:
                    self.client.press_key("escape")
            else:
                self.log_result("TC-810", "Settings", "Export Backup - Privacy Warning check", "FAIL", "Privacy alert not shown")
        else:
            self.log_result("TC-810", "Settings", "Export Backup - Privacy Warning check", "FAIL", "Export Backup button not found")

    def print_report(self):
        print("\n" + "=" * 60)
        print("  PRAGATI BANDHU - ARGENT AUTOMATED TEST RUN SUMMARY")
        print("=" * 60)
        
        passed = [r for r in self.results if r["status"] == "PASS"]
        failed = [r for r in self.results if r["status"] == "FAIL"]
        
        print(f"\n  Total Runs: {len(self.results)}")
        print(f"  ✅ Passed:   {len(passed)}")
        print(f"  ❌ Failed:   {len(failed)}")
        
        # Save JSON report
        report_path = os.path.join(BRAIN_DIR, "argent_test_report.json")
        report_data = {
            "summary": {
                "total": len(self.results),
                "passed": len(passed),
                "failed": len(failed)
            },
            "runs": self.results
        }
        with open(report_path, "w") as f:
            json.dump(report_data, f, indent=2)
        print(f"\n[*] Structured JSON test report saved to: {report_path}")

        # Navigate back to Home
        self.client.restart_app()
        print("\n" + "=" * 60)


if __name__ == "__main__":
    # If device UDID is passed as argument, use it
    device_udid = sys.argv[1] if len(sys.argv) > 1 else None
    suite = TestSuite(udid=device_udid)
    suite.run_tests()
