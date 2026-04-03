import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SECRET_KEY")
client = create_client(supabase_url, supabase_key)

print("Querying UnifiedCropPrice for Apples...")
res = client.table("UnifiedCropPrice").select("*").eq("commodity", "Apples").limit(10).execute()
print("First 10 records for Apples:")
for row in res.data:
    print(f"Date: {row.get('report_date')}, Market: {row.get('market_type')}, PriceAvg: {row.get('price_avg')}")

retail_res = client.table("UnifiedCropPrice").select("*").eq("commodity", "Apples").ilike("market_type", "%Retail%").limit(5).execute()
print("\n--- RETAIL SPECIFIC RECORDS ---")
for row in retail_res.data:
    print(f"Date: {row.get('report_date')}, Market: {row.get('market_type')}, PriceAvg: {row.get('price_avg')}")
