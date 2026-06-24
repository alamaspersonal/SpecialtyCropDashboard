"""
Script to find all unique package types in Supabase that are not in package_units.json
"""
import json
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase connection
url = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
key = os.getenv("EXPO_PUBLIC_SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Load existing package_units.json
with open("package_units.json", "r") as f:
    package_units = json.load(f)

# Create a set of existing (crop, package) combinations
existing_combos = set()
for entry in package_units:
    existing_combos.add((entry["crop"].lower(), entry["package_size"].lower()))

# Query all unique commodity + package combinations from UnifiedCropPrice
print("Fetching unique packages from UnifiedCropPrice...")
response = supabase.table("UnifiedCropPrice").select("commodity, package").limit(10000).execute()

# Extract unique combinations
db_combos = set()
for row in response.data:
    commodity = row.get("commodity")
    package = row.get("package")
    if commodity and package:
        db_combos.add((commodity, package))

print(f"Found {len(db_combos)} unique commodity+package combinations in database")
print(f"Existing in package_units.json: {len(existing_combos)}")

# Find missing packages
missing = []
for commodity, package in sorted(db_combos):
    # Check if any existing entry matches (fuzzy)
    found = False
    for existing_crop, existing_pkg in existing_combos:
        if existing_crop in commodity.lower() or commodity.lower() in existing_crop:
            if existing_pkg in package.lower() or package.lower() in existing_pkg:
                found = True
                break
    
    if not found:
        missing.append({"commodity": commodity, "package": package})

print(f"\nMissing packages: {len(missing)}")
print("\n--- Missing Packages ---")
for m in missing:
    print(f"  {m['commodity']}: {m['package']}")

# Save to file for review
with open("missing_packages.json", "w") as f:
    json.dump(missing, f, indent=2)

print("\nSaved to missing_packages.json")
