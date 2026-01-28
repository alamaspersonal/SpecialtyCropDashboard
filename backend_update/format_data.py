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


def normalize_category(raw_cat):
    """
    Normalize category to one of: Vegetables, Fruits, Potatoes & Onions, Nuts, Other.
    """
    if pd.isna(raw_cat) or raw_cat == "":
        return "Other"
    
    cat_lower = str(raw_cat).lower().strip()
    
    # Check for keywords to map to standard categories
    if "veg" in cat_lower:
        return "Vegetables"
    if "fruit" in cat_lower:
        return "Fruits"
    if "nut" in cat_lower:
        return "Nuts"
    if "onion" in cat_lower or "potato" in cat_lower:
        return "Potatoes & Onions"
    
    # Default catch-all
    return "Other"


def normalize_organic(value):
    """Normalize organic field to 'yes' or 'no'."""
    if pd.isna(value) or value == "" or value == "N/A":
        return "no"
    val_lower = str(value).lower().strip()
    if val_lower in ("y", "yes", "organic", "true", "1"):
        return "yes"
    return "no"


def to_title_case(value):
    """Convert value to title case (e.g., 'Ambrosia Apple', 'Central California')."""
    if pd.isna(value) or value == "" or value == "N/A":
        return None
    return str(value).strip().title()


def get_field(row, *field_names):
    """Get the first non-null value from a list of possible field names."""
    for field in field_names:
        val = row.get(field)
        if pd.notna(val) and val != "" and val != "N/A":
            return val
    return None


def format_for_crop_price(df):
    """
    Format DataFrame for CropPrice table.
    
    Columns: report_date, market_type, market_location_name, district, origin,
             category, commodity, variety, package, item_size, organic,
             low_price, high_price, mostly_low_price, mostly_high_price,
             market_tone_comments, wtd_avg_price, supply_tone_comments, demand_tone_comments
    """
    records = []
    
    for _, row in df.iterrows():
        # Parse date - try multiple date columns
        report_date = parse_date(row.get('report_date'))
        if not report_date:
            report_date = parse_date(row.get('report_end_date'))
        
        # Skip if commodity is missing (garbage row)
        commodity = row.get('commodity')
        if pd.isna(commodity) or commodity == "" or commodity == "N/A":
            continue

        # Map category from various possible columns
        category = get_field(row, 'category', 'community', 'grp', 'group')
        
        # Normalize variety and package columns
        variety = get_field(row, 'variety', 'var')
        package = get_field(row, 'package', 'pkg', 'size')
        
        # Handle origin logic: for retail, origin is often in 'region' column
        market_type_val = row.get('market_type')
        origin = row.get('origin')
        if not origin and market_type_val in ('Retail', 'Retail - Specialty Crops'):
            origin = row.get('region')

        record = {
            'report_date': report_date.isoformat() if report_date else None,
            'market_type': to_title_case(row.get('market_type')),
            'market_location_name': row.get('market_location_name'),
            'district': to_title_case(row.get('district')),
            'district': to_title_case(row.get('district')),
            'origin': to_title_case(origin),
            'category': normalize_category(category),
            'commodity': to_title_case(commodity),
            'variety': to_title_case(variety),
            'package': to_title_case(package),
            'item_size': row.get('item_size') if pd.notna(row.get('item_size')) else None,
            'organic': normalize_organic(row.get('organic')),
            'low_price': clean_price(row.get('low_price')),
            'high_price': clean_price(row.get('high_price')),
            'mostly_low_price': clean_price(row.get('mostly_low_price')),
            'mostly_high_price': clean_price(row.get('mostly_high_price')),
            'market_tone_comments': row.get('market_tone_comments') if pd.notna(row.get('market_tone_comments')) else None,
            'wtd_avg_price': clean_price(row.get('wtd_avg_price')),
            'supply_tone_comments': row.get('supply_tone_comments') if pd.notna(row.get('supply_tone_comments')) else None,
            'demand_tone_comments': row.get('demand_tone_comments') if pd.notna(row.get('demand_tone_comments')) else None,
        }
        records.append(record)
    
    return pd.DataFrame(records)


def calculate_price_avg(df):
    """
    Calculate price_avg for a DataFrame.
    
    1. Calculate average for each price field (excluding nulls)
    2. Average only the field averages that have data
    
    Returns: int or None
    """
    field_avgs = []
    
    for field in ['low_price', 'high_price', 'mostly_low_price', 'mostly_high_price']:
        if field in df.columns:
            non_null = df[field].dropna()
            if len(non_null) > 0:
                field_avgs.append(non_null.mean())
    
    if not field_avgs:
        return None
    
    # Average the field averages (divide by count of fields with data, not always 4)
    return int(sum(field_avgs) / len(field_avgs))


def format_for_unified_crop_price(df):
    """
    Format DataFrame for UnifiedCropPrice table.
    
    Columns: report_date, market_type, district, commodity, variety, package,
             weight_lbs, weight_kgs, units, supply_tone_comments, demand_tone_comments,
             market_tone_comments, origin, price_avg
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
        
        # Skip if commodity is missing
        commodity = row.get('commodity')
        if pd.isna(commodity) or commodity == "" or commodity == "N/A":
            continue
        
        # Normalize variety and package columns
        variety = get_field(row, 'variety', 'var')
        package = get_field(row, 'package', 'pkg', 'size')
        
        # Calculate price_avg for this single row
        prices = []
        for field in ['low_price', 'high_price', 'mostly_low_price', 'mostly_high_price']:
            val = clean_price(row.get(field))
            if val is not None:
                prices.append(val)
        price_avg = int(sum(prices) / len(prices)) if prices else None
        
        # Handle origin logic: for retail, origin is often in 'region' column
        market_type_val = row.get('market_type')
        origin = row.get('origin')
        if not origin and market_type_val in ('Retail', 'Retail - Specialty Crops'):
            origin = row.get('region')

        record = {
            'report_date': report_date.isoformat() if report_date else None,
            'market_type': to_title_case(market_type_val),
            'district': to_title_case(row.get('district')),
            'commodity': to_title_case(commodity),
            'variety': to_title_case(variety),
            'package': to_title_case(package),
            'weight_lbs': None,  # Not available in CSV
            'weight_kgs': None,  # Not available in CSV
            'units': None,       # Not available in CSV
            'supply_tone_comments': row.get('supply_tone_comments') if pd.notna(row.get('supply_tone_comments')) else None,
            'demand_tone_comments': row.get('demand_tone_comments') if pd.notna(row.get('demand_tone_comments')) else None,
            'market_tone_comments': row.get('market_tone_comments') if pd.notna(row.get('market_tone_comments')) else None,
            'origin': to_title_case(origin),
            'price_avg': price_avg,
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
    
    # Show sample data
    if not crop_price_df.empty:
        print("\nSample CropPrice data:")
        print(crop_price_df.head(3).to_string())
    
    if not unified_df.empty:
        print("\nSample UnifiedCropPrice data:")
        print(unified_df.head(3).to_string())
