"""
Supabase upload module for SpecialtyCropDashboard.
Uploads formatted data to CropPrice and UnifiedCropPrice tables in Supabase.
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
    """Clear all data from a table."""
    print(f"Clearing table: {table_name}...")
    # Delete all rows by using a condition that matches everything
    # Supabase requires at least one filter, so we use id > 0
    try:
        client.table(table_name).delete().gte("id", 0).execute()
        print(f"  ✔ Cleared {table_name}")
    except Exception as e:
        print(f"  ✘ Error clearing {table_name}: {e}")
        raise


def upload_dataframe(client: Client, table_name: str, df: pd.DataFrame, batch_size: int = 500):
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
            # Convert price_avg to int (Supabase expects bigint)
            elif key == 'price_avg' and value is not None:
                clean_record[key] = int(value)
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
        except Exception as e:
            print(f"  ✘ Error uploading batch to {table_name}: {e}")
            raise
    
    print(f"  ✔ Successfully uploaded {total_uploaded} records to {table_name}")


def overwrite_supabase_data(crop_price_df: pd.DataFrame, unified_crop_price_df: pd.DataFrame):
    """
    Main function to overwrite all data in Supabase tables.
    
    Args:
        crop_price_df: DataFrame formatted for CropPrice table
        unified_crop_price_df: DataFrame formatted for UnifiedCropPrice table
    
    Returns:
        bool: True if successful, False otherwise
    """
    # Filter out rows where organic is "N/A" (these are incomplete/header rows)
    if 'organic' in crop_price_df.columns:
        before_count = len(crop_price_df)
        crop_price_df = crop_price_df[crop_price_df['organic'] != 'N/A']
        filtered_count = before_count - len(crop_price_df)
        if filtered_count > 0:
            print(f"Filtered out {filtered_count} CropPrice rows with organic='N/A'")
    
    if 'organic' in unified_crop_price_df.columns:
        before_count = len(unified_crop_price_df)
        unified_crop_price_df = unified_crop_price_df[unified_crop_price_df['organic'] != 'N/A']
        filtered_count = before_count - len(unified_crop_price_df)
        if filtered_count > 0:
            print(f"Filtered out {filtered_count} UnifiedCropPrice rows with organic='N/A'")
    try:
        client = get_supabase_client()
        
        # Clear existing data
        print("\n=== Clearing existing data ===")
        clear_table(client, "CropPrice")
        clear_table(client, "UnifiedCropPrice")
        
        # Upload new data
        print("\n=== Uploading new data ===")
        upload_dataframe(client, "CropPrice", crop_price_df)
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
