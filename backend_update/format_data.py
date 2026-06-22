"""
Data formatting module for SpecialtyCropDashboard.
Transforms raw CSV data from USDA API into the UnifiedCropPrice schema.
"""

import os
import glob
import re
import pandas as pd
from datetime import datetime


# Conversion constant
LB_PER_KG = 2.20462


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
    'commodity', 'crop',
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
    'low_price', 'high_price', 'mostly_low_price', 'mostly_high_price',
    'wtd_avg_price', 'wtd_Avg_Price',  # USDA alternates casing across sections
    'price_Range', 'price_range',       # retail range string, parsed into low/high
    # Additional explicit fields
    'market_location_name', 'item_size', 'slug_id', 'slug_name',
    # Internal / report metadata — not useful as row-level data
    '_section', 'report_title', 'published_date', 'published_Date',
    'report_begin_date', 'report_narrative', 'report_footer', 'report_footnotes',
    'special_notes', 'final_ind',
    # Location metadata (redundant with district/origin already mapped)
    'city', 'state', 'office_city', 'office_state', 'office_name',
    'market_location_city', 'market_location_state', 'reporting_city',
    # Product quality / condition fields not in the schema
    'appear', 'appearance', 'cond', 'condition', 'quality', 'grade',
    'storage', 'repack', 'season', 'properties', 'environment', 'env',
    'basis_of_sale', 'transportation_mode', 'import_export_flag',
    # Retail-specific weekly stats not in the schema
    'store_count', 'stores_with_Ads', '%_Marked_Local',
    'prior_WK_store_count', 'prior_WK_wtd_avg_price',
    'prior_YR_store_count', 'prior_YR_wtd_avg_price',
    'unit_sales',
    # Size comment variant (item_size is already mapped)
    'item_Size_Comment',
}


def _parse_mixed_number(s):
    """
    Parse a USDA numeric token that may contain whole + fractional parts.

    Handles: '5', '19.8', '1/2', '1 1/9', '2-1/2', '3 1/2'.
    The dash form ('2-1/2') and space form ('3 1/2') both mean whole + fraction.
    """
    s = s.strip().replace('-', ' ')
    total = 0.0
    for tok in s.split():
        if '/' in tok:
            num, den = tok.split('/')
            total += float(num) / float(den)
        else:
            total += float(tok)
    return total


def parse_package_measures(package):
    """
    Derive (weight_lbs, weight_kgs, units) from a USDA package description.

    weight_lbs / weight_kgs are the TOTAL net product weight of the package
    (kg is derived from lbs and vice-versa so both columns are populated whenever
    either is known). `units` is the count of individual sellable sub-units in the
    package (e.g. the 12 in 'flats 12 1-pint baskets'). Any value that cannot be
    derived from the string is returned as None.

    Patterns covered, in priority order:
      1. Combined kg + lb        -> '5 kg/11 lb cartons', '9 kg (19.8 lb) containers'
      2. Count x per-unit measure-> 'cartons 12 1-lb film bags', 'flats 12 5-oz cups',
                                     'cartons 4 2-1/2 lb film bags', 'flats 12 1-pint baskets'
      3. Leading kilograms       -> '10 kg containers', '3.5 kg containers'
      4. Leading pounds (+range) -> '25 lb sacks', '30-35 lb cartons'
      5. Leading count/volume    -> bare 'N pint'/'N count'

    Bushels and bare containers ('cartons', 'bins', 'lugs', '1 layer') yield no
    weight because the figure depends on the commodity, so they stay None.
    """
    if package is None or (isinstance(package, float) and pd.isna(package)) or str(package).strip() == "":
        return None, None, None

    s = str(package).lower().strip()

    # 1. Combined "X kg/Y lb" or "X kg (Y lb)" — both figures are stated explicitly.
    m = re.search(r'(\d+(?:\.\d+)?)\s*kg\s*[/(]\s*(\d+(?:\.\d+)?)\s*lb', s)
    if m:
        kg, lbs = float(m.group(1)), float(m.group(2))
        return round(lbs, 2), round(kg, 2), None

    # 2. Count x per-unit measure, e.g. "12 1-lb", "4 2-1/2 lb", "12 18-oz", "12 1-pint".
    m = re.search(r'(\d+)\s+([\d./\s-]*?\d)\s*-?\s*(lbs?|oz|pints?|pt|cups?|count|ct)\b', s)
    if m:
        count = int(m.group(1))
        each = _parse_mixed_number(m.group(2))
        unit = m.group(3)
        if unit.startswith('lb'):
            lbs = count * each
            return round(lbs, 2), round(lbs / LB_PER_KG, 2), count
        if unit == 'oz':
            lbs = count * each / 16.0
            return round(lbs, 2), round(lbs / LB_PER_KG, 2), count
        if unit in ('count', 'ct'):
            # "12 3-count packages" -> 36 individual items
            return None, None, int(count * each) if each else count
        # pint / pt / cup -> volume measure, weight depends on commodity
        return None, None, count

    # 3. Leading kilograms, e.g. "10 kg containers".
    m = re.search(r'(?<![\d.])(\d+(?:\.\d+)?)\s*kg\b', s)
    if m:
        kg = float(m.group(1))
        return round(kg * LB_PER_KG, 2), round(kg, 2), None

    # 4. Leading pounds, optionally a range "30-35 lb" (use the midpoint).
    m = re.search(r'(?<![\d.])(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*lbs?\b', s)
    if m:
        lo = float(m.group(1))
        hi = float(m.group(2)) if m.group(2) else lo
        lbs = (lo + hi) / 2.0
        return round(lbs, 2), round(lbs / LB_PER_KG, 2), None

    # 5. Bare count / volume with no weight, e.g. "1 pint containers".
    m = re.search(r'(?<![\d.])(\d+)\s*(pints?|pt|count|ct|cups?)\b', s)
    if m:
        return None, None, int(m.group(1))

    return None, None, None


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

        # Derive net weight and unit count from the package description
        weight_lbs, weight_kgs, units = parse_package_measures(package)

        # Calculate price_avg for this single row.
        # USDA alternates between wtd_avg_price and wtd_Avg_Price across report sections.
        prices = []
        for field in ['low_price', 'high_price', 'mostly_low_price', 'mostly_high_price',
                      'wtd_avg_price', 'wtd_Avg_Price']:
            val = clean_price(row.get(field))
            if val is not None:
                prices.append(val)

        # Retail reports store a price range string (e.g. '2.99-3.49' or '2.49').
        # Parse it to extract low/high and include in the average.
        price_range_str = row.get('price_Range') or row.get('price_range')
        parsed_low, parsed_high = None, None
        if price_range_str and pd.notna(price_range_str):
            parts = str(price_range_str).strip().split('-')
            parsed_low = clean_price(parts[0])
            parsed_high = clean_price(parts[-1]) if len(parts) > 1 else parsed_low
            if parsed_low is not None:
                prices.append(parsed_low)
            if parsed_high is not None and parsed_high != parsed_low:
                prices.append(parsed_high)

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
            'weight_lbs': weight_lbs,
            'weight_kgs': weight_kgs,
            'units': units,
            'supply_tone_comments': row.get('supply_tone_comments') if pd.notna(row.get('supply_tone_comments')) else None,
            'demand_tone_comments': row.get('demand_tone_comments') if pd.notna(row.get('demand_tone_comments')) else None,
            'market_tone_comments': row.get('market_tone_comments') if pd.notna(row.get('market_tone_comments')) else None,
            'origin': to_title_case(origin),
            'price_avg': price_avg,
            # Individual price fields — fall back to parsed price_Range for retail rows
            'low_price': clean_price(row.get('low_price')) or parsed_low,
            'high_price': clean_price(row.get('high_price')) or parsed_high,
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

    non_empty = [df for df in all_unified_records if not df.empty]
    combined_unified = pd.concat(non_empty, ignore_index=True) if non_empty else pd.DataFrame()

    print(f"\nTotal UnifiedCropPrice records: {len(combined_unified)}")

    return combined_unified


if __name__ == "__main__":
    # Test the formatting
    unified_df = load_and_format_all_data()
    print("\nUnifiedCropPrice columns:", list(unified_df.columns))

    if not unified_df.empty:
        print("\nSample UnifiedCropPrice data:")
        print(unified_df.head(3).to_string())
