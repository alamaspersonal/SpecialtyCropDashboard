
import os
import glob
import pandas as pd

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend_update/APP_CROP_DATA"))

def analyze_categories():
    csv_files = glob.glob(os.path.join(DATA_DIR, "*_recent.csv"))
    print(f"Found {len(csv_files)} CSV files.")
    
    unique_categories = set()
    category_sources = {} # category -> list of filenames

    for csv_file in csv_files:
        df = pd.read_csv(csv_file, low_memory=False)
        print(f"Processing {os.path.basename(csv_file)} columns: {list(df.columns)}")
        
        # Logic mirroring format_data.py somewhat to find the raw category
        if 'category' in df.columns:
            cats = df['category'].dropna().unique()
            print(f"  > Found 'category' values: {cats}")
            for c in cats:
                unique_categories.add(c)
        elif 'community' in df.columns:
            cats = df['community'].dropna().unique()
            print(f"  > Found 'community' values: {cats}")
            for c in cats:
                unique_categories.add(c)
        elif 'grp' in df.columns:
            cats = df['grp'].dropna().unique()
            print(f"  > Found 'grp' values: {cats}")
            for c in cats:
                unique_categories.add(c)
        elif 'group' in df.columns:
            cats = df['group'].dropna().unique()
            print(f"  > Found 'group' values: {cats}")
            for c in cats:
                unique_categories.add(c)
                
    print("\nAll Unique Raw Categories Found:")
    for c in sorted(list(unique_categories)):
        print(f"- '{c}'")

if __name__ == "__main__":
    analyze_categories()
