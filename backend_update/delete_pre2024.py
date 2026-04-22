"""
Delete all rows with report_date < 2024-01-01 from UnifiedCropPrice.
Fetches and deletes in small batches to avoid statement timeouts.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions

CUTOFF = "2024-01-01"
BATCH_SIZE = 500


def get_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env")
    return create_client(url, key, ClientOptions(postgrest_client_timeout=300))


def delete_pre2024(client: Client, table: str):
    print(f"\n=== {table} ===")
    total_deleted = 0

    while True:
        # Always fetch from offset 0 since we delete as we go
        res = (
            client.table(table)
            .select("id")
            .lt("report_date", CUTOFF)
            .limit(BATCH_SIZE)
            .execute()
        )
        if not res.data:
            break

        ids = [row["id"] for row in res.data]
        client.table(table).delete().in_("id", ids).execute()
        total_deleted += len(ids)
        print(f"  Deleted {total_deleted:,} rows so far...")

        if len(ids) < BATCH_SIZE:
            break

    if total_deleted == 0:
        print(f"  No rows found before {CUTOFF}")
    else:
        print(f"  Done — {total_deleted:,} rows removed from {table}")


if __name__ == "__main__":
    client = get_client()
    delete_pre2024(client, "UnifiedCropPrice")
    print("\nAll done.")
