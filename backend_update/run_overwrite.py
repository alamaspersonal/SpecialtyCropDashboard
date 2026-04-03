import format_data
from overwrite_supabse import overwrite_supabase_data

print("Loading local CSVs...")
c, u = format_data.load_and_format_all_data()
print("Overwriting supabase...")
success = overwrite_supabase_data(c, u)
print("Complete!", success)
