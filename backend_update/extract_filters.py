
import json
import sys
import os

# Add parent directory to path to import format_data
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_update.format_data import load_and_format_all_data

OUTPUT_FILE = "phone_frontend/src/constants/staticFilters.js"

def extract_and_save():
    print("Loading data...")
    crop_price_df, _ = load_and_format_all_data()
    
    if crop_price_df.empty:
        print("Error: No data found!")
        sys.exit(1)
        
    print(f"Data loaded: {len(crop_price_df)} records")
    
    filters = {
        "categories": sorted(crop_price_df['category'].dropna().unique().tolist()),
        "commodities": sorted(crop_price_df['commodity'].dropna().unique().tolist()),
        "varieties": sorted(crop_price_df['variety'].dropna().unique().tolist()),
        "packages": sorted(crop_price_df['package'].dropna().unique().tolist()),
        "districts": sorted(crop_price_df['district'].dropna().unique().tolist()),
        "organics": sorted(crop_price_df['organic'].dropna().unique().tolist()),
    }
    
    print("\nExtracted Filters:")
    for k, v in filters.items():
        print(f"  - {k}: {len(v)} options")
        
    # Format as JS file
    js_content = f"""/**
 * Static filter options generated from database.
 * Generated on: {os.popen('date').read().strip()}
 */

export const STATIC_FILTERS = {json.dumps(filters, indent=4)};
"""
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        f.write(js_content)
        
    print(f"\nSuccessfully wrote filters to {OUTPUT_FILE}")

if __name__ == "__main__":
    extract_and_save()
