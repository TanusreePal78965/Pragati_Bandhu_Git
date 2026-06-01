import xml.etree.ElementTree as ET
import sys
import re

def parse_bounds(bounds_str):
    # Format: [left,top][right,bottom]
    match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds_str)
    if match:
        left, top, right, bottom = map(int, match.groups())
        # Return center coordinates
        return (left + right) // 2, (top + bottom) // 2
    return None

def traverse(node, depth=0):
    text = node.get('text', '')
    content_desc = node.get('content-desc', '')
    bounds = node.get('bounds', '')
    clickable = node.get('clickable', '')
    resource_id = node.get('resource-id', '')
    class_name = node.get('class', '')
    
    center = parse_bounds(bounds) if bounds else None
    
    desc = text or content_desc
    if desc or clickable == 'true' or resource_id:
        clickable_str = "[CLICKABLE]" if clickable == 'true' else ""
        print(f"{'  ' * depth}- {desc} {clickable_str} bounds={bounds} center={center} id={resource_id} class={class_name.split('.')[-1]}")
        
    for child in node:
        traverse(child, depth + 1)

if __name__ == '__main__':
    xml_path = sys.argv[1] if len(sys.argv) > 1 else 'window_dump.xml'
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        traverse(root)
    except Exception as e:
        print(f"Error parsing XML: {e}")
