
import json
import sys
import os
from datetime import datetime
from collections import defaultdict

# Add parent directory to path so we can import format_data as a package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_update.format_data import load_and_format_all_data

# Both frontends share the same generated file
OUTPUT_FILES = [
    "phone_frontend/src/constants/staticFilters.js",
    "web_frontend/src/constants/staticFilters.js",
]


def build_js(filters: dict, category_commodities: dict) -> str:
    generated_on = datetime.now().strftime("%a %b %d %H:%M:%S %Z %Y")

    # Render CATEGORY_COMMODITIES with consistent formatting
    cat_lines = []
    for cat in sorted(category_commodities):
        commodities = sorted(category_commodities[cat])
        # Wrap commodity list across lines for readability
        items = ', '.join(f'"{c}"' for c in commodities)
        cat_lines.append(f'    "{cat}": [\n        {items}\n    ]')
    cat_block = ',\n'.join(cat_lines)

    return f"""/**
 * Static filter options generated from database.
 * Generated on: {generated_on}
 */

/**
 * Category to Commodities mapping for instant local validation.
 * Used to immediately clear invalid child filters when parent category changes.
 */
export const CATEGORY_COMMODITIES = {{
{cat_block}
}};

/**
 * Reverse lookup: Commodity to Category mapping.
 * Built automatically from CATEGORY_COMMODITIES.
 */
export const COMMODITY_TO_CATEGORY = {{}};
Object.entries(CATEGORY_COMMODITIES).forEach(([category, commodities]) => {{
    commodities.forEach(commodity => {{
        COMMODITY_TO_CATEGORY[commodity] = category;
    }});
}});

export const STATIC_FILTERS = {json.dumps(filters, indent=4)};
"""


def extract_and_save():
    print("Loading data...")
    unified_df = load_and_format_all_data()

    if unified_df.empty:
        print("Error: No data found!")
        sys.exit(1)

    print(f"Data loaded: {len(unified_df)} records")

    # Build CATEGORY_COMMODITIES: category -> sorted set of commodities
    category_commodities = defaultdict(set)
    for _, row in unified_df[['category', 'commodity']].dropna().iterrows():
        category_commodities[row['category']].add(row['commodity'])

    filters = {
        "categories": sorted(unified_df['category'].dropna().unique().tolist()),
        "commodities": sorted(unified_df['commodity'].dropna().unique().tolist()),
        "varieties": sorted(unified_df['variety'].dropna().unique().tolist()),
        "packages": sorted(unified_df['package'].dropna().unique().tolist()),
        "districts": sorted(unified_df['district'].dropna().unique().tolist()),
        "organics": sorted(unified_df['organic'].dropna().unique().tolist()),
    }

    print("\nExtracted Filters:")
    for k, v in filters.items():
        print(f"  - {k}: {len(v)} options")
    print(f"  - category_commodities: {len(category_commodities)} categories")

    js_content = build_js(filters, category_commodities)

    for output_file in OUTPUT_FILES:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w") as f:
            f.write(js_content)
        print(f"Wrote {output_file}")


if __name__ == "__main__":
    extract_and_save()
