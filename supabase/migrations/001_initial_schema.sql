-- Lesezeichnen Database Schema
-- Book Bookmark NFT Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  wallet_address TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books table (canonical book information)
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  isbn13 TEXT,
  publisher TEXT,
  published_year INTEGER,
  page_count INTEGER,
  genres TEXT[],
  description TEXT,
  cover_url TEXT,
  open_library_id TEXT,
  goodreads_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique book by ISBN or title+author combo
  CONSTRAINT unique_isbn UNIQUE (isbn),
  CONSTRAINT unique_isbn13 UNIQUE (isbn13)
);

-- Create index for book lookups
CREATE INDEX idx_books_title_author ON books (title, author);
CREATE INDEX idx_books_isbn ON books (isbn) WHERE isbn IS NOT NULL;
CREATE INDEX idx_books_isbn13 ON books (isbn13) WHERE isbn13 IS NOT NULL;

-- Bookmarks table (user's physical bookmarks)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Bookmark images
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,

  -- Reading metadata
  format TEXT CHECK (format IN ('physical', 'ebook', 'audiobook')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  date_started DATE,
  date_finished DATE,
  date_drawn DATE,

  -- Context
  recommended_by TEXT,
  started_location TEXT,
  finished_location TEXT,

  -- Extracted content
  thoughts TEXT,
  favorite_quotes TEXT[],

  -- NFT status
  nft_minted BOOLEAN DEFAULT FALSE,
  nft_mint_address TEXT,
  nft_metadata_uri TEXT,

  -- AI extraction metadata
  ai_extracted_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_user ON bookmarks (user_id);
CREATE INDEX idx_bookmarks_book ON bookmarks (book_id);
CREATE INDEX idx_bookmarks_nft ON bookmarks (nft_mint_address) WHERE nft_mint_address IS NOT NULL;

-- Vote options (books to vote on)
CREATE TABLE vote_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  suggested_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vote_options_active ON vote_options (is_active) WHERE is_active = TRUE;

-- Votes (quadratic voting by NFT holders)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id UUID REFERENCES vote_options(id) ON DELETE CASCADE,
  voter_wallet TEXT NOT NULL,
  nft_mint_address TEXT NOT NULL,
  vote_count INTEGER NOT NULL CHECK (vote_count > 0), -- Quadratic: this is sqrt of votes spent
  votes_spent INTEGER NOT NULL CHECK (votes_spent > 0), -- Actual votes spent (vote_count^2)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each NFT can only vote once per option
  CONSTRAINT unique_nft_vote UNIQUE (option_id, nft_mint_address)
);

CREATE INDEX idx_votes_option ON votes (option_id);
CREATE INDEX idx_votes_wallet ON votes (voter_wallet);

-- NFT ownership cache (updated by webhook or periodic sync)
CREATE TABLE nft_ownership (
  mint_address TEXT PRIMARY KEY,
  owner_wallet TEXT NOT NULL,
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nft_ownership_wallet ON nft_ownership (owner_wallet);

-- Pending bookmark submissions (before full processing)
CREATE TABLE pending_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT,
  front_image_url TEXT,
  back_image_url TEXT,
  status TEXT DEFAULT 'awaiting_images' CHECK (status IN ('awaiting_images', 'processing', 'awaiting_info', 'completed', 'failed')),
  extracted_data JSONB,
  missing_fields TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_user ON pending_submissions (user_id);
CREATE INDEX idx_pending_status ON pending_submissions (status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_submissions_updated_at
  BEFORE UPDATE ON pending_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Public read access for books and vote options
CREATE POLICY "Books are viewable by everyone" ON books FOR SELECT USING (true);
CREATE POLICY "Vote options are viewable by everyone" ON vote_options FOR SELECT USING (true);
CREATE POLICY "Votes are viewable by everyone" ON votes FOR SELECT USING (true);

-- Users can view their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Bookmarks: users can manage their own, public can view all
CREATE POLICY "Bookmarks are viewable by everyone" ON bookmarks FOR SELECT USING (true);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own bookmarks" ON bookmarks FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Service role bypass for backend operations
CREATE POLICY "Service role full access users" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access books" ON books FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access bookmarks" ON bookmarks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access vote_options" ON vote_options FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access votes" ON votes FOR ALL USING (auth.role() = 'service_role');

-- Storage bucket for bookmark images
INSERT INTO storage.buckets (id, name, public) VALUES ('bookmarks', 'bookmarks', true);

-- Storage policy for bookmark images
CREATE POLICY "Bookmark images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bookmarks');

CREATE POLICY "Service role can upload bookmark images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bookmarks' AND auth.role() = 'service_role');
