
import json
import re
import sys
import os
from datetime import datetime
from collections import defaultdict

# Add parent directory to path so we can import format_data as a package
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_update.format_data import load_and_format_all_data
from backend_update.overwrite_supabse import get_supabase_client

# Both frontends share the same generated file
OUTPUT_FILES = [
    "phone_frontend/src/constants/staticFilters.js",
    "web_frontend/src/constants/staticFilters.js",
]


def _render_string_array(name: str, values, doc: str) -> str:
    """Render a sorted JS string array export with a leading doc comment."""
    items = ', '.join(f'"{v}"' for v in sorted(values))
    return f"""/**
 * {doc}
 */
export const {name} = [{items}];"""


def build_js(filters: dict, category_commodities: dict,
             complete_data_commodities, organic_commodities, filter_combos) -> str:
    generated_on = datetime.now().strftime("%a %b %d %H:%M:%S %Z %Y")

    # Render CATEGORY_COMMODITIES with consistent formatting
    cat_lines = []
    for cat in sorted(category_commodities):
        commodities = sorted(category_commodities[cat])
        # Wrap commodity list across lines for readability
        items = ', '.join(f'"{c}"' for c in commodities)
        cat_lines.append(f'    "{cat}": [\n        {items}\n    ]')
    cat_block = ',\n'.join(cat_lines)

    complete_block = _render_string_array(
        "COMMODITIES_WITH_COMPLETE_DATA",
        complete_data_commodities,
        "Commodities that have data for all three market types (Terminal, "
        "Shipping Point, Retail). Powers the 'Complete Data Only' toggle "
        "without a database round-trip.",
    )
    organic_block = _render_string_array(
        "COMMODITIES_WITH_ORGANIC_DATA",
        organic_commodities,
        "Commodities that have at least one organic (organic='yes') record. "
        "Powers the 'Organic Only' toggle without a database round-trip.",
    )

    combos_block = (
        "/**\n"
        " * Every distinct [category, commodity, variety, district, organic] combination\n"
        " * in the full table (\"\" = no value). Powers the local filter cascade in\n"
        " * getFilters without a database round-trip.\n"
        " */\n"
        "export const FILTER_COMBOS = [\n"
        + ",\n".join("    " + json.dumps(c, ensure_ascii=False) for c in filter_combos)
        + "\n];"
    )

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

{complete_block}

{organic_block}

{combos_block}
"""


def read_existing_js_array(path: str, export_name: str) -> set:
    """
    Best-effort parse of `export const NAME = ["a", "b", ...];` from a previously
    generated staticFilters.js.

    Lets regeneration be ADDITIVE for organic data: "has organic data" is
    monotonic (a crop that ever had an organic listing still qualifies), but the
    pipeline's DataFrame only covers the recent fetch window (~30 days). Unioning
    the window with the already-known set preserves crops that were organic
    earlier instead of dropping them. Returns an empty set if the file or export
    is missing (e.g. first-ever generation).
    """
    try:
        with open(path) as f:
            text = f.read()
    except FileNotFoundError:
        return set()
    m = re.search(rf'export const {re.escape(export_name)} = \[(.*?)\];', text, re.S)
    if not m:
        return set()
    return set(re.findall(r'"([^"]*)"', m.group(1)))


def extract_and_save():
    print("Loading data...")
    unified_df = load_and_format_all_data()

    if unified_df.empty:
        print("Error: No data found!")
        sys.exit(1)

    print(f"Data loaded: {len(unified_df)} records")

    # Filter combinations come from the FULL table (distinct rows via the
    # get_filter_combos Postgres function), not the recent-fetch window, so crops
    # with no listing in the last 30-60 days still appear in the dropdowns.
    # The function aggregates into one JSON value, so the API's per-request row
    # cap (1000) doesn't truncate the result.
    combo_rows = get_supabase_client().rpc('get_filter_combos').execute().data
    filter_combos = sorted({tuple(r) for r in combo_rows if r[1]})
    filter_combos = [list(c) for c in filter_combos]

    # Build CATEGORY_COMMODITIES: category -> sorted set of commodities
    category_commodities = defaultdict(set)
    for cat, commodity, *_ in filter_combos:
        if cat:
            category_commodities[cat].add(commodity)

    def distinct(idx):
        return sorted({c[idx] for c in filter_combos if c[idx] and c[idx] != 'N/A'})

    filters = {
        "categories": distinct(0),
        "commodities": distinct(1),
        "varieties": distinct(2),
        "packages": sorted(unified_df['package'].dropna().unique().tolist()),
        "districts": distinct(3),
        "organics": distinct(4),
    }

    # Commodities present in all three market types (Terminal/Shipping/Retail),
    # computed server-side across the FULL dataset via the get_complete_data_commodities
    # Postgres function — not just the local recent-fetch window. The old approach
    # unioned a 30-60 day window with whatever was already in the static file, which
    # could only ever add commodities (never correct a bad entry) and could miss any
    # commodity that never had all three market types inside the same short window.
    complete_rows = get_supabase_client().rpc('get_complete_data_commodities').execute()
    complete_data_commodities = {row['commodity'] for row in complete_rows.data}

    df = unified_df[['commodity', 'market_type', 'organic']].dropna(subset=['commodity'])

    # Organic commodities: crops that have any organic listing. Computed from the
    # recent window, then unioned with the set already recorded in staticFilters.js
    # so historically-organic crops are never dropped (see read_existing_js_array).
    window_organic = set(
        df.loc[df['organic'].astype(str).str.lower() == 'yes', 'commodity']
    )
    known_organic = set()
    for out in OUTPUT_FILES:
        known_organic |= read_existing_js_array(out, 'COMMODITIES_WITH_ORGANIC_DATA')
    organic_commodities = window_organic | known_organic
    print(f"  organic: {len(window_organic)} in window + "
          f"{len(known_organic - window_organic)} carried over = {len(organic_commodities)}")

    print("\nExtracted Filters:")
    for k, v in filters.items():
        print(f"  - {k}: {len(v)} options")
    print(f"  - category_commodities: {len(category_commodities)} categories")
    print(f"  - complete_data_commodities: {len(complete_data_commodities)}")
    print(f"  - organic_commodities: {len(organic_commodities)}")

    print(f"  - filter_combos: {len(filter_combos)}")

    js_content = build_js(filters, category_commodities,
                          complete_data_commodities, organic_commodities,
                          filter_combos)

    for output_file in OUTPUT_FILES:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w") as f:
            f.write(js_content)
        print(f"Wrote {output_file}")


if __name__ == "__main__":
    extract_and_save()
