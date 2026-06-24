"""
Add missing packages to package_units.json with best-guess weights.
Uses pattern matching on package names to estimate weights.
"""
import json
import re

# Load missing packages
with open("missing_packages.json", "r") as f:
    missing = json.load(f)

# Load existing package_units
with open("package_units.json", "r") as f:
    package_units = json.load(f)

def guess_weight(package_str):
    """
    Estimate weight in lbs from package string.
    Returns (weight_lbs, weight_kg, units) tuple.
    - If weight-based: returns (lbs, kg, None)
    - If unit-based: returns (None, None, units)
    """
    pkg = package_str.lower()
    
    # Pattern 1: Explicit weight like "30 lb cartons", "10 kg mesh sacks"
    lb_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound)', pkg)
    if lb_match:
        lbs = float(lb_match.group(1))
        return (lbs, round(lbs * 0.453592, 1), None)
    
    kg_match = re.search(r'(\d+(?:\.\d+)?)\s*kg', pkg)
    if kg_match:
        kg = float(kg_match.group(1))
        return (round(kg * 2.20462, 1), kg, None)
    
    # Pattern 2: Unit packs like "12 1-pint baskets", "30 6-oz film bags"
    unit_match = re.search(r'(\d+)\s+(?:\d+-(?:oz|pint|lb))', pkg)
    if unit_match:
        # Estimate based on units and size
        if '1-lb' in pkg:
            count = int(re.search(r'(\d+)\s+1-lb', pkg).group(1))
            return (count, round(count * 0.453592, 1), None)
        if '6-oz' in pkg:
            return (4.5, 2.0, None)  # 12 x 6oz = 72oz = 4.5 lbs
        if 'pint' in pkg:
            return (12, 5.4, None)  # Standard flat
    
    # Pattern 3: Bushel-based
    if '1 1/9 bushel' in pkg or '1-1/9 bushel' in pkg:
        # Standard 1 1/9 bushel varies by crop
        if 'pepper' in pkg or 'pea' in pkg:
            return (28, 12.7, None)
        if 'squash' in pkg or 'eggplant' in pkg:
            return (33, 15.0, None)
        return (30, 13.6, None)  # Default for 1 1/9 bushel
    
    if '4/7 bushel' in pkg:
        return (21, 9.5, None)
    
    if 'bushel' in pkg and 'cartons' in pkg:
        return (30, 13.6, None)
    
    # Pattern 4: Standard carton sizes by crop type
    if 'cartons bunched' in pkg:
        if any(herb in pkg for herb in ['basil', 'cilantro', 'parsley', 'mint', 'dill', 'thyme', 'rosemary', 'oregano', 'sage', 'chive', 'tarragon', 'chervil', 'marjoram', 'savory', 'sorrel', 'fenugreek', 'epasote']):
            return (5, 2.3, None)  # Herb bunches are light
        if 'greens' in pkg or 'chard' in pkg or 'kale' in pkg or 'collard' in pkg:
            return (25, 11.3, None)
        return (20, 9.1, None)  # Default bunched
    
    if 'cartons' in pkg or 'containers' in pkg:
        # General carton defaults
        if 'artichoke' in pkg:
            return (22, 10.0, None)
        if 'lettuce' in pkg:
            return (24, 10.9, None)
        if 'endive' in pkg or 'escarole' in pkg:
            return (18, 8.2, None)
        if 'mushroom' in pkg:
            return (10, 4.5, None)
        if 'radicchio' in pkg:
            return (12, 5.4, None)
        return (25, 11.3, None)  # Default carton
    
    if '1 lb film bag' in pkg:
        return (1, 0.45, None)
    
    if 'film bags' in pkg or 'mesh sacks' in pkg:
        return (25, 11.3, None)
    
    if 'flats' in pkg:
        return (12, 5.4, None)
    
    if 'lugs' in pkg or 'lug' in pkg:
        return (25, 11.3, None)
    
    if 'crates' in pkg:
        return (35, 15.9, None)
    
    if 'reusable plastic containers' in pkg or 'rpc' in pkg:
        return (30, 13.6, None)
    
    # Default fallback
    return (25, 11.3, None)


# Generate new entries
new_entries = []
for item in missing:
    commodity = item["commodity"]
    package = item["package"]
    
    weight_lbs, weight_kg, units = guess_weight(package)
    
    entry = {
        "crop": commodity,
        "package_size": package,
        "weight_lbs": weight_lbs,
        "weight_kg": weight_kg,
        "units": units,
        "source": "Auto-generated estimate"
    }
    new_entries.append(entry)

# Add units field to existing entries if not present
for entry in package_units:
    if "units" not in entry:
        entry["units"] = None

# Combine and sort
combined = package_units + new_entries
combined.sort(key=lambda x: (x["crop"], x["package_size"]))

# Save updated file
with open("package_units.json", "w") as f:
    json.dump(combined, f, indent=2)

print(f"Added {len(new_entries)} new package entries")
print(f"Total entries now: {len(combined)}")

# Show a sample of new entries
print("\nSample new entries:")
for entry in new_entries[:10]:
    print(f"  {entry['crop']}: {entry['package_size']} -> {entry['weight_lbs']} lbs")
