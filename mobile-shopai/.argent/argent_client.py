import os
import sys
import json
import re
import subprocess
import time

class ArgentClient:
    def __init__(self, udid=None, workspace="/Users/suvo/Developer/Pragati_Bandhu"):
        self.workspace = workspace
        self.udid = udid
        if not self.udid:
            self.udid = self.detect_device()
        self.width, self.height = self.detect_resolution()
        print(f"[*] ArgentClient initialized with device: {self.udid} ({self.width}x{self.height})")

    def detect_device(self):
        """Detect the connected Android device UDID using Argent."""
        try:
            cmd = "npx @swmansion/argent run list-devices --json"
            res = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=self.workspace)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                for dev in data.get("devices", []):
                    if dev.get("platform") == "android" and dev.get("state") == "device":
                        return dev.get("serial")
        except Exception as e:
            print(f"[!] Error detecting device: {e}")
        # Fallback to adb devices
        try:
            res = subprocess.run("adb devices", capture_output=True, text=True, shell=True)
            lines = res.stdout.strip().split("\n")[1:]
            for line in lines:
                if "device" in line:
                    return line.split()[0]
        except Exception as e:
            print(f"[!] Error running adb devices: {e}")
        raise RuntimeError("No active Android device detected by Argent/ADB.")

    def detect_resolution(self):
        """Fetch the physical screen resolution of the device using adb."""
        try:
            res = subprocess.run("adb shell wm size", capture_output=True, text=True, shell=True)
            match = re.search(r"Physical size:\s*(\d+)x(\d+)", res.stdout)
            if match:
                return int(match.group(1)), int(match.group(2))
        except Exception as e:
            print(f"[!] Error fetching resolution: {e}")
        return 1240, 2772 # Fallback resolution for CPH2487

    def run_tool(self, tool, args=None):
        """Run an Argent tool with arguments passed as JSON."""
        cmd = f"npx @swmansion/argent run {tool}"
        if args:
            # Inject udid if not provided and required
            if "udid" not in args and tool in ["describe", "gesture-tap", "gesture-swipe", "keyboard", "screenshot", "launch-app", "restart-app"]:
                args["udid"] = self.udid
            
            # Pass args as a JSON string to avoid shell escaping issues
            json_args = json.dumps(args)
            cmd += f" --args '{json_args}'"
        
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=self.workspace)
        if res.returncode != 0:
            raise RuntimeError(f"Argent tool '{tool}' failed: {res.stderr.strip() or res.stdout.strip()}")
        
        try:
            return json.loads(res.stdout)
        except json.JSONDecodeError:
            return res.stdout.strip()

    def describe(self, retries=3, delay=1.5):
        """Get parsed UI elements on the current screen with retry logic to handle transitions."""
        for attempt in range(retries):
            try:
                res = self.run_tool("describe", {"udid": self.udid})
                desc = res.get("description", "")
                if desc:
                    return self.parse_description(desc)
            except Exception as e:
                print(f"[!] describe attempt {attempt + 1}/{retries} failed: {e}")
                if attempt < retries - 1:
                    time.sleep(delay)
                else:
                    raise e
        return []

    def parse_description(self, desc_text):
        """Parse the formatted description tree into structured elements."""
        elements = []
        # Pattern to match elements and coordinates
        pattern = r'^\s*([A-Za-z]+)(?:\s+"([^"]*)")?(?:\s+\[([^\]]*)\])*\s+\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)'
        
        for line in desc_text.split("\n"):
            match = re.match(pattern, line)
            if match:
                role = match.group(1)
                text = match.group(2) or ""
                flags_str = match.group(3) or ""
                flags = [f.strip() for f in flags_str.split(",") if f.strip()]
                
                x = float(match.group(4))
                y = float(match.group(5))
                w = float(match.group(6))
                h = float(match.group(7))
                
                # Calculate center coordinates for tapping
                center_x = x + w / 2
                center_y = y + h / 2
                
                elements.append({
                    "role": role,
                    "text": text,
                    "clickable": "clickable" in flags,
                    "scrollable": "scrollable" in flags,
                    "x": x, "y": y, "w": w, "h": h,
                    "center_x": center_x,
                    "center_y": center_y,
                    "raw_line": line.strip()
                })
        return elements

    def find_element(self, elements, text=None, role=None, text_contains=None, clickable=None):
        """Find a single element matching criteria."""
        for el in elements:
            if text is not None and el["text"].lower() != text.lower():
                continue
            if text_contains is not None and text_contains.lower() not in el["text"].lower():
                continue
            if role is not None and el["role"].lower() != role.lower():
                continue
            if clickable is not None and el["clickable"] != clickable:
                continue
            return el
        return None

    def tap(self, x, y, delay=1.0):
        """Tap at normalized coordinates (0.0 to 1.0) with ADB fallback."""
        try:
            self.run_tool("gesture-tap", {"udid": self.udid, "x": x, "y": y})
        except Exception as e:
            # Fallback to adb input tap scaled to device size
            px = int(x * self.width)
            py = int(y * self.height)
            print(f"[*] Native tap failed. ADB Fallback: adb shell input tap {px} {py}")
            subprocess.run(f"adb shell input tap {px} {py}", shell=True)
        time.sleep(delay)

    def swipe(self, from_x, from_y, to_x, to_y, delay=1.0):
        """Swipe from normalized coordinates to target coordinates with ADB fallback."""
        try:
            self.run_tool("gesture-swipe", {
                "udid": self.udid,
                "fromX": from_x,
                "fromY": from_y,
                "toX": to_x,
                "toY": to_y
            })
        except Exception as e:
            # Fallback to adb input swipe scaled to device size
            px1 = int(from_x * self.width)
            py1 = int(from_y * self.height)
            px2 = int(to_x * self.width)
            py2 = int(to_y * self.height)
            print(f"[*] Native swipe failed. ADB Fallback: adb shell input swipe {px1} {py1} {px2} {py2} 500")
            subprocess.run(f"adb shell input swipe {px1} {py1} {px2} {py2} 500", shell=True)
        time.sleep(delay)


    def tap_element(self, text=None, role=None, text_contains=None, elements=None, delay=1.0):
        """Find an element and tap its center."""
        if elements is None:
            elements = self.describe()
        
        el = self.find_element(elements, text=text, role=role, text_contains=text_contains)
        if el:
            print(f"[*] Tapping element: '{el['text']}' ({el['role']}) at ({el['center_x']:.3f}, {el['center_y']:.3f})")
            self.tap(el["center_x"], el["center_y"], delay)
            return True
        print(f"[!] Could not find element with text='{text}', contains='{text_contains}', role='{role}'")
        return False

    def type_text(self, text, delay=0.5):
        """Type text using keyboard tool with ADB fallback."""
        try:
            self.run_tool("keyboard", {"udid": self.udid, "text": text})
        except Exception as e:
            print(f"[*] Native keyboard failed. ADB Fallback: adb shell input text '{text}'")
            # Escape spaces for adb input text
            escaped = text.replace(" ", "%s")
            subprocess.run(f"adb shell input text '{escaped}'", shell=True)
        time.sleep(delay)

    def press_key(self, key_name, delay=0.5):
        """Press a special key with ADB fallback."""
        key_map = {
            "enter": "KEYCODE_ENTER",
            "backspace": "KEYCODE_DEL",
            "escape": "KEYCODE_BACK",
            "tab": "KEYCODE_TAB"
        }
        try:
            self.run_tool("keyboard", {"udid": self.udid, "key": key_name})
        except Exception as e:
            adb_key = key_map.get(key_name.lower(), "KEYCODE_BACK") # Default to BACK/ESC
            print(f"[*] Native keypress failed. ADB Fallback: adb shell input keyevent {adb_key}")
            subprocess.run(f"adb shell input keyevent {adb_key}", shell=True)
        time.sleep(delay)

    def clear_text(self, length=30, delay=0.5):
        """Clear text field by typing backspaces."""
        print(f"[*] Clearing field ({length} backspaces)")
        for _ in range(length):
            self.press_key("backspace", delay=0.05)
        time.sleep(delay)

    def screenshot(self, filename, output_dir="/Users/suvo/.gemini/antigravity/brain/735eb64d-3d91-476e-a03b-9f3a706baeac"):
        """Capture screen using screenshot tool with ADB screencap fallback."""
        path = os.path.join(output_dir, f"{filename}.png")
        try:
            self.run_tool("screenshot", {"udid": self.udid, "out": path})
        except Exception as e:
            print(f"[*] Native screenshot failed. ADB Fallback: adb exec-out screencap -p > {path}")
            subprocess.run(f"adb exec-out screencap -p > {path}", shell=True)
        return path

    def launch_app(self, package_name="com.pragatibandhu.app", delay=2.0):
        """Launch the application."""
        print(f"[*] Launching app: {package_name}")
        try:
            self.run_tool("launch-app", {"udid": self.udid, "bundleId": package_name})
        except Exception as e:
            print(f"[*] Native launch failed. ADB Fallback: adb shell monkey -p {package_name} -c android.intent.category.LAUNCHER 1")
            subprocess.run(f"adb shell monkey -p {package_name} -c android.intent.category.LAUNCHER 1", shell=True)
        time.sleep(delay)

    def restart_app(self, package_name="com.pragatibandhu.app", delay=3.0):
        """Restart the application."""
        print(f"[*] Restarting app: {package_name}")
        try:
            self.run_tool("restart-app", {"udid": self.udid, "bundleId": package_name})
        except Exception as e:
            print(f"[*] Native restart failed. ADB Fallback: adb shell am force-stop {package_name}")
            subprocess.run(f"adb shell am force-stop {package_name}", shell=True)
            time.sleep(1)
            self.launch_app(package_name, delay)
        time.sleep(delay)
