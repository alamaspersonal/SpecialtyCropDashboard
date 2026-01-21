
from backend_update.format_data import load_and_format_all_data
import pandas as pd
import sys

def verify():
    print("Loading and formatting data...")
    crop_price_df, _ = load_and_format_all_data()
    
    unique_cats = sorted(crop_price_df['category'].dropna().unique().tolist())
    print("\nUnique Categories in Formatted Data:")
    for c in unique_cats:
        print(f"- '{c}'")
        
    expected_cats = {"Vegetables", "Fruits", "Potatoes & Onions", "Nuts", "Other"}
    found_cats = set(unique_cats)
    
    unexpected = found_cats - expected_cats
    if unexpected:
        print(f"\n❌ Unexpected categories found: {unexpected}")
        sys.exit(1)
    
    print("\n✅ All categories are valid.")

if __name__ == "__main__":
    verify()
