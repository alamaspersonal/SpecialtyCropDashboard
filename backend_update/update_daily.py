#!/usr/bin/env python3
"""
Daily Update Pipeline for SpecialtyCropDashboard.

This script orchestrates the daily data update process:
1. Fetches recent data from USDA API
2. Formats data to match CropPrice and UnifiedCropPrice schemas
3. Uploads data to Supabase (overwriting existing data)

Usage:
    python update_daily.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Import local modules
from get_recent_data import fetch_recent_data, REQUIRED_SLUG_IDS
from format_data import load_and_format_all_data
from overwrite_supabse import overwrite_supabase_data


def main():
    """Main pipeline execution."""
    print("=" * 60)
    print("SpecialtyCropDashboard - Daily Update Pipeline")
    print("=" * 60)
    
    # Step 1: Fetch recent data from USDA API
    print("\n[Step 1/3] Fetching recent data from USDA API...")
    print("-" * 40)
    
    try:
        reports = fetch_recent_data(REQUIRED_SLUG_IDS)
        if not reports:
            print("✘ No data fetched from API. Aborting.")
            return False
        print(f"✔ Fetched data for {len(reports)} slug IDs")
    except Exception as e:
        print(f"✘ Error fetching data: {e}")
        return False
    
    # Step 2: Format data for database tables
    print("\n[Step 2/3] Formatting data for database tables...")
    print("-" * 40)
    
    try:
        crop_price_df, unified_crop_price_df = load_and_format_all_data()
        
        if crop_price_df.empty and unified_crop_price_df.empty:
            print("✘ No data formatted. Aborting upload.")
            return False
        
        print(f"✔ Formatted {len(crop_price_df)} CropPrice records")
        print(f"✔ Formatted {len(unified_crop_price_df)} UnifiedCropPrice records")
        
    except Exception as e:
        print(f"✘ Error formatting data: {e}")
        return False
    
    # Step 3: Upload to Supabase
    print("\n[Step 3/3] Uploading to Supabase...")
    print("-" * 40)
    
    success = overwrite_supabase_data(crop_price_df, unified_crop_price_df)
    
    if success:
        print("\n" + "=" * 60)
        print("✔ Daily update completed successfully!")
        print("=" * 60)
        return True
    else:
        print("\n" + "=" * 60)
        print("✘ Daily update failed during Supabase upload")
        print("=" * 60)
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
