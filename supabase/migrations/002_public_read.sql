-- Migration: Add public read policies for web frontend
-- This allows the Vercel-hosted web app to read bookmarks using the anon key

-- Allow anyone to read bookmarks (for public sharing)
CREATE POLICY "Public can view bookmarks"
  ON bookmarks FOR SELECT
  USING (true);

-- Allow anyone to read reflections (for public sharing)
CREATE POLICY "Public can view reflections"
  ON reflections FOR SELECT
  USING (true);

-- Note: Write operations still require authentication via user_id check
-- The existing policies for INSERT, UPDATE, DELETE remain unchanged
