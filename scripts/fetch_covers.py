import os
import time
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
MANGADEX_API_URL = "https://api.mangadex.org"
MANGADEX_UPLOADS_URL = "https://uploads.mangadex.org"

def get_cover_filename(mangadex_id):
    """
    Fetch the cover filename for a given MangaDex ID.
    """
    try:
        # Fetch manga details to get cover relationship
        resp = httpx.get(f"{MANGADEX_API_URL}/manga/{mangadex_id}?includes[]=cover_art", timeout=10)
        if resp.status_code != 200:
            print(f"  Error fetching manga info: {resp.status_code}")
            return None

        data = resp.json()
        relationships = data.get("data", {}).get("relationships", [])
        
        for rel in relationships:
            if rel["type"] == "cover_art":
                return rel["attributes"]["fileName"]
        
        return None
    except Exception as e:
        print(f"  Exception getting cover info: {e}")
        return None

def main():
    print("Fetching manga with missing covers...")
    
    # 1. Get ALL manga (safest way to catch nulls chains empty strings)
    response = supabase.table("manga").select("*").execute()
    manga_list = response.data
    
    print(f"Found {len(manga_list)} entries. Checking for missing covers...")
    
    for manga in manga_list:
        mid = manga["id"]
        title = manga["title"]
        md_id = manga.get("mangadex_id")
        current_cover = manga.get("cover_url")

        # Skip if cover already exists (and is not a placeholder/broken)
        if current_cover and len(current_cover) > 10:
             continue

        if not md_id:
            print(f"Skipping '{title}' (No MangaDex ID)")
            continue
            
        print(f"Processing '{title}' ({md_id})...")
        
        # 2. Get Filename
        cover_filename = get_cover_filename(md_id)
        if not cover_filename:
            print("  -> No cover file found on MangaDex.")
            continue
            
        # 3. Construct URL (Use 256px version for list view optimization)
        # We save this directly. The frontend 'wsrv.nl' proxy will handle caching and delivery.
        image_url = f"{MANGADEX_UPLOADS_URL}/covers/{md_id}/{cover_filename}.256.jpg"
        
        print(f"  -> Saving URL: {image_url}")
        
        # 4. Update DB Directly
        supabase.table("manga").update({"cover_url": image_url}).eq("id", mid).execute()
        
        time.sleep(0.5) # Slight delay just to be safe

if __name__ == "__main__":
    main()
