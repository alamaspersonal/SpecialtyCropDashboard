import os
import glob
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from database import engine, SessionLocal, UnifiedCropPrice, Base

# Path to the data directory (relative to backend/)
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "APP_CROP_DATA"))

def clean_price(price_str):
    if pd.isna(price_str) or price_str == "N/A":   
        return None
    try:
        return float(price_str)
    except ValueError:
        return None

def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%m/%d/%Y")
    except (ValueError, TypeError):
        return None

def process_file(filepath, db: Session):
    print(f"Processing {filepath}...")
    try:
        df = pd.read_csv(filepath, low_memory=False)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return

    # Normalize Columns
    # Map disparate columns to a common schema
    # Terminal: report_date, market_type, commodity, variety, package, low_price, high_price, market_location_name, grade
    # Shipping: report_date, market_type, commodity, var, pkg, low_price, high_price, district, grade
    
    records = []
    
    for _, row in df.iterrows():
        # Determine Market Type
        m_type = row.get('market_type')
        
        # Normalize Fields based on type
        # Variety
        variety = row.get('variety') if 'variety' in row else row.get('var')
        
        # Package
        package = row.get('package') if 'package' in row else row.get('pkg')
        
        # Region
        # Terminal uses 'market_location_name' (e.g. LA Terminal)
        # Shipping uses 'district' (e.g. San Joaquin Valley)
        district = row.get('district')
        
        # Prices
        min_p = clean_price(row.get('low_price'))
        max_p = clean_price(row.get('high_price'))
        avg_p = clean_price(row.get('wtd_avg_price'))
        
        report_dt = parse_date(row.get('report_date') or row.get('report_end_date'))
        if not report_dt:
            continue

        record = UnifiedCropPrice(
            report_date=report_dt,
            market_type=m_type,
            commodity=row.get('commodity'),
            variety=variety if pd.notna(variety) and variety != "N/A" else None,
            package=package if pd.notna(package) and package != "N/A" else None,
            district=district if pd.notna(district) and district != "N/A" else None,
            price_min=min_p,
            price_max=max_p,
            price_retail=avg_p,
        )
        records.append(record)
        
    # Bulk Insert for speed
    if records:
        db.bulk_save_objects(records)
        db.commit()
        print(f"Inserted {len(records)} records from {os.path.basename(filepath)}")

def main():
    # Re-create tables to be safe (optional, but good for dev)
    # Base.metadata.drop_all(bind=Engine) 
    # Base.metadata.create_all(bind=Engine)
    # NOTE: Keeping existing data for now, but in a real "Phase 1" clean slate might be better.
    # Let's clear just the Unified table to avoid dupes on re-run
    db = SessionLocal()
    db.query(UnifiedCropPrice).delete()
    db.commit()
    print("Cleared UnifiedCropPrice table.")

    csv_files = glob.glob(os.path.join(DATA_DIR, "*.csv"))
    print(f"Found {len(csv_files)} files in {DATA_DIR}")
    for csv_file in csv_files:
        process_file(csv_file, db)
    
    db.close()
    print("Ingestion complete.")

if __name__ == "__main__":
    main()