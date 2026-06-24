"""
Debug script to trace retail data through the pipeline:
1. Check market_type values in CSV files
2. Check market_type values in Supabase
3. Identify why retail data might not be showing
"""
import os
import glob
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- Step 1: Check CSV files for retail/market_type data ---
print("=" * 60)
print("STEP 1: Checking CSV files for market_type values")
print("=" * 60)

DATA_DIR = "/Users/anthonylamas/Programming/SpecialtyCropDashboard/backend_update/APP_CROP_DATA"
csv_files = glob.glob(os.path.join(DATA_DIR, "*_recent.csv"))

all_market_types = set()
for csv_file in csv_files:
    df = pd.read_csv(csv_file, low_memory=False)
    if 'market_type' in df.columns:
        types = df['market_type'].dropna().unique()
        for t in types:
            all_market_types.add(t)

print(f"Unique market_type values in CSV files:")
for mt in sorted(all_market_types):
    print(f"  - '{mt}'")

# Check if any contain "Retail"
retail_types = [mt for mt in all_market_types if 'retail' in mt.lower()]
print(f"\nRetail-related market_types: {retail_types}")

# --- Step 2: Check Supabase CropPrice table ---
print("\n" + "=" * 60)
print("STEP 2: Checking Supabase CropPrice for market_type values")
print("=" * 60)

url = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
key = os.getenv("EXPO_PUBLIC_SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Get unique market_type values from CropPrice
response = supabase.table("CropPrice").select("market_type").limit(10000).execute()
db_market_types = set()
for row in response.data:
    mt = row.get('market_type')
    if mt:
        db_market_types.add(mt)

print(f"Unique market_type values in CropPrice table:")
for mt in sorted(db_market_types):
    print(f"  - '{mt}'")

# Check retail rows specifically
response2 = supabase.table("CropPrice").select("*", count="exact").ilike("market_type", "%retail%").execute()
print(f"\nRows with 'Retail' in market_type: {response2.count}")

if response2.count > 0:
    print("Sample retail rows:")
    for row in response2.data[:3]:
        print(f"  market_type: {row.get('market_type')}, commodity: {row.get('commodity')}, low_price: {row.get('low_price')}")

# --- Step 3: Check what the frontend expects ---
print("\n" + "=" * 60)
print("STEP 3: Check frontend filtering logic")
print("=" * 60)
print("""
Frontend filters retail data with:
  d.market_type === 'Retail' || d.market_type === 'Retail - Specialty Crops'
  
And calculates retail average with:
  getAvg(filteredRetail, selectedPackages.retail, 'wtd_avg_price')
  
Retail is marked estimated if: stats.retail_low_avg <= 0
""")

# Check if there's wtd_avg_price field
response3 = supabase.table("CropPrice").select("wtd_avg_price").limit(100).execute()
has_wtd_avg = any(row.get('wtd_avg_price') is not None for row in response3.data)
print(f"wtd_avg_price field has values: {has_wtd_avg}")

# Sample to see what fields retail rows have
if response2.count > 0:
    print("\nRetail row fields check:")
    sample = response2.data[0] if response2.data else {}
    print(f"  low_price: {sample.get('low_price')}")
    print(f"  high_price: {sample.get('high_price')}")
    print(f"  wtd_avg_price: {sample.get('wtd_avg_price')}")
