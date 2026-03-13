#!/usr/bin/env python3
import os
import argparse
import requests
from collections import Counter
import re

def load_env():
    """Load matching environment variables manually from .env.local"""
    env_path = os.path.join(os.path.dirname(__file__), '..', 'web_frontend', '.env.local')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    os.environ[key] = val

def fetch_market_notes(commodity, start_date, end_date):
    supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.environ.get('NEXT_PUBLIC_SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("Error: Missing Supabase credentials in .env.local")
        return []

    url = f"{supabase_url}/rest/v1/CropPrice"
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    # We use a list of tuples because requests handles duplicate keys natively this way
    params_list = [
        ("select", "market_tone_comments"),
        ("commodity", f"eq.{commodity}"),
        ("report_date", f"gte.{start_date}"),
        ("report_date", f"lte.{end_date}")
    ]

    try:
        response = requests.get(url, headers=headers, params=params_list)
        response.raise_for_status()
        data = response.json()
        
        # Extract non-null, non-empty comments
        notes = [row['market_tone_comments'] for row in data if row.get('market_tone_comments')]
        return notes
    except Exception as e:
        print(f"Failed to fetch data: {str(e)}")
        return []

def analyze_notes(notes):
    if not notes:
        print("No market notes found for the given criteria.")
        return

    # Keywords to track based on USDA standard market tones
    keywords = {
        'higher': 0,
        'lower': 0,
        'steady': 0,
        'active': 0,
        'moderate': 0,
        'slow': 0,
        'good': 0,
        'fair': 0,
        'light': 0,
        'firm': 0,
        'weak': 0
    }

    # Clean and tokenize all notes into one corpus
    text = " ".join(notes).lower()
    words = re.findall(r'\b[a-z]+\b', text)
    
    # Count keywords
    word_counts = Counter(words)
    for kw in keywords:
        keywords[kw] = word_counts[kw]

    # Calculate overall trend scores using naive sentiment modeling
    positive_score = keywords['higher'] + keywords['active'] + keywords['good'] + keywords['firm']
    negative_score = keywords['lower'] + keywords['slow'] + keywords['light'] + keywords['weak']
    neutral_score = keywords['steady'] + keywords['moderate'] + keywords['fair']

    # Determine trend prediction
    if positive_score > negative_score and positive_score > neutral_score:
        trend = "POS/BULLISH (Upward Pressure)"
    elif negative_score > positive_score and negative_score > neutral_score:
        trend = "NEG/BEARISH (Downward Pressure)"
    elif neutral_score > positive_score and neutral_score > negative_score:
        trend = "NEUTRAL (Stable/Steady)"
    else:
        trend = "MIXED (Conflicting Signals)"

    print("=== Market Notes Trend Analysis ===")
    print(f"Total Notes Analyzed: {len(notes)}")
    print("\n--- Keyword Frequencies ---")
    for kw, count in sorted(keywords.items(), key=lambda x: x[1], reverse=True):
        if count > 0:
            print(f"  {kw.capitalize()}: {count}")

    print("\n--- Sentiment Scores ---")
    print(f"  Positive/Strong: {positive_score}")
    print(f"  Negative/Weak:   {negative_score}")
    print(f"  Neutral:         {neutral_score}")
    
    print(f"\n=> Predicted Overall Trend: {trend}")

def main():
    parser = argparse.ArgumentParser(description="Analyze USDA market notes sentiment directly from Supabase DB")
    parser.add_argument("--commodity", required=True, help="Commodity name (e.g. 'APPLES')")
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    args = parser.parse_args()

    load_env()
    print(f"Fetching data for {args.commodity} between {args.start} and {args.end}...")
    notes = fetch_market_notes(args.commodity, args.start, args.end)
    analyze_notes(notes)

if __name__ == "__main__":
    main()
