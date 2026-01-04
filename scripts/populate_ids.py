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

def search_mangadex(title: str):
    """
    Search MangaDex for a manga by title.
    Returns the ID of the best match if found, else None.
    """
    retries = 3
    for attempt in range(retries):
        try:
            params = {
                "title": title,
                "limit": 5,
                "order[relevance]": "desc",
                "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
                "includes[]": ["cover_art"]
            }
            
            headers = {
                "User-Agent": "Manga-Toshokan/1.0 (test-script)"
            }
            
            response = httpx.get(f"{MANGADEX_API_URL}/manga", params=params, headers=headers, timeout=15)
            
            if response.status_code == 429:
                print(f"Rate limited. Waiting 5s (Attempt {attempt+1}/{retries})...")
                time.sleep(5)
                continue

            if response.status_code != 200:
                print(f"API Error {response.status_code}: {response.text}")
                return None

            data = response.json()
            results = data.get("data", [])
            
            if not results:
                return None

            # Try to find an exact title match first
            clean_search = title.lower().strip()
            
            for manga in results:
                attributes = manga["attributes"]
                # Check main title
                main_title = attributes["title"].get("en", "").lower().strip()
                if main_title == clean_search:
                    return manga["id"]
                
                # Check alt titles
                for alt in attributes.get("altTitles", []):
                    for lang, t in alt.items():
                        if t.lower().strip() == clean_search:
                            return manga["id"]
            
            return results[0]["id"]
            
        except (httpx.RequestError, httpx.TimeoutException, OSError) as e:
            print(f"Network error searching for '{title}': {e}. Retrying ({attempt+1}/{retries})...")
            time.sleep(2)
    
    print(f"Failed to find '{title}' after {retries} attempts.")
    return None

def main():
    print("Fetching manga without MangaDex IDs...")
    
    # Fetch all, then filter in python or query with filter
    # Supabase filter for null: .is_("mangadex_id", "null")
    response = supabase.table("manga").select("*").is_("mangadex_id", "null").execute()
    manga_list = response.data
    
    print(f"Found {len(manga_list)} entries to process.")
    
    updated_count = 0
    
    for manga in manga_list:
        mid = manga["id"]
        title = manga["title"]
        
        print(f"Searching for '{title}'...")
        
        mangadex_id = search_mangadex(title)
        
        if mangadex_id:
            print(f"  -> Found ID: {mangadex_id}")
            
            # Update DB
            supabase.table("manga").update({
                "mangadex_id": mangadex_id
            }).eq("id", mid).execute()
            
            updated_count += 1
        else:
            print(f"  -> No match found.")
            
        time.sleep(1.1) # Be nice to API limits (2-5 req/sec usually allowed, staying safe)

    print(f"Done. Updated {updated_count} entries.")

if __name__ == "__main__":
    main()
