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
    print("Fetching all manga to standardise URLs...")
    
    # Fetch all manga (small library size allows this)
    response = supabase.table("manga").select("*").execute()
    manga_list = response.data
    
    print(f"Found {len(manga_list)} entries to process.")
    
    updated_count = 0
    
    for manga in manga_list:
        mid = manga["id"]
        title = manga["title"]
        mangadex_id = manga.get("mangadex_id")
        current_url = manga.get("url") or ""
        
        # 1. If ID is missing, search for it
        if not mangadex_id:
            print(f"[{title}] Missing ID. Searching...")
            mangadex_id = search_mangadex(title)
            if mangadex_id:
                print(f"  -> Found ID: {mangadex_id}")
                # We will update DB below
            else:
                print(f"  -> No match found.")
                continue # Cannot fix URL without ID
        
        # 2. Check if URL needs fixing
        # It needs fixing if:
        #   a) It matches limits (we just found the ID)
        #   b) The current URL is NOT a mangadex URL
        expected_url = f"https://mangadex.org/title/{mangadex_id}"
        
        if current_url != expected_url:
            print(f"[{title}] Updating URL...")
            print(f"  Old: {current_url}")
            print(f"  New: {expected_url}")
            
            supabase.table("manga").update({
                "mangadex_id": mangadex_id,
                "url": expected_url
            }).eq("id", mid).execute()
            
            updated_count += 1
        else:
             print(f"[{title}] URL already correct.")

        time.sleep(0.5) 

    print(f"Done. Updated {updated_count} entries.")

if __name__ == "__main__":
    main()
