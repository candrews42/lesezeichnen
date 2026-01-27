-- Lesezeichnen Initial Schema
-- Run this in your Supabase SQL editor or via migrations

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

-- Create a public bucket for bookmark images
INSERT INTO storage.buckets (id, name, public)
VALUES ('bookmarks', 'bookmarks', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own bookmarks
CREATE POLICY "Users can upload their own bookmarks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bookmarks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own bookmarks
CREATE POLICY "Users can update their own bookmarks"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bookmarks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own bookmarks
CREATE POLICY "Users can delete their own bookmarks"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bookmarks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all bookmark images
CREATE POLICY "Public read access for bookmarks"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bookmarks');

-- =============================================================================
-- TABLES
-- =============================================================================

-- Bookmarks table (main records)
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Book info
  book_name TEXT NOT NULL,
  author TEXT,
  rating INTEGER CHECK (rating >= 0 AND rating <= 5),
  format TEXT CHECK (format IN ('physical', 'ebook', 'audiobook')),
  date_finished DATE,
  recommended_by TEXT,
  reading_context TEXT,

  -- Media
  media_url TEXT,  -- URL to drawing in Supabase Storage

  -- Future: Solana integration
  solana_mint_address TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reflections table (append-only log of thoughts)
CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE NOT NULL,

  content TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('text', 'voice_transcript', 'drawing_note')) DEFAULT 'text',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_book_name ON bookmarks(book_name);
CREATE INDEX IF NOT EXISTS idx_bookmarks_author ON bookmarks(author);
CREATE INDEX IF NOT EXISTS idx_bookmarks_rating ON bookmarks(rating);
CREATE INDEX IF NOT EXISTS idx_reflections_bookmark_id ON reflections(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_reflections_created_at ON reflections(created_at DESC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookmarks_updated_at ON bookmarks;
CREATE TRIGGER bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

-- Bookmarks: users can only access their own
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks"
  ON bookmarks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Reflections: inherit access from parent bookmark
CREATE POLICY "Users can view own reflections"
  ON reflections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookmarks
      WHERE bookmarks.id = reflections.bookmark_id
      AND bookmarks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own reflections"
  ON reflections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookmarks
      WHERE bookmarks.id = reflections.bookmark_id
      AND bookmarks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own reflections"
  ON reflections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookmarks
      WHERE bookmarks.id = reflections.bookmark_id
      AND bookmarks.user_id = auth.uid()
    )
  );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get bookmarks with their reflections
CREATE OR REPLACE FUNCTION get_bookmarks_with_reflections(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  book_name TEXT,
  author TEXT,
  rating INTEGER,
  format TEXT,
  date_finished DATE,
  recommended_by TEXT,
  reading_context TEXT,
  media_url TEXT,
  solana_mint_address TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  reflections JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.book_name,
    b.author,
    b.rating,
    b.format,
    b.date_finished,
    b.recommended_by,
    b.reading_context,
    b.media_url,
    b.solana_mint_address,
    b.created_at,
    b.updated_at,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'content', r.content,
          'content_type', r.content_type,
          'created_at', r.created_at
        ) ORDER BY r.created_at
      )
      FROM reflections r
      WHERE r.bookmark_id = b.id),
      '[]'::jsonb
    ) as reflections
  FROM bookmarks b
  WHERE b.user_id = p_user_id
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get reading stats for a user
CREATE OR REPLACE FUNCTION get_reading_stats(p_user_id UUID)
RETURNS TABLE (
  total_books BIGINT,
  books_this_year BIGINT,
  books_this_month BIGINT,
  avg_rating NUMERIC,
  favorite_author TEXT,
  favorite_author_count BIGINT,
  physical_count BIGINT,
  ebook_count BIGINT,
  audiobook_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE date_finished >= date_trunc('year', CURRENT_DATE)) as this_year,
      COUNT(*) FILTER (WHERE date_finished >= date_trunc('month', CURRENT_DATE)) as this_month,
      ROUND(AVG(rating)::numeric, 1) as avg_rat,
      COUNT(*) FILTER (WHERE format = 'physical') as physical,
      COUNT(*) FILTER (WHERE format = 'ebook') as ebook,
      COUNT(*) FILTER (WHERE format = 'audiobook') as audiobook
    FROM bookmarks
    WHERE user_id = p_user_id
  ),
  fav_author AS (
    SELECT author, COUNT(*) as cnt
    FROM bookmarks
    WHERE user_id = p_user_id AND author IS NOT NULL
    GROUP BY author
    ORDER BY cnt DESC
    LIMIT 1
  )
  SELECT
    s.total,
    s.this_year,
    s.this_month,
    s.avg_rat,
    fa.author,
    fa.cnt,
    s.physical,
    s.ebook,
    s.audiobook
  FROM stats s
  LEFT JOIN fav_author fa ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
