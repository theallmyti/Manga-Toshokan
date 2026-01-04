-- Migration to add missing columns to the existing 'manga' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manga' AND column_name = 'mangadex_id') THEN
        ALTER TABLE manga ADD COLUMN mangadex_id TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manga' AND column_name = 'last_known_chapter') THEN
        ALTER TABLE manga ADD COLUMN last_known_chapter TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manga' AND column_name = 'last_checked_at') THEN
        ALTER TABLE manga ADD COLUMN last_checked_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create chapters table if not exists (this part was likely fine before, but good to ensure)
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manga_id BIGINT REFERENCES manga(id) ON DELETE CASCADE,
    chapter_number TEXT NOT NULL,
    title TEXT,
    release_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(manga_id, chapter_number)
);
