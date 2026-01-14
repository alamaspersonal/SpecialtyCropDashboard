import requests
import pandas as pd
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --------------------------------------------------
# Configuration
# --------------------------------------------------

# Load environment variables from .env file
load_dotenv()

API_KEY = os.getenv("USDA_API_KEY", "YOUR_API_KEY_HERE")
if API_KEY != "YOUR_API_KEY_HERE":
    print("Loaded USDA_API_KEY from .env")

BASE_URL = "https://marsapi.ams.usda.gov/services/v1.2/reports"

# User-specified slug IDs
REQUIRED_SLUG_IDS = [
    "2306", "2307", "2308", "2309", "2390", 
    "2391", "3324"
]

OUTPUT_DIR = "APP_CROP_DATA"
os.makedirs(OUTPUT_DIR, exist_ok=True)

REQUEST_DELAY = 1.0

# --------------------------------------------------
# Helpers
# --------------------------------------------------

def safe_request(url, params):
    """Centralized request handling with throttling and auth"""
    try:
        # Authentication tuple
        auth = (API_KEY, "") if API_KEY != "YOUR_API_KEY_HERE" else None
        
        response = requests.get(
            url,
            params=params,
            auth=auth,
            timeout=60
        )
        response.raise_for_status()
        time.sleep(REQUEST_DELAY)
        
        try:
            data = response.json()
            if isinstance(data, str):
                if "Invalid slug" in data:
                    return None
            return data
        except ValueError:
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def flatten_sections(api_response):
    """Flatten API sections into a single dataframe"""
    rows = []
    
    # Common fields to propagate from top level to results
    TOP_LEVEL_KEYS = [
        "report_date", "market_type", "slug_id", "slug_name", 
        "report_title", "published_date", "report_begin_date", "report_end_date"
    ]

    # Helper to extract meta from a dict
    def get_meta(d):
        return {k: d.get(k) for k in TOP_LEVEL_KEYS if d.get(k) and not (isinstance(d.get(k), float) and pd.isna(d.get(k)))}

    def find_date_in_any_result(node):
        """Scans results for a date if missing at top level"""
        results = node.get("results", [])
        for r in results:
            for k in ["report_date", "report_end_date", "report_begin_date", "published_date"]:
                if r.get(k) and not pd.isna(r.get(k)):
                    return r.get(k)
        
        if "sections" in node and isinstance(node["sections"], list):
            for sub in node["sections"]:
                d = find_date_in_any_result(sub)
                if d: return d
        return None

    def process_report(report_item):
        # 1. Start with global meta from report root
        report_meta = get_meta(report_item)
        
        # 2. If date missing, try to find it in ANY result of ANY section
        if not report_meta.get("report_date"):
            found_date = find_date_in_any_result(report_item)
            if found_date:
                report_meta["report_date"] = found_date

        def process_node(node, inherited_meta):
            local_meta = {**inherited_meta, **get_meta(node)}
            results = node.get("results", [])
            
            if results:
                section_name = node.get("reportSection", "UNKNOWN")
                for r in results:
                    for k, v in local_meta.items():
                        curr = r.get(k)
                        if curr is None or (isinstance(curr, float) and pd.isna(curr)) or curr == "":
                            r[k] = v
                    r["_section"] = section_name
                    rows.append(r)
            
            if "sections" in node and isinstance(node["sections"], list):
                for sub in node["sections"]:
                    process_node(sub, local_meta)

        process_node(report_item, report_meta)

    if isinstance(api_response, list):
        for item in api_response:
            process_report(item)
    elif isinstance(api_response, dict):
        process_report(api_response)

    return pd.DataFrame(rows)

# --------------------------------------------------
# Main Logic
# --------------------------------------------------

def fetch_recent_data(slug_ids, days=30):
    all_reports = {}
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    start_str = start_date.strftime("%m/%d/%Y") # MARS API format MM/DD/YYYY
    end_str = end_date.strftime("%m/%d/%Y")
    
    print(f"Fetching data from {start_str} to {end_str}...")

    for slug in slug_ids:
        print(f"\nProcessing Slug {slug}...")
        
        url = f"{BASE_URL}/{slug}"
        params = {
            "q": f"published_date={start_str}:{end_str}",
            "allSections": "true"
        }

        data = safe_request(url, params)
        if not data:
            print(f"  No data returned for {slug}")
            continue

        df = flatten_sections(data)
        
        if df is not None and not df.empty:
            print(f"  ✔ {slug}: {len(df)} rows found")
            
            # Save individual file
            filename = f"{slug}_recent.csv"
            out_path = os.path.join(OUTPUT_DIR, filename)
            df.to_csv(out_path, index=False)
            print(f"    Saved to {out_path}")
            
            all_reports[slug] = df
        else:
            print(f"  No data rows found for {slug}")

    return all_reports

if __name__ == "__main__":
    print("Starting recent data pull...")
    fetch_recent_data(REQUIRED_SLUG_IDS)
    print("\nDone.")
