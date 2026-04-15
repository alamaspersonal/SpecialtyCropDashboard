"""
Data formatting module for SpecialtyCropDashboard.
Transforms raw CSV data from USDA API into the UnifiedCropPrice schema.
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


def calculate_price_avg(df):
    """
    Calculate price_avg for a DataFrame.
    
    1. Calculate average for each price field (excluding nulls)
    2. Average only the field averages that have data
    
    Returns: int or None
    """
    field_avgs = []
    
    for field in ['low_price', 'high_price', 'mostly_low_price', 'mostly_high_price', 'wtd_avg_price']:
        if field in df.columns:
            non_null = df[field].dropna()
            if len(non_null) > 0:
                field_avgs.append(non_null.mean())
    
    if not field_avgs:
        return None
    
    # Average the field averages (divide by count of fields with data, not always 4)
    return round(sum(field_avgs) / len(field_avgs), 2)


# Columns consumed by the explicit field mappings below, plus internal/alias columns
# that should never be passed through to UnifiedCropPrice as raw values.
_CONSUMED_COLS = {
    # Mapped to report_date
    'report_date', 'report_end_date',
    # Mapped to market_type
    'market_type',
    # Mapped to category
    'category', 'community', 'grp', 'group',
    # Mapped to district
    'district',
    # Mapped to commodity
    'commodity',
    # Mapped to variety
    'variety', 'var',
    # Mapped to package
    'package', 'pkg', 'size',
    # Mapped to origin
    'origin', 'region',
    # Mapped directly
    'supply_tone_comments', 'demand_tone_comments', 'market_tone_comments',
    'offerings_comments', 'commodity_comments',
    # Mapped to reporter_comment
    'reporter_comment', 'rep_cmt',
    # Mapped to organic (normalized)
    'organic',
    # Explicit price fields (mapped + used in price_avg)
    'low_price', 'high_price', 'mostly_low_price', 'mostly_high_price', 'wtd_avg_price',
    # Additional explicit fields
    'market_location_name', 'item_size', 'slug_id', 'slug_name',
    # Internal / report metadata — not useful as row-level data
    '_section', 'report_title', 'published_date', 'report_begin_date',
}


def format_for_unified_crop_price(df):
    """
    Format DataFrame for UnifiedCropPrice table.

    Explicitly maps all known USDA fields. Any raw columns not in _CONSUMED_COLS
    are passed through as-is so new API fields are preserved automatically.
    """
    records = []

    for _, row in df.iterrows():
        market_type_val = row.get('market_type')

        # Retail reports use a single-dict API response where report_date reflects
        # only the latest publication date for all nested weekly sections. The correct
        # per-week date is in report_end_date. For terminal/shipping (list responses),
        # report_date is accurate per row so it stays primary.
        if market_type_val and 'retail' in str(market_type_val).lower():
            report_date = parse_date(row.get('report_end_date')) or parse_date(row.get('report_date'))
        else:
            report_date = parse_date(row.get('report_date')) or parse_date(row.get('report_end_date'))

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
        for field in ['low_price', 'high_price', 'mostly_low_price', 'mostly_high_price', 'wtd_avg_price']:
            val = clean_price(row.get(field))
            if val is not None:
                prices.append(val)
        price_avg = round(sum(prices) / len(prices), 2) if prices else None

        # For retail, origin is often stored in the 'region' column instead
        origin = row.get('origin')
        if not origin and market_type_val in ('Retail', 'Retail - Specialty Crops'):
            origin = row.get('region')

        # Map category from various possible columns
        category = get_field(row, 'category', 'community', 'grp', 'group')

        record = {
            'report_date': report_date.isoformat() if report_date else None,
            'market_type': to_title_case(market_type_val),
            'category': normalize_category(category),
            'district': to_title_case(row.get('district')),
            'commodity': to_title_case(commodity),
            'variety': to_title_case(variety),
            'package': to_title_case(package),
            'weight_lbs': None,
            'weight_kgs': None,
            'units': None,
            'supply_tone_comments': row.get('supply_tone_comments') if pd.notna(row.get('supply_tone_comments')) else None,
            'demand_tone_comments': row.get('demand_tone_comments') if pd.notna(row.get('demand_tone_comments')) else None,
            'market_tone_comments': row.get('market_tone_comments') if pd.notna(row.get('market_tone_comments')) else None,
            'origin': to_title_case(origin),
            'price_avg': price_avg,
            # Individual price fields
            'low_price': clean_price(row.get('low_price')),
            'high_price': clean_price(row.get('high_price')),
            'mostly_low_price': clean_price(row.get('mostly_low_price')),
            'mostly_high_price': clean_price(row.get('mostly_high_price')),
            'wtd_avg_price': clean_price(row.get('wtd_avg_price')),
            # Additional fields
            'market_location_name': row.get('market_location_name') if pd.notna(row.get('market_location_name')) else None,
            'item_size': row.get('item_size') if pd.notna(row.get('item_size')) else None,
            'slug_id': str(int(row.get('slug_id'))) if pd.notna(row.get('slug_id')) else None,
            'slug_name': row.get('slug_name') if pd.notna(row.get('slug_name')) else None,
            'offerings_comments': row.get('offerings_comments') if pd.notna(row.get('offerings_comments')) else None,
            'reporter_comment': get_field(row, 'reporter_comment', 'rep_cmt') if pd.notna(get_field(row, 'reporter_comment', 'rep_cmt')) else None,
            'commodity_comments': row.get('commodity_comments') if pd.notna(row.get('commodity_comments')) else None,
            'organic': normalize_organic(row.get('organic')),
        }

        # Pass through any remaining raw columns not already handled above
        for col in row.index:
            if col not in _CONSUMED_COLS and col not in record:
                val = row.get(col)
                record[col] = val if (pd.notna(val) and val != '' and val != 'N/A') else None

        records.append(record)

    return pd.DataFrame(records)


def load_and_format_all_data():
    """
    Load all CSV files from APP_CROP_DATA and format for UnifiedCropPrice.

    Returns:
        pd.DataFrame: unified_crop_price_df
    """
    csv_files = glob.glob(os.path.join(DATA_DIR, "*_recent.csv"))
    print(f"Found {len(csv_files)} CSV files in {DATA_DIR}")

    all_unified_records = []

    for csv_file in csv_files:
        print(f"Processing {os.path.basename(csv_file)}...")
        try:
            df = pd.read_csv(csv_file, low_memory=False)

            unified_df = format_for_unified_crop_price(df)
            all_unified_records.append(unified_df)

            print(f"  -> UnifiedCropPrice: {len(unified_df)} rows")

        except Exception as e:
            print(f"Error processing {csv_file}: {e}")
            continue

    combined_unified = pd.concat(all_unified_records, ignore_index=True) if all_unified_records else pd.DataFrame()

    print(f"\nTotal UnifiedCropPrice records: {len(combined_unified)}")

    return combined_unified


if __name__ == "__main__":
    # Test the formatting
    unified_df = load_and_format_all_data()
    print("\nUnifiedCropPrice columns:", list(unified_df.columns))

    if not unified_df.empty:
        print("\nSample UnifiedCropPrice data:")
        print(unified_df.head(3).to_string())
