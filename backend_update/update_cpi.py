"""
update_cpi.py — Fetch latest BLS CPI-U data and update phone_frontend/src/constants/cpiData.js

Series: CUUR0000SA0 (CPI-U All Urban Consumers, All Items, 1982-84=100, NSA)
BLS public API v2 (no key required): https://api.bls.gov/publicAPI/v2/timeseries/data/
BLS releases prior-month CPI around the 10th–15th of each month.
"""

import re
import sys
import requests
from datetime import datetime
from pathlib import Path

SERIES_ID = 'CUUR0000SA0'
CPI_JS = Path(__file__).parent.parent / 'phone_frontend/src/constants/cpiData.js'
BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'

MONTH_MAP = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12',
}


def fetch_bls(start_year: int, end_year: int) -> list:
    resp = requests.post(BLS_URL, json={
        'seriesid': [SERIES_ID],
        'startyear': str(start_year),
        'endyear': str(end_year),
    }, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data['status'] != 'REQUEST_SUCCEEDED':
        raise RuntimeError(f"BLS API error: {data.get('message', data['status'])}")
    return data['Results']['series'][0]['data']


def main():
    text = CPI_JS.read_text()

    existing_keys = set(re.findall(r"'(\d{4}-\d{2})'", text))
    if not existing_keys:
        print("ERROR: could not parse existing CPI keys from cpiData.js", file=sys.stderr)
        sys.exit(1)

    latest_key = max(existing_keys)
    latest_year = int(latest_key[:4])
    current_year = datetime.now().year

    # BLS API v2 without a key: max 10 years per query, 25 queries/day.
    # We only need data from latest_year onward, usually 1–2 queries.
    new_entries: dict[str, float] = {}
    for start in range(latest_year, current_year + 1, 10):
        end = min(start + 9, current_year)
        for entry in fetch_bls(start, end):
            month = MONTH_MAP.get(entry['periodName'])
            if not month:
                continue
            key = f"{entry['year']}-{month}"
            if key not in existing_keys and key > latest_key:
                new_entries[key] = float(entry['value'])

    if not new_entries:
        print('CPI data is already up to date.')
        return

    # Append new lines before the closing `};`
    new_lines = ''.join(f"  '{k}': {v},\n" for k in sorted(new_entries))
    text = text.replace('\n};\n', f'\n{new_lines}}};\n', 1)

    # Update CPI_BASE_KEY and CPI_BASE_VALUE to the newest available month
    new_base = max(existing_keys | set(new_entries.keys()))
    new_base_value = new_entries.get(new_base) or float(
        re.search(rf"'{re.escape(new_base)}':\s*([\d.]+)", text).group(1)
    )
    text = re.sub(
        r"export const CPI_BASE_KEY = '[\d-]+'",
        f"export const CPI_BASE_KEY = '{new_base}'",
        text,
    )
    text = re.sub(
        r"export const CPI_BASE_VALUE = [\d.]+",
        f"export const CPI_BASE_VALUE = {new_base_value}",
        text,
    )
    # Update the trailing comment that names the base period
    text = re.sub(
        r'(\(")[\d-]+( dollars"\)\.)',
        rf'\g<1>{new_base}\g<2>',
        text,
    )

    CPI_JS.write_text(text)
    print(f"Added months: {sorted(new_entries.keys())}")
    print(f"New base: {new_base} = {new_base_value}")


if __name__ == '__main__':
    main()
