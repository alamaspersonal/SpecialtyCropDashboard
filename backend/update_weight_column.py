"""
Update the weight_lbs, weight_kgs, and units columns in Supabase UnifiedCropPrice table
based on package_units.json mappings.
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

# Load package_units.json
with open("package_units.json", "r") as f:
    package_units = json.load(f)

# Create lookup dictionary: (commodity.lower(), package.lower()) -> (weight_lbs, weight_kg, units)
lookup = {}
for entry in package_units:
    crop = entry["crop"].lower()
    pkg = entry["package_size"].lower()
    lookup[(crop, pkg)] = (
        entry.get("weight_lbs"),
        entry.get("weight_kg"),
        entry.get("units")
    )

print(f"Loaded {len(lookup)} package weight mappings")

# Fetch all UnifiedCropPrice rows
print("\nFetching UnifiedCropPrice rows...")
response = supabase.table("UnifiedCropPrice").select("id, commodity, package").limit(50000).execute()

print(f"Found {len(response.data)} rows to process")

# Match and prepare updates
updates = []
unmatched = []

for row in response.data:
    row_id = row["id"]
    commodity = (row.get("commodity") or "").lower()
    package = (row.get("package") or "").lower()
    
    # Try exact match first
    key = (commodity, package)
    if key in lookup:
        weight_lbs, weight_kg, units = lookup[key]
        updates.append({
            "id": row_id,
            "weight_lbs": weight_lbs,
            "weight_kgs": weight_kg,
            "units": units
        })
    else:
        # Try fuzzy match - check if commodity contains or is contained in crop name
        matched = False
        for (crop, pkg), (w_lbs, w_kg, u) in lookup.items():
            # Check commodity match (partial)
            commodity_match = crop in commodity or commodity in crop
            # Check package match (exact or partial)
            package_match = pkg == package or pkg in package or package in pkg
            
            if commodity_match and package_match:
                updates.append({
                    "id": row_id,
                    "weight_lbs": w_lbs,
                    "weight_kgs": w_kg,
                    "units": u
                })
                matched = True
                break
        
        if not matched:
            unmatched.append({"commodity": row.get("commodity"), "package": row.get("package")})

print(f"\nMatched: {len(updates)} rows")
print(f"Unmatched: {len(unmatched)} rows")

# Update in batches
BATCH_SIZE = 100
updated_count = 0

print(f"\nUpdating Supabase in batches of {BATCH_SIZE}...")
for i in range(0, len(updates), BATCH_SIZE):
    batch = updates[i:i+BATCH_SIZE]
    
    for update in batch:
        row_id = update.pop("id")
        try:
            supabase.table("UnifiedCropPrice").update(update).eq("id", row_id).execute()
            updated_count += 1
        except Exception as e:
            print(f"  Error updating row {row_id}: {e}")
    
    print(f"  Updated {min(i + BATCH_SIZE, len(updates))}/{len(updates)} rows")

print(f"\n✔ Successfully updated {updated_count} rows in UnifiedCropPrice")

# Show unmatched for reference
if unmatched:
    print(f"\nUnmatched combinations (first 10):")
    unique_unmatched = list({(u["commodity"], u["package"]) for u in unmatched})[:10]
    for comm, pkg in unique_unmatched:
        print(f"  {comm}: {pkg}")
