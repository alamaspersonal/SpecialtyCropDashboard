"""
Upload recent_slugs data to Supabase.

Reads all CSVs from SpecialtyCropPrices/recent_slugs/,
formats them using the same logic as format_data.py,
and overwrites the CropPrice and UnifiedCropPrice tables in Supabase.

Usage:
    python upload_recent_slugs.py
"""

import os
import sys
import glob
import pandas as pd

# Add this directory to path so we can import our modules
sys.path.insert(0, os.path.dirname(__file__))

from format_data import format_for_crop_price, format_for_unified_crop_price
from overwrite_supabse import overwrite_supabase_data

# Path to the recent_slugs directory in SpecialtyCropPrices
# SpecialtyCropPrices is a sibling project at ~/Programming/SpecialtyCropPrices
RECENT_SLUGS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "SpecialtyCropPrices", "recent_slugs")
)


def load_and_format_recent_slugs():
    """
    Load all CSV files from recent_slugs/ and format for both Supabase tables.
    
    Returns:
        tuple: (crop_price_df, unified_crop_price_df)
    """
    csv_files = sorted(glob.glob(os.path.join(RECENT_SLUGS_DIR, "slug_*.csv")))
    
    if not csv_files:
        print(f"ERROR: No CSV files found in {RECENT_SLUGS_DIR}")
        print("Run build_recent_slugs.py in SpecialtyCropPrices/ first.")
        return pd.DataFrame(), pd.DataFrame()
    
    print(f"Found {len(csv_files)} CSV files in {RECENT_SLUGS_DIR}")
    
    all_crop_price = []
    all_unified = []
    
    for csv_file in csv_files:
        slug_name = os.path.basename(csv_file)
        print(f"\nProcessing {slug_name}...")
        
        try:
            df = pd.read_csv(csv_file, low_memory=False)
            print(f"  Raw rows: {len(df)}")
            
            # Format for CropPrice table
            crop_price_df = format_for_crop_price(df)
            all_crop_price.append(crop_price_df)
            
            # Format for UnifiedCropPrice table
            unified_df = format_for_unified_crop_price(df)
            all_unified.append(unified_df)
            
            print(f"  -> CropPrice: {len(crop_price_df)} rows, UnifiedCropPrice: {len(unified_df)} rows")
            
        except Exception as e:
            print(f"  ERROR processing {slug_name}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    # Combine all DataFrames
    combined_crop_price = pd.concat(all_crop_price, ignore_index=True) if all_crop_price else pd.DataFrame()
    combined_unified = pd.concat(all_unified, ignore_index=True) if all_unified else pd.DataFrame()
    
    # Drop duplicates
    if not combined_crop_price.empty:
        before = len(combined_crop_price)
        combined_crop_price.drop_duplicates(inplace=True)
        dupes = before - len(combined_crop_price)
        if dupes > 0:
            print(f"\nRemoved {dupes} duplicate CropPrice rows")
    
    if not combined_unified.empty:
        before = len(combined_unified)
        combined_unified.drop_duplicates(inplace=True)
        dupes = before - len(combined_unified)
        if dupes > 0:
            print(f"Removed {dupes} duplicate UnifiedCropPrice rows")
    
    print(f"\n{'='*50}")
    print(f"Total CropPrice records: {len(combined_crop_price):,}")
    print(f"Total UnifiedCropPrice records: {len(combined_unified):,}")
    
    return combined_crop_price, combined_unified


def main():
    print("=" * 50)
    print("Upload Recent Slugs to Supabase")
    print("=" * 50)
    
    # Step 1: Load and format
    crop_price_df, unified_df = load_and_format_recent_slugs()
    
    if crop_price_df.empty and unified_df.empty:
        print("\nNo data to upload. Exiting.")
        return
    
    # Step 2: Upload to Supabase (clears and re-inserts)
    print(f"\n{'='*50}")
    print("Uploading to Supabase...")
    print(f"{'='*50}")
    
    success = overwrite_supabase_data(crop_price_df, unified_df)
    
    if success:
        print("\n✔ All done! Supabase tables updated with recent_slugs data.")
    else:
        print("\n✘ Upload failed. Check errors above.")


if __name__ == "__main__":
    main()
