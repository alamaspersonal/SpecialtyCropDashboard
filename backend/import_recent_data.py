import csv
import os
import glob
from database import SessionLocal, CropPrice, init_db, engine, Base
from datetime import datetime

# Path to the data directory (relative to backend/)
APP_CROP_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "SpecialtyCropPrices", "APP_CROP_DATA"))

def parse_date(date_str):
    """Parse date string from CSV (MM/DD/YYYY)."""
    if not date_str or date_str == "NA":
        return None
    try:
        return datetime.strptime(date_str, "%m/%d/%Y")
    except ValueError:
        return None

def parse_float(value):
    """Parse float value, handling NA and empty strings."""
    if not value or value == "NA" or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None

def import_data():
    print(f"Target Data Directory: {APP_CROP_DATA_DIR}")
    
    if not os.path.exists(APP_CROP_DATA_DIR):
        print("Error: Directory not found!")
        return

    # Reset Database
    print("Dropping and recreating tables...")
    Base.metadata.drop_all(bind=engine)
    init_db()

    csv_files = glob.glob(os.path.join(APP_CROP_DATA_DIR, "*_recent.csv"))
    if not csv_files:
        print("No *_recent.csv files found.")
        return

    print(f"Found {len(csv_files)} files to import.")

    db = SessionLocal()
    total_rows = 0

    for csv_path in csv_files:
        print(f"Processing {os.path.basename(csv_path)}...")
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch = []
            file_rows = 0
            
            for row in reader:
                crop = CropPrice(
                    report_date=parse_date(row.get('report_date')),
                    market_type=row.get('market_type'),
                    market_location_name=row.get('market_location_name'),
                    district=row.get('district'),
                    origin=row.get('origin'),
                    category=row.get('category'),
                    commodity=row.get('commodity'),
                    variety=row.get('variety'),
                    package=row.get('package'),
                    item_size=row.get('item_size'),
                    organic=row.get('organic'),
                    low_price=parse_float(row.get('low_price')),
                    high_price=parse_float(row.get('high_price')),
                    mostly_low_price=parse_float(row.get('mostly_low_price')),
                    mostly_high_price=parse_float(row.get('mostly_high_price')),
                    market_tone_comments=row.get('market_tone_comments'),
                )
                batch.append(crop)
                file_rows += 1
                total_rows += 1
                
                if len(batch) >= 1000:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []
            
            if batch:
                db.bulk_save_objects(batch)
                db.commit()
            
            print(f"  Imported {file_rows} rows.")

    db.close()
    print(f"\nSuccess! Total rows imported: {total_rows}")

if __name__ == "__main__":
    import_data()
