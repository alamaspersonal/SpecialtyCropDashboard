import csv
import os
from database import SessionLocal, CropPrice, init_db, engine, Base
from datetime import datetime

# Drop and recreate tables to ensure schema is fresh
Base.metadata.drop_all(bind=engine)
init_db()

def parse_date(date_str):
    """Parse date string from CSV."""
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

def populate_from_csv(csv_path):
    """Populate database from a CSV file."""
    db = SessionLocal()
    
    print(f"Reading {csv_path}...")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        batch = []
        count = 0
        
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
            count += 1
            
            # Batch insert every 1000 rows
            if len(batch) >= 1000:
                db.bulk_save_objects(batch)
                db.commit()
                print(f"  Inserted {count} rows...")
                batch = []
        
        # Insert remaining
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
    
    print(f"Done! Inserted {count} total rows.")
    db.close()

def main():
    # Path to the CSV file (relative to backend directory)
    csv_path = os.path.join("..", "specialty_crop_data", "report_2306_2025-12-17.csv")
    
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        print("Make sure specialty_crop_data folder exists in the project root.")
        return
    
    populate_from_csv(csv_path)

if __name__ == "__main__":
    main()
