"""
Data formatting module for SpecialtyCropDashboard.
Transforms raw CSV data from USDA API into CropPrice and UnifiedCropPrice schemas.
"""

import os
import glob
import pandas as pd
from datetime import datetime


# Path to the data directory (local to backend_update/)
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "APP_CROP_DATA"))


def clean_price(price_val):
    """Clean and convert price value to float."""
    if pd.isna(price_val) or price_val == "N/A" or price_val == "":
        return None
    try:
        return float(price_val)
    except (ValueError, TypeError):
        return None


def parse_date(date_str):
    """Parse date string from CSV (MM/DD/YYYY) to datetime."""
    if pd.isna(date_str) or date_str == "NA" or date_str == "":
        return None
    try:
        # Handle datetime strings with time component
        if " " in str(date_str):
            date_str = str(date_str).split(" ")[0]
        return datetime.strptime(str(date_str), "%m/%d/%Y")
    except (ValueError, TypeError):
        return None


def format_for_crop_price(df):
    """
    Format DataFrame for CropPrice table.
    
    Columns matching Supabase schema: report_date, market_type, market_location_name, 
             district, category, commodity, variety, package, organic,
             low_price, high_price, wtd_avg_price
    """
    records = []
    
    for _, row in df.iterrows():
        # Parse date - try multiple date columns
        report_date = parse_date(row.get('report_date'))
        if not report_date:
            report_date = parse_date(row.get('report_end_date'))
        
        # Normalize variety and package columns
        variety = row.get('variety') if 'variety' in row else row.get('var')
        package = row.get('package') if 'package' in row else row.get('pkg')
        if pd.isna(package) or package == "":
            package = row.get('size')
        
        record = {
            'report_date': report_date.isoformat() if report_date else None,
            'market_type': row.get('market_type'),
            'market_location_name': row.get('market_location_name'),
            'district': row.get('district') if pd.notna(row.get('district')) else None,
            'category': row.get('category') if pd.notna(row.get('category')) else None,
            'commodity': row.get('commodity'),
            'variety': variety if pd.notna(variety) and variety != "N/A" else None,
            'package': package if pd.notna(package) and package != "N/A" else None,
            'organic': row.get('organic') if pd.notna(row.get('organic')) else None,
            'low_price': clean_price(row.get('low_price')),
            'high_price': clean_price(row.get('high_price')),
            'wtd_avg_price': clean_price(row.get('wtd_avg_price')),  # For retail data
        }
        records.append(record)
    
    return pd.DataFrame(records)


def format_for_unified_crop_price(df):
    """
    Format DataFrame for UnifiedCropPrice table.
    
    Columns: report_date, market_type, district, commodity, variety, package,
             price_min, price_max, price_retail
    """
    records = []
    
    for _, row in df.iterrows():
        # Parse date - try multiple date columns
        report_date = parse_date(row.get('report_date'))
        if not report_date:
            report_date = parse_date(row.get('report_end_date'))
        
        # Skip rows without valid dates
        if not report_date:
            continue
        
        # Normalize variety and package columns
        variety = row.get('variety') if 'variety' in row else row.get('var')
        package = row.get('package') if 'package' in row else row.get('pkg')
        
        record = {
            'report_date': report_date.isoformat() if report_date else None,
            'market_type': row.get('market_type'),
            'district': row.get('district') if pd.notna(row.get('district')) and row.get('district') != "N/A" else None,
            'commodity': row.get('commodity'),
            'variety': variety if pd.notna(variety) and variety != "N/A" else None,
            'package': package if pd.notna(package) and package != "N/A" else None,
            'price_min': clean_price(row.get('low_price')),
            'price_max': clean_price(row.get('high_price')),
            'price_retail': clean_price(row.get('wtd_avg_price')),
        }
        records.append(record)
    
    return pd.DataFrame(records)


def load_and_format_all_data():
    """
    Load all CSV files from APP_CROP_DATA and format for both tables.
    
    Returns:
        tuple: (crop_price_df, unified_crop_price_df)
    """
    csv_files = glob.glob(os.path.join(DATA_DIR, "*_recent.csv"))
    print(f"Found {len(csv_files)} CSV files in {DATA_DIR}")
    
    all_crop_price_records = []
    all_unified_records = []
    
    for csv_file in csv_files:
        print(f"Processing {os.path.basename(csv_file)}...")
        try:
            df = pd.read_csv(csv_file, low_memory=False)
            
            # Format for CropPrice
            crop_price_df = format_for_crop_price(df)
            all_crop_price_records.append(crop_price_df)
            
            # Format for UnifiedCropPrice
            unified_df = format_for_unified_crop_price(df)
            all_unified_records.append(unified_df)
            
            print(f"  -> CropPrice: {len(crop_price_df)} rows, UnifiedCropPrice: {len(unified_df)} rows")
            
        except Exception as e:
            print(f"Error processing {csv_file}: {e}")
            continue
    
    # Combine all DataFrames
    combined_crop_price = pd.concat(all_crop_price_records, ignore_index=True) if all_crop_price_records else pd.DataFrame()
    combined_unified = pd.concat(all_unified_records, ignore_index=True) if all_unified_records else pd.DataFrame()
    
    print(f"\nTotal CropPrice records: {len(combined_crop_price)}")
    print(f"Total UnifiedCropPrice records: {len(combined_unified)}")
    
    return combined_crop_price, combined_unified


if __name__ == "__main__":
    # Test the formatting
    crop_price_df, unified_df = load_and_format_all_data()
    print("\nCropPrice columns:", list(crop_price_df.columns))
    print("UnifiedCropPrice columns:", list(unified_df.columns))
