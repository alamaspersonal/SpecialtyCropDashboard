"""
Generate package_guess.json with weight estimates for missing packages.
Extracts weights from package names and uses USDA standard weights for common package types.
"""
import json
import re

# Load missing packages
with open("missing_packages.json", "r") as f:
    missing = json.load(f)

# USDA standard weights for common package types (from USDA Handbook 697)
STANDARD_WEIGHTS = {
    # Bushel conversions
    "1 1/9 bushel": {
        "default": 30,
        "peppers": 28,
        "peas": 28,
        "squash": 35,
        "eggplant": 33
    },
    "4/7 bushel": 21,
    "bushel": 30,
    
    # Herb cartons (bunched)
    "cartons bunched": {
        "herbs": 5,  # Light herbs
        "greens": 25,  # Leafy greens like kale, collard
        "default": 12
    },
    
    # Standard cartons
    "cartons": 25,
    "cartons film lined": 24,  # Lettuce typically 24 lbs
    
    # Other containers
    "lugs": 25,
    "crates": 35,
    "containers": 25,
    "reusable plastic containers (RPC)": 30,
    
    # Film bags
    "film bags bunched": 5, 
}

# Herbs and leafy greens lists
HERBS = ["basil", "bay leaves", "chervil", "chives", "cilantro", "dill", "epasote", "epazote", 
         "fenugreek", "marjoram", "mint", "oregano", "parsley", "rosemary", "sage", 
         "savory", "sorrel", "tarragon", "thyme", "watercress", "verdolaga"]
         
LEAFY_GREENS = ["greens", "collard", "dandelion", "kale", "mustard", "swiss chard"]


def extract_weight_from_name(pkg_name):
    """Extract explicit weight from package name."""
    pkg = pkg_name.lower()
    
    # Pattern: "XX lb" or "XX lbs"
    lb_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:lb|lbs)', pkg)
    if lb_match:
        return float(lb_match.group(1)), round(float(lb_match.group(1)) * 0.453592, 1), None
    
    # Pattern: "XX kg"
    kg_match = re.search(r'(\d+(?:\.\d+)?)\s*kg', pkg)
    if kg_match:
        kg = float(kg_match.group(1))
        return round(kg * 2.20462, 1), kg, None
    
    # Pattern: "cartons XX 1-lb film bags" -> XX lbs
    unit_lb_match = re.search(r'(\d+)\s+1-lb', pkg)
    if unit_lb_match:
        return int(unit_lb_match.group(1)), round(int(unit_lb_match.group(1)) * 0.453592, 1), None
    
    # Pattern: "XX X-lb film bags" (e.g., "10 5-lb film bags" = 50 lbs)
    multi_lb_match = re.search(r'(\d+)\s+(\d+)-lb', pkg)
    if multi_lb_match:
        count = int(multi_lb_match.group(1))
        unit_wt = int(multi_lb_match.group(2))
        total = count * unit_wt
        return total, round(total * 0.453592, 1), None
    
    # Pattern: "XX X-oz" containers (convert to lbs)
    oz_match = re.search(r'(\d+)\s+(\d+(?:\.\d+)?)-oz', pkg)
    if oz_match:
        count = int(oz_match.group(1))
        oz = float(oz_match.group(2))
        lbs = (count * oz) / 16
        return round(lbs, 1), round(lbs * 0.453592, 1), None
    
    # Pattern: flats 12 1-pint baskets (1 pint ≈ 0.75-1 lb for produce)
    pint_match = re.search(r'(\d+)\s+(?:\d+/\d+-)?(pint|1-pint)', pkg)
    if pint_match:
        count = int(pint_match.group(1))
        lbs = count * 0.9  # Approx 0.9 lb per pint
        return round(lbs, 1), round(lbs * 0.453592, 1), None
    
    # Pattern: "flats 12 1/2-pint" (half pints)
    half_pint_match = re.search(r'(\d+)\s+1/2-pint', pkg)
    if half_pint_match:
        count = int(half_pint_match.group(1))
        lbs = count * 0.45
        return round(lbs, 1), round(lbs * 0.453592, 1), None
    
    return None, None, None


def guess_weight(commodity, pkg_name):
    """Guess weight based on commodity and package type."""
    pkg = pkg_name.lower()
    comm = commodity.lower()
    
    # First try to extract explicit weight from name
    lbs, kgs, units = extract_weight_from_name(pkg_name)
    if lbs is not None:
        return lbs, kgs, units, "Derived from package name"
    
    # Check for bushel-based packages
    if "1 1/9 bushel" in pkg or "1-1/9 bushel" in pkg:
        if "pepper" in comm:
            return 28, 12.7, None, "USDA Handbook 697 - 1 1/9 bushel peppers"
        if "pea" in comm:
            return 28, 12.7, None, "USDA Handbook 697 - 1 1/9 bushel peas"
        if "squash" in comm:
            return 35, 15.9, None, "USDA Handbook 697 - 1 1/9 bushel squash"
        if "eggplant" in comm:
            return 33, 15.0, None, "USDA Handbook 697 - 1 1/9 bushel eggplant"
        return 30, 13.6, None, "USDA Handbook 697 - 1 1/9 bushel default"
    
    if "4/7 bushel" in pkg:
        return 21, 9.5, None, "USDA Handbook 697 - 4/7 bushel"
    
    if "bushel" in pkg:
        return 30, 13.6, None, "USDA Handbook 697 - standard bushel"
    
    # Check for cartons bunched
    if "cartons bunched" in pkg or "crates bunched" in pkg:
        # Herbs are light
        if any(herb in comm for herb in HERBS):
            return 5, 2.3, None, "Herb bunched carton estimate"
        # Leafy greens are heavier
        if any(green in comm for green in LEAFY_GREENS):
            return 25, 11.3, None, "Leafy greens bunched carton - USDA standard"
        # Default bunched
        return 12, 5.4, None, "Bunched carton estimate"
    
    # Film bags bunched (herbs)
    if "film bags bunched" in pkg:
        return 5, 2.3, None, "Film bags bunched estimate"
    
    # 1 lb film bags
    if "1 lb film bags" in pkg:
        return 1, 0.45, None, "Single 1 lb film bag"
    
    # Generic cartons by commodity
    if "cartons film lined" in pkg:
        if "lettuce" in comm:
            return 24, 10.9, None, "USDA Handbook 697 - Lettuce cartons"
        return 24, 10.9, None, "Film-lined carton estimate"
    
    if "cartons" in pkg and not "bunched" in pkg:
        if "lettuce" in comm:
            return 24, 10.9, None, "USDA Handbook 697 - Lettuce cartons"
        if "endive" in comm or "escarole" in comm:
            return 18, 8.2, None, "Endive/Escarole carton estimate"
        if "mushroom" in comm:
            return 10, 4.5, None, "Mushroom carton estimate"
        if "artichoke" in comm:
            return 22, 10.0, None, "Artichoke carton - USDA standard"
        if "anise" in comm:
            return 20, 9.1, None, "Anise carton estimate"
        if "tomato" in comm:
            return 25, 11.3, None, "USDA Handbook 697 - Tomato cartons"
        return 25, 11.3, None, "Generic carton estimate"
    
    # Layer containers
    if "layer" in pkg:
        if "radicchio" in comm:
            return 12, 5.4, None, "Radicchio layer container estimate"
        if "tomato" in comm:
            return 20, 9.1, None, "Tomato flat layer estimate"
        return 15, 6.8, None, "Layer container estimate"
    
    # Flats
    if "flats" in pkg:
        return 12, 5.4, None, "Flat estimate"
    
    # Crates
    if "crate" in pkg:
        return 35, 15.9, None, "Crate estimate"
    
    # Containers (generic)
    if "container" in pkg:
        return 25, 11.3, None, "Generic container estimate"
    
    # Sacks
    if "sack" in pkg:
        return 50, 22.7, None, "Sack estimate"
    
    # RPC
    if "rpc" in pkg or "reusable plastic" in pkg:
        return 30, 13.6, None, "RPC estimate"
    
    # Lugs
    if "lug" in pkg:
        return 25, 11.3, None, "Lug estimate"
    
    # Default fallback
    return 25, 11.3, None, "Default estimate"


# Generate package guesses
package_guesses = []
for item in missing:
    commodity = item["commodity"]
    package = item["package"]
    
    weight_lbs, weight_kg, units, source = guess_weight(commodity, package)
    
    entry = {
        "crop": commodity,
        "package_size": package,
        "weight_lbs": weight_lbs,
        "weight_kg": weight_kg,
        "units": units,
        "source": source
    }
    package_guesses.append(entry)

# Save to package_guess.json
with open("package_guess.json", "w") as f:
    json.dump(package_guesses, f, indent=2)

print(f"Generated {len(package_guesses)} package weight guesses")
print(f"Saved to package_guess.json")

# Show summary of sources
sources = {}
for p in package_guesses:
    src = p["source"]
    sources[src] = sources.get(src, 0) + 1

print("\nWeight estimation sources:")
for src, count in sorted(sources.items(), key=lambda x: -x[1]):
    print(f"  {src}: {count}")
