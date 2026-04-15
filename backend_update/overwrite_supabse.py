"""
Supabase upload module for SpecialtyCropDashboard.
Uploads formatted data to the UnifiedCropPrice table in Supabase.
"""

import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    # Load environment variables (from .env file if present, otherwise from system env)
    load_dotenv()
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env")
    return create_client(supabase_url, supabase_key)


def clear_table(client: Client, table_name: str):
    """Clear all data from a table in batches to prevent timeouts."""
    print(f"Clearing table: {table_name}...")
    try:
        # First, fetch all IDs
        has_more = True
        offset = 0
        limit = 10000
        all_ids = []
        
        while has_more:
            res = client.table(table_name).select("id").range(offset, offset + limit - 1).execute()
            data = res.data
            if data:
                all_ids.extend([row["id"] for row in data])
                offset += limit
            else:
                has_more = False
                
        if not all_ids:
            print(f"  ✔ Table {table_name} is already empty")
            return
            
        print(f"Found {len(all_ids)} rows to delete from {table_name}...")
        
        # Delete in batches of 1000
        batch_size = 1000
        for i in range(0, len(all_ids), batch_size):
            batch = all_ids[i:i + batch_size]
            client.table(table_name).delete().in_("id", batch).execute()
            print(f"  Progress: deleted {min(i + batch_size, len(all_ids))}/{len(all_ids)} rows")
            
        print(f"  ✔ Cleared {table_name}")
    except Exception as e:
        print(f"  ✘ Error clearing {table_name}: {e}")
        raise

import time


def detect_new_columns(client: Client, table_name: str, df: pd.DataFrame) -> pd.DataFrame:
    """
    Compare df columns against the existing Supabase table schema.
    Prints ALTER TABLE SQL for any columns in df not yet in the table,
    then returns a df with only the columns the table currently has.
    """
    try:
        res = client.table(table_name).select('*').limit(1).execute()
        if not res.data:
            print(f"  ⚠️  {table_name} is empty — cannot infer schema, uploading all columns.")
            return df

        existing_cols = set(res.data[0].keys())
        df_cols = set(df.columns)
        new_cols = df_cols - existing_cols

        if new_cols:
            print(f"\n⚠️  New columns detected that are not yet in {table_name}:")
            print("  Run the following SQL in your Supabase SQL editor, then re-run the pipeline:\n")
            for col in sorted(new_cols):
                print(f'    ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{col}" text;')
            print()
            # Strip unrecognized columns so the upload doesn't fail
            df = df[[c for c in df.columns if c in existing_cols]]
        else:
            print(f"  ✔ No new columns — schema is up to date")

        return df

    except Exception as e:
        print(f"  ⚠️  Could not detect schema for {table_name}: {e}")
        return df


def upload_dataframe(client: Client, table_name: str, df: pd.DataFrame, batch_size: int = 200):
    """
    Upload a DataFrame to a Supabase table.
    
    Args:
        client: Supabase client
        table_name: Name of the table to upload to
        df: DataFrame with data to upload
        batch_size: Number of records to upload per batch
    """
    if df.empty:
        print(f"No data to upload to {table_name}")
        return
    
    # Replace all NaN, NaT, and None values with None for JSON compatibility
    df_clean = df.copy()
    df_clean = df_clean.replace({pd.NA: None, pd.NaT: None})
    df_clean = df_clean.where(pd.notna(df_clean), None)
    
    # Convert to records and sanitize any remaining float NaN values
    records = []
    for record in df_clean.to_dict('records'):
        clean_record = {}
        for key, value in record.items():
            # Handle float NaN values
            if isinstance(value, float) and (pd.isna(value) or value != value):  # value != value checks for NaN
                clean_record[key] = None
            # Convert price_avg to accurately keep decimals (if DB column supports numeric/float)
            elif key == 'price_avg' and value is not None:
                clean_record[key] = round(float(value), 2)
            else:
                clean_record[key] = value
        records.append(clean_record)
    
    print(f"Uploading {len(records)} records to {table_name}...")
    
    # Upload in batches to avoid timeouts
    total_uploaded = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            client.table(table_name).insert(batch).execute()
            total_uploaded += len(batch)
            print(f"  Progress: {total_uploaded}/{len(records)} records uploaded")
            time.sleep(0.1)
        except Exception as e:
            print(f"  ✘ Error uploading batch to {table_name}: {e}")
            raise
    
    print(f"  ✔ Successfully uploaded {total_uploaded} records to {table_name}")


def overwrite_supabase_data(unified_crop_price_df: pd.DataFrame):
    """
    Main function to overwrite all data in the UnifiedCropPrice Supabase table.

    Args:
        unified_crop_price_df: DataFrame formatted for UnifiedCropPrice table

    Returns:
        bool: True if successful, False otherwise
    """
    if 'organic' in unified_crop_price_df.columns:
        before_count = len(unified_crop_price_df)
        unified_crop_price_df = unified_crop_price_df[unified_crop_price_df['organic'] != 'N/A']
        filtered_count = before_count - len(unified_crop_price_df)
        if filtered_count > 0:
            print(f"Filtered out {filtered_count} UnifiedCropPrice rows with organic='N/A'")

    try:
        client = get_supabase_client()

        # Detect new columns BEFORE clearing (table must have rows to infer schema)
        print("\n=== Checking schema ===")
        unified_crop_price_df = detect_new_columns(client, "UnifiedCropPrice", unified_crop_price_df)

        # Clear existing data
        print("\n=== Clearing existing data ===")
        clear_table(client, "UnifiedCropPrice")

        # Upload new data
        print("\n=== Uploading new data ===")
        upload_dataframe(client, "UnifiedCropPrice", unified_crop_price_df)

        print("\n✔ Supabase upload completed successfully!")
        return True

    except Exception as e:
        print(f"\n✘ Supabase upload failed: {e}")
        return False


if __name__ == "__main__":
    # Test with sample data
    print("Testing Supabase connection...")
    try:
        client = get_supabase_client()
        print("✔ Connected to Supabase successfully!")
    except Exception as e:
        print(f"✘ Failed to connect: {e}")
