"""
Remove exact duplicate rows from UnifiedCropPrice, processed per commodity
to avoid statement timeouts on large datasets.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
from collections import defaultdict

BATCH_SIZE = 500

KEY_FIELDS = [
    'report_date', 'market_type', 'category', 'commodity', 'variety',
    'package', 'origin', 'district', 'organic', 'price_avg',
    'low_price', 'high_price', 'slug_id',
]

SELECT_FIELDS = ','.join(['id'] + KEY_FIELDS)


def get_client() -> Client:
    load_dotenv()
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SECRET_KEY')
    if not url or not key:
        raise ValueError('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env')
    return create_client(url, key, ClientOptions(postgrest_client_timeout=300))


def make_key(row):
    return tuple(row.get(f) for f in KEY_FIELDS)


def get_all_commodities(client: Client):
    """Fetch all unique commodity names by paginating the commodity column."""
    commodities = set()
    offset = 0
    limit = 1000
    while True:
        res = (
            client.table('UnifiedCropPrice')
            .select('commodity')
            .range(offset, offset + limit - 1)
            .execute()
        )
        if not res.data:
            break
        for row in res.data:
            if row.get('commodity'):
                commodities.add(row['commodity'])
        offset += len(res.data)
        if len(res.data) < limit:
            break
    return sorted(commodities)


def fetch_rows_for_commodity(client: Client, commodity: str):
    """Fetch id + key fields for all rows of a single commodity."""
    rows = []
    offset = 0
    limit = 1000
    while True:
        res = (
            client.table('UnifiedCropPrice')
            .select(SELECT_FIELDS)
            .eq('commodity', commodity)
            .range(offset, offset + limit - 1)
            .execute()
        )
        if not res.data:
            break
        rows.extend(res.data)
        offset += len(res.data)
        if len(res.data) < limit:
            break
    return rows


def find_duplicate_ids(rows):
    groups = defaultdict(list)
    for row in rows:
        groups[make_key(row)].append(row['id'])
    to_delete = []
    for ids in groups.values():
        if len(ids) > 1:
            ids.sort()
            to_delete.extend(ids[1:])
    return to_delete


def delete_ids(client: Client, ids):
    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i:i + BATCH_SIZE]
        client.table('UnifiedCropPrice').delete().in_('id', batch).execute()


if __name__ == '__main__':
    client = get_client()

    print('Fetching commodity list...')
    commodities = get_all_commodities(client)
    print(f'Found {len(commodities)} unique commodities.\n')

    total_deleted = 0
    for i, commodity in enumerate(commodities, 1):
        rows = fetch_rows_for_commodity(client, commodity)
        to_delete = find_duplicate_ids(rows)
        if to_delete:
            delete_ids(client, to_delete)
            total_deleted += len(to_delete)
            print(f'[{i}/{len(commodities)}] {commodity}: {len(rows)} rows, deleted {len(to_delete)} duplicates')
        else:
            print(f'[{i}/{len(commodities)}] {commodity}: {len(rows)} rows, no duplicates')

    print(f'\nDone. Total duplicates removed: {total_deleted:,}')
