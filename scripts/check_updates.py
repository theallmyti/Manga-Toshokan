import os
import time
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load env vars (for local testing)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

MANGADEX_API_URL = "https://api.mangadex.org"

def get_latest_chapter(mangadex_id: str):
    """
    Fetches the latest chapter number for a given MangaDex ID.
    Returns: (chapter_number_str, chapter_title, release_date) or None
    """
    try:
        # Fetch chapter list from MangaDex
        # Limit 10, ordered by chapter descending, translated language english (or user pref?)
        # Assuming English ('en') for now.
        params = {
            "limit": 5,
            "manga": mangadex_id,
            "translatedLanguage[]": ["en"],
            "order[chapter]": "desc",
            "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"], # Include all to be safe? Or just safe/suggestive.
            "includeFutureUpdates": "0" 
        }
        
        response = httpx.get(f"{MANGADEX_API_URL}/chapter", params=params, timeout=10)
        
        if response.status_code == 429:
            print(f"Rate limited by MangaDex. Waiting...")
            time.sleep(5)
            return None
            
        if response.status_code != 200:
            print(f"Error fetching chapters for {mangadex_id}: {response.status_code}")
            return None

        data = response.json()
        chapters = data.get("data", [])
        
        if not chapters:
            return None

        # Get the "highest" chapter
        # Often the first one is the highest due to order[chapter]=desc, but let's be careful with parsing
        # MangaDex chapter numbers can be strings like "10.5".
        
        latest_chap = chapters[0]
        attrs = latest_chap["attributes"]
        
        return {
            "chapter": attrs.get("chapter"),
            "title": attrs.get("title"),
            "published_at": attrs.get("publishedAt")
        }

    except Exception as e:
        print(f"Exception fetching {mangadex_id}: {e}")
        return None

def is_newer(new_chap, old_chap):
    """
    Compare two chapter strings.
    Returns True if new_chap > old_chap.
    """
    try:
        if not new_chap: return False
        if not old_chap: return True # If no last known, any chapter is newer
        
        # Simple float conversion for comparison
        # This handles "10.5" vs "10"
        # Failures (like "Oneshot") will throw ValueError
        return float(new_chap) > float(old_chap)
    except ValueError:
        # Fallback to string comparison or just assume it's new if they differ?
        # If we can't parse as float, we return False to be safe, or True if they are different strings?
        # Better: if they are different, assume new? No, might receive older ones.
        # Let's try to handle common cases.
        return new_chap != old_chap

def main():
    print(f"[{datetime.now(timezone.utc)}] Starting update check...")
    
    # 1. Fetch ongoing manga
    try:
        response = supabase.table("manga").select("*").eq("status", "ongoing").execute()
        manga_list = response.data
    except Exception as e:
        print(f"Error fetching manga list: {e}")
        return

    print(f"Found {len(manga_list)} ongoing manga.")

    for manga in manga_list:
        mid = manga.get("id")
        title = manga.get("title")
        mangadex_id = manga.get("mangadex_id")
        last_known = manga.get("last_known_chapter")
        
        if not mangadex_id:
            print(f"Skipping '{title}' (No MangaDex ID)")
            continue

        print(f"Checking '{title}' (Last: {last_known})...")
        
        latest = get_latest_chapter(mangadex_id)
        
        if latest:
            new_chap_num = latest["chapter"]
            
            if is_newer(new_chap_num, last_known):
                print(f"  -> NEW CHAPTER FOUND: {new_chap_num}")
                
                # Update Manga Table
                supabase.table("manga").update({
                    "last_known_chapter": new_chap_num,
                    "last_checked_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", mid).execute()
                
                # Insert into Chapters Table
                try:
                    supabase.table("chapters").insert({
                        "manga_id": mid,
                        "chapter_number": new_chap_num,
                        "title": latest["title"],
                        "release_date": latest["published_at"]
                    }).execute()
                except Exception as insert_err:
                    print(f"  -> Failed to insert history: {insert_err}")
                    
            else:
                print(f"  -> No new update (Latest: {new_chap_num})")
                
                # Still update checked_at
                supabase.table("manga").update({
                    "last_checked_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", mid).execute()
        
        # Rate limit pause
        time.sleep(1)

    print("Update check complete.")

if __name__ == "__main__":
    main()
