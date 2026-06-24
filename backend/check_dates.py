"""
Check what dates exist in the CropPrice table in Supabase
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
key = os.getenv("EXPO_PUBLIC_SUPABASE_KEY")
supabase: Client = create_client(url, key)

print("Checking date range in CropPrice table...")

# Get the most recent dates
response = supabase.table("CropPrice").select("report_date").order("report_date", desc=True).limit(10).execute()

print(f"Most recent 10 report dates:")
for row in response.data:
    print(f"  {row['report_date']}")

# Get the oldest dates
response2 = supabase.table("CropPrice").select("report_date").order("report_date", desc=False).limit(5).execute()

print(f"\nOldest 5 report dates:")
for row in response2.data:
    print(f"  {row['report_date']}")

# Count total rows
response3 = supabase.table("CropPrice").select("id", count="exact").execute()
print(f"\nTotal CropPrice rows: {response3.count}")

# Calculate cutoff for 7 days
from datetime import datetime, timedelta
cutoff = datetime.now() - timedelta(days=7)
print(f"\n7-day cutoff would be: {cutoff.isoformat()}")

# Count rows in last 7 days
response4 = supabase.table("CropPrice").select("id", count="exact").gte("report_date", cutoff.isoformat()).execute()
print(f"Rows in last 7 days: {response4.count}")
