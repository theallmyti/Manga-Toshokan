-- Create a table to track app versions
CREATE TABLE IF NOT EXISTS app_versions (
    id SERIAL PRIMARY KEY,
    version_code INTEGER NOT NULL, -- e.g. 2 for v1.0.1 (internal counter)
    version_name TEXT NOT NULL,    -- e.g. "1.0.1"
    download_url TEXT NOT NULL,    -- Link to the .apk or release page
    released_at TIMESTAMPTZ DEFAULT NOW(),
    is_mandatory BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON app_versions FOR SELECT USING (true);
