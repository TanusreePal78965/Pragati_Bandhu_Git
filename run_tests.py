import os
import sys
import time
import subprocess
import xml.etree.ElementTree as ET
import re

# Configurations
WORKSPACE = "/Users/suvo/Developer/Pragati_Bandhu"
BRAIN_DIR = "/Users/suvo/.gemini/antigravity-ide/brain/8fc5ef02-38e3-4ec1-9f2d-1a443115f5e4"
SCREENSHOT_DIR = BRAIN_DIR

def run_cmd(args):
    result = subprocess.run(args, capture_output=True, text=True, shell=True)
    return result.stdout.strip(), result.stderr.strip()

def adb_shell(cmd):
    return run_cmd(f"adb shell \"{cmd}\"")

def dump_ui():
    adb_shell("uiautomator dump /sdcard/window_dump.xml")
    run_cmd(f"adb pull /sdcard/window_dump.xml {WORKSPACE}/window_dump.xml")
    return parse_ui_xml(f"{WORKSPACE}/window_dump.xml")

def parse_bounds(bounds_str):
    match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds_str)
    if match:
        left, top, right, bottom = map(int, match.groups())
        return (left + right) // 2, (top + bottom) // 2
    return None

def parse_ui_xml(xml_path):
    elements = []
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        def traverse(node):
            text = node.get('text', '')
            content_desc = node.get('content-desc', '')
            bounds = node.get('bounds', '')
            clickable = node.get('clickable', '')
            resource_id = node.get('resource-id', '')
            class_name = node.get('class', '')
            
            center = parse_bounds(bounds) if bounds else None
            elements.append({
                'text': text,
                'content_desc': content_desc,
                'bounds': bounds,
                'clickable': clickable == 'true',
                'id': resource_id,
                'class': class_name,
                'center': center
            })
            for child in node:
                traverse(child)
        traverse(root)
    except Exception as e:
        print(f"Error parsing UI XML: {e}")
    return elements

def find_element(elements, text=None, content_desc=None, clickable=None, text_contains=None):
    for el in elements:
        if text is not None and el['text'].lower() == text.lower():
            return el
        if text_contains is not None and text_contains.lower() in el['text'].lower():
            return el
        if content_desc is not None and content_desc.lower() in el['content_desc'].lower():
            return el
        if clickable is not None and el['clickable'] == clickable:
            if text is None and content_desc is None and text_contains is None:
                return el
    return None

def find_search_bar(elements):
    for el in elements:
        if el['class'] == 'android.widget.EditText' and el['center'] and el['center'][1] < 600:
            return el
    return None

def tap(x, y):
    adb_shell(f"input tap {x} {y}")
    time.sleep(1)

def type_text(text):
    # Escape spaces
    escaped = text.replace(" ", "%s")
    adb_shell(f"input text \"{escaped}\"")
    time.sleep(0.5)

def clear_field():
    # Press backspace many times
    for _ in range(30):
        adb_shell("input keyevent 67")
    time.sleep(0.2)

def take_screenshot(name):
    path = f"{SCREENSHOT_DIR}/{name}.png"
    run_cmd(f"adb exec-out screencap -p > {path}")
    print(f"Captured screenshot: {path}")
    return path

print("ADB connection status:")
out, err = run_cmd("adb devices")
print(out)

# Start Testing
print("\n--- Starting E2E Automation Testing ---")

# Step 1: Ensure we are in Inventory screen to add product
print("\n[TC-301] Navigating to Inventory screen...")
elements = dump_ui()
inventory_tab = find_element(elements, content_desc="Inventory")
if inventory_tab:
    print(f"Found Inventory tab at {inventory_tab['center']}. Tapping...")
    tap(*inventory_tab['center'])
else:
    tap(372, 2629)

elements = dump_ui()

# Clear search bar at the very beginning to ensure list is not filtered
search_bar = find_search_bar(elements)
if search_bar:
    print("Clearing any existing text in search bar...")
    tap(*search_bar['center'])
    clear_field()
    adb_shell("input keyevent 66") # Enter / Dismiss keyboard
    time.sleep(1)
    elements = dump_ui()

take_screenshot("01_inventory_screen")

# Click on Add Product FAB
add_fab = find_element(elements, text="")
if add_fab:
    print(f"Found Add Product FAB at {add_fab['center']}. Tapping...")
    tap(*add_fab['center'])
else:
    tap(1097, 2332)

print("Add Product Screen opened.")
elements = dump_ui()
take_screenshot("02_add_product_screen")

# Fill product name
print("Typing product name: Tata Salt 1kg...")
name_field = find_element(elements, text="e.g. Basmati Rice")
if name_field:
    tap(*name_field['center'])
else:
    tap(620, 606)
clear_field()
type_text("Tata Salt 1kg")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

print("Selecting Dal category...")
dal_chip = find_element(elements, text="Dal")
if dal_chip:
    tap(*dal_chip['center'])
else:
    tap(126, 878)
time.sleep(0.5)

# Fill purchase price
print("Typing Purchase Price = 18...")
tap(668, 1599)
clear_field()
type_text("18")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

# Fill selling price
print("Typing Selling Price = 22...")
tap(668, 1882)
clear_field()
type_text("22")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

# Fill initial stock
print("Typing Initial Stock = 50...")
tap(668, 2165)
clear_field()
type_text("50")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

# Fill low stock threshold
print("Typing Low Stock Alert Threshold = 10...")
tap(668, 2476)
clear_field()
type_text("10")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

# Save product
print("Saving product...")
elements = dump_ui()
save_btn = find_element(elements, text="Save Product")
if save_btn:
    tap(*save_btn['center'])
else:
    tap(620, 2641)

time.sleep(2)
print("Product saved! Checking Inventory list...")
elements = dump_ui()
take_screenshot("03_inventory_after_add")

tata_salt = find_element(elements, text="Tata Salt 1kg")
if tata_salt:
    print("TC-301 PASS: Tata Salt 1kg is successfully added to the Inventory list!")
else:
    print("TC-301 FAIL: Tata Salt 1kg was not found in the list.")

# Step 2: Test Search
print("\n[TC-304] Testing Search bar...")
search_bar = find_search_bar(elements)
if search_bar:
    tap(*search_bar['center'])
else:
    tap(662, 380)
clear_field()
type_text("Salt")
adb_shell("input keyevent 4") # Dismiss keyboard to see results
time.sleep(1)
elements = dump_ui()
take_screenshot("04_search_salt")

tata_salt_search = find_element(elements, text="Tata Salt 1kg")
if tata_salt_search:
    print("TC-304 PASS: Search for 'Salt' correctly filters and displays 'Tata Salt 1kg'!")
else:
    print("TC-304 FAIL: Tata Salt 1kg not found in search results.")

# Clear search
print("Clearing search bar...")
search_bar = find_search_bar(elements)
if search_bar:
    tap(*search_bar['center'])
else:
    tap(662, 380)
clear_field()
adb_shell("input keyevent 66") # Enter
time.sleep(1)

# Step 3: Test Edit Product
print("\n[TC-305/TC-306] Editing Tata Salt 1kg price...")
elements = dump_ui()
tata_idx = -1
for idx, el in enumerate(elements):
    if el['text'] == "Tata Salt 1kg":
        tata_idx = idx
        break

if tata_idx != -1:
    for j in range(tata_idx + 1, len(elements)):
        if elements[j]['text'] == "" and elements[j]['clickable']:
            print(f"Found edit pencil for Tata Salt at {elements[j]['center']}. Tapping...")
            tap(*elements[j]['center'])
            break
else:
    print("Tata Salt 1kg row not found. Tapping default first row edit...")
    tap(1043, 815) # Default first row edit

time.sleep(1.5)
print("Edit Product screen opened.")
elements = dump_ui()
take_screenshot("05_edit_product_screen")

# Change selling price to 25
print("Changing Selling Price from 22 to 25...")
tap(668, 1882)
clear_field()
type_text("25")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

# Save edited product
print("Saving edited product...")
elements = dump_ui()
save_btn = find_element(elements, text="Save Product")
if save_btn:
    tap(*save_btn['center'])
else:
    tap(620, 2641)

time.sleep(2)
elements = dump_ui()
take_screenshot("06_inventory_after_edit")

# Verify new price
tata_salt_updated = find_element(elements, text="Tata Salt 1kg")
tata_updated_idx = -1
for idx, el in enumerate(elements):
    if el['text'] == "Tata Salt 1kg":
        tata_updated_idx = idx
        break

if tata_updated_idx != -1:
    price_el = elements[tata_updated_idx + 1] # Typically next element contains price
    print(f"Tata Salt updated price shown: {price_el['text']}")
    if "25" in price_el['text']:
        print("TC-306 PASS: Tata Salt 1kg selling price successfully updated to ₹25!")
    else:
        print(f"TC-306 FAIL: Expected ₹25, got {price_el['text']}")

# Step 4: Test Add Customer
print("\n[TC-604] Navigating to Customers screen...")
customers_tab = find_element(elements, content_desc="Customers")
if customers_tab:
    tap(*customers_tab['center'])
else:
    tap(620, 2629)

time.sleep(1.5)
elements = dump_ui()
take_screenshot("07_customers_screen")

# Tap on Add Customer FAB ``
add_cust_fab = find_element(elements, text="")
if add_cust_fab:
    tap(*add_cust_fab['center'])
else:
    tap(1097, 2332)

time.sleep(1.5)
print("Add New Customer screen opened.")
elements = dump_ui()
take_screenshot("08_add_customer_screen")

# Fill customer details
print("Typing customer name: Ramesh Kumar...")
cust_name_field = find_element(elements, text="Enter full name")
if cust_name_field:
    tap(*cust_name_field['center'])
else:
    tap(620, 606)
clear_field()
type_text("Ramesh Kumar")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

print("Typing customer phone: 9876543210...")
cust_phone_field = find_element(elements, text="Enter 10-digit number")
if cust_phone_field:
    tap(*cust_phone_field['center'])
else:
    tap(620, 878)
clear_field()
type_text("9876543210")
adb_shell("input keyevent 4") # Dismiss keyboard
time.sleep(0.5)

print("Saving customer...")
elements = dump_ui()
save_cust_btn = find_element(elements, text="Save Customer")
if save_cust_btn:
    tap(*save_cust_btn['center'])
else:
    tap(620, 2641)

time.sleep(2)
elements = dump_ui()
take_screenshot("09_customers_after_add")

ramesh_cust = find_element(elements, text="Ramesh Kumar")
if ramesh_cust:
    print("TC-604 PASS: Ramesh Kumar successfully added to the Customer list!")
else:
    print("TC-604 FAIL: Ramesh Kumar not found in customer list.")

# Step 5: Test Creating Udhar Bill
print("\n[TC-401/TC-403] Creating a new Udhar bill for Ramesh Kumar...")
home_tab = find_element(elements, content_desc="Home")
if home_tab:
    tap(*home_tab['center'])
else:
    tap(124, 2629)

time.sleep(1.5)
elements = dump_ui()
take_screenshot("10_home_before_bill")

# Tap Create New Bill
create_bill_btn = find_element(elements, text="Create New Bill")
if create_bill_btn:
    tap(*create_bill_btn['center'])
else:
    tap(620, 1481)

time.sleep(1.5)
print("Create New Bill screen opened.")
elements = dump_ui()
take_screenshot("11_create_bill_screen")

# Search for Tata Salt
print("Searching for product: Salt...")
prod_search_field = find_element(elements, text_contains="Search product")
if prod_search_field:
    tap(*prod_search_field['center'])
else:
    tap(662, 380)
type_text("Salt")
adb_shell("input keyevent 4") # Dismiss keyboard to see search results
time.sleep(1)
elements = dump_ui()
take_screenshot("12_bill_product_search")

# Click on Tata Salt 1kg to add to bill
tata_salt_bill = find_element(elements, text="Tata Salt 1kg")
if tata_salt_bill:
    print("Adding Tata Salt 1kg to bill...")
    tap(*tata_salt_bill['center'])
else:
    tap(300, 550) # Tap first item

time.sleep(1)
elements = dump_ui()
take_screenshot("13_bill_after_product_added")

# Select Udhar Payment Mode
print("Selecting payment mode: Udhar...")
udhar_btn = find_element(elements, text="Udhar")
if udhar_btn:
    tap(*udhar_btn['center'])
else:
    tap(900, 2300)

time.sleep(1)
elements = dump_ui()

# Select Customer Ramesh Kumar
print("Tapping Select Customer...")
select_cust = find_element(elements, text_contains="Select Customer")
if select_cust:
    tap(*select_cust['center'])
else:
    tap(620, 2100)

time.sleep(1.5)
elements = dump_ui()
take_screenshot("14_select_customer_modal")

# Choose Ramesh Kumar
ramesh_row = find_element(elements, text="Ramesh Kumar")
if ramesh_row:
    print("Selecting Ramesh Kumar...")
    tap(*ramesh_row['center'])
else:
    tap(300, 600)

time.sleep(1.5)
elements = dump_ui()
take_screenshot("15_bill_with_customer_selected")

# Checkout
print("Tapping Checkout button...")
checkout_btn = find_element(elements, text_contains="Checkout")
if not checkout_btn:
    checkout_btn = find_element(elements, text_contains="Save Bill")
if checkout_btn:
    tap(*checkout_btn['center'])
else:
    tap(620, 2450)

time.sleep(2)
elements = dump_ui()
take_screenshot("16_bill_success_modal")

# Handle success alert
ok_btn = find_element(elements, text="OK")
if not ok_btn:
    ok_btn = find_element(elements, text="Dismiss")
if ok_btn:
    tap(*ok_btn['center'])
else:
    tap(620, 1600)

time.sleep(2)
elements = dump_ui()
take_screenshot("17_after_checkout")

print("Testing complete. Results recorded successfully.")
