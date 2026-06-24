"""
Debug script to trace date parsing in the CSV files
"""
import pandas as pd
import os
import glob
from datetime import datetime

DATA_DIR = "/Users/anthonylamas/Programming/SpecialtyCropDashboard/APP_CROP_DATA"

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

# Check one file
csv_files = glob.glob(os.path.join(DATA_DIR, "*_recent.csv"))
print(f"Found {len(csv_files)} CSV files")

for csv_file in csv_files[:2]:  # Just check first 2 files
    print(f"\n=== {os.path.basename(csv_file)} ===")
    df = pd.read_csv(csv_file, low_memory=False)
    print(f"Total rows: {len(df)}")
    
    # Check unique report_date values
    dates = df['report_date'].dropna().unique()
    print(f"Unique report_date values: {len(dates)}")
    for d in sorted(dates)[:10]:
        parsed = parse_date(d)
        print(f"  '{d}' -> {parsed}")
    
    # Count how many rows have valid dates after Jan 1 2026
    valid_2026_count = 0
    for _, row in df.iterrows():
        parsed = parse_date(row.get('report_date'))
        if parsed and parsed.year == 2026:
            valid_2026_count += 1
    print(f"Rows with 2026 dates: {valid_2026_count}")
