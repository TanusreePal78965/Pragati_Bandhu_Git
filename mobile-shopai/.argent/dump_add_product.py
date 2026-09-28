import json
from argent_client import ArgentClient

client = ArgentClient()
# Navigate to Inventory tab
client.tap(0.3, 0.95) # Inventory tab coordinates
import time
time.sleep(2)

# Tap FAB
els = client.describe()
fab = client.find_element(els, text="", clickable=True)
if fab:
    client.tap(fab["center_x"], fab["center_y"])
else:
    client.tap(0.9, 0.85)
time.sleep(2)

# Get describe
res = client.run_tool("describe", {"udid": client.udid})
desc = res.get("description", "")
with open("/Users/suvo/Developer/Pragati_Bandhu/add_product_layout.txt", "w") as f:
    f.write(desc)
print("[*] Screen layout written to add_product_layout.txt")
