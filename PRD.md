# Lesezeichnen PRD

## Overview

Lesezeichnen (German for "bookmark") is a personal reading archive that combines handmade art with AI-powered reflection capture. Each book you finish becomes a bookmark - a drawing you create paired with your thoughts, captured through text, voice, or images.

**Core Concept:**
- **Create**: Draw a bookmark for each book you finish
- **Reflect**: Share your thoughts via text, voice note, or photo
- **Store**: AI extracts metadata and stores everything in your personal archive
- **Update**: Add new reflections anytime - your relationship with a book evolves
- **Connect**: See what friends are reading (future)

## User Journey

```
1. Finish reading a book
         │
         ▼
2. Create a drawing (your "bookmark")
         │
         ▼
3. Tell Claude about the book
   - Send photo of your drawing
   - Voice note or text with your thoughts
   - "I just finished Dune, read it on vacation, 5 stars"
         │
         ▼
4. Claude extracts metadata + stores bookmark
   - Book name, author, rating
   - Your reflections (timestamped)
   - Your drawing (uploaded to storage)
         │
         ▼
5. Later: add more reflections
   - "Thinking about Dune again after watching the movie..."
   - Reflections append to the bookmark
```

## Core Features

### MVP (Phase 1)

| Feature | Description |
|---------|-------------|
| **Mint** | Create a new bookmark from drawing + reflections |
| **View** | See your collection, filter by rating/date/author |
| **Update** | Add new reflections to existing bookmarks |

### Future (Phase 2+)

| Feature | Description |
|---------|-------------|
| **Friends** | See what friends are reading |
| **Solana NFT** | Mint bookmarks as on-chain NFTs |
| **Export** | Export collection as PDF/JSON |

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   clawd.bot     │     │           Lesezeichnen Service      │
│  (Claude Code)  │     │                                     │
│                 │     │  ┌─────────────┐  ┌──────────────┐  │
│ /bookmarks skill│────▶│  │  Supabase   │  │  Supabase    │  │
│                 │     │  │  Database   │  │  Storage     │  │
└─────────────────┘     │  └─────────────┘  └──────────────┘  │
                        │         │                           │
                        │         ▼                           │
                        │  ┌─────────────────────────────┐    │
                        │  │  Future: Solana Integration │    │
                        │  │  - Mint NFTs on-chain       │    │
                        │  │  - Ownership verification   │    │
                        │  └─────────────────────────────┘    │
                        └─────────────────────────────────────┘
```

**Phase 1 (MVP)**: Supabase handles everything (database, auth, file storage)
**Phase 2**: Add Solana NFT minting, Supabase remains metadata/media store

## Tech Stack

| Component | Technology |
|-----------|------------|
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Auth | Supabase Auth |
| Skill | Claude Code `/bookmarks` |
| Future: Blockchain | Solana (Metaplex NFTs) |

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon/service keys
3. Enable the Storage service

### 2. Create Storage Bucket

```sql
-- Create a public bucket for bookmark images
INSERT INTO storage.buckets (id, name, public)
VALUES ('bookmarks', 'bookmarks', true);

-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own bookmarks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bookmarks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bookmarks');
```

### 3. Create Tables

```sql
-- Bookmarks table (main records)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,

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
CREATE TABLE reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE NOT NULL,

  content TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('text', 'voice_transcript', 'drawing_note')) DEFAULT 'text',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX idx_reflections_bookmark_id ON reflections(bookmark_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own bookmarks
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

-- Reflections inherit access from parent bookmark
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
```

### 4. Environment Variables

Create a `.env` file (add to `.gitignore`):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...  # Only for server-side operations
```

---

## Data Model

### Bookmark

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner (FK to auth.users) |
| `book_name` | text | Title of the book |
| `author` | text | Author name |
| `rating` | int | 0-5 stars |
| `format` | text | physical, ebook, audiobook |
| `date_finished` | date | When you finished reading |
| `recommended_by` | text | Who suggested the book |
| `reading_context` | text | Where/when you read it |
| `media_url` | text | URL to your drawing |
| `solana_mint_address` | text | Future: on-chain NFT address |
| `created_at` | timestamp | When bookmark was created |
| `updated_at` | timestamp | Last update |

### Reflection

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `bookmark_id` | uuid | Parent bookmark |
| `content` | text | Your thoughts |
| `content_type` | text | text, voice_transcript, drawing_note |
| `created_at` | timestamp | When reflection was added |

---

## `/bookmarks` Skill Specification

### Skill Definition

Location: `.claude/skills/bookmarks/SKILL.md`

```yaml
---
name: bookmarks
description: Track your reading with hand-drawn bookmarks
allowed-tools: [Bash, Read, Write, WebFetch]
---
```

### Actions

| Action | Usage | Description |
|--------|-------|-------------|
| `mint` | `/bookmarks mint` | Create a new bookmark |
| `view` | `/bookmarks view [filter]` | View your collection |
| `update` | `/bookmarks update <id>` | Add reflection to existing bookmark |
| `stats` | `/bookmarks stats` | View reading statistics |

### Example Flows

**Minting a new bookmark:**
```
User: /bookmarks mint
User: [sends photo of drawing]
User: Just finished "The Left Hand of Darkness" by Ursula K. Le Guin.
      Read it during my flight to Tokyo. Absolutely loved it - 5 stars.
      Made me think about gender and society in new ways.

Claude: I'll create your bookmark:
        - Book: The Left Hand of Darkness
        - Author: Ursula K. Le Guin
        - Rating: 5/5
        - Context: Flight to Tokyo
        - Drawing: [uploaded]

        Your reflection has been saved. Bookmark created!
```

**Viewing collection:**
```
User: /bookmarks view

Claude: Your bookmarks (12 total):

        [5 stars] The Left Hand of Darkness - Le Guin (Jan 2026)
        [4 stars] Dune - Herbert (Dec 2025)
        [5 stars] Piranesi - Clarke (Nov 2025)
        ...
```

**Adding a reflection:**
```
User: /bookmarks update
User: I keep thinking about The Left Hand of Darkness after
      watching the new adaptation...

Claude: Added reflection to "The Left Hand of Darkness" (3 reflections total)
```

---

## MVP Scope

### Phase 1: Core Functionality
- [ ] Supabase project setup (tables, storage, RLS)
- [ ] `/bookmarks` skill with mint, view, update actions
- [ ] Image upload to Supabase Storage
- [ ] Basic metadata extraction from user input

### Phase 2: Polish
- [ ] Stats view (books per month, favorite authors, etc.)
- [ ] Search/filter by author, rating, date range
- [ ] Voice note transcription support
- [ ] Better AI extraction (themes, quotes)

### Phase 3: Social
- [ ] Friend connections
- [ ] See friends' recent reads
- [ ] Recommendations based on friends

### Phase 4: Blockchain
- [ ] Solana wallet connection
- [ ] Mint bookmark as Metaplex NFT
- [ ] On-chain ownership verification
- [ ] Collection display on Solana explorers

---

## Open Questions

1. **Auth flow**: How should the skill authenticate with Supabase?
   - API key in environment
   - OAuth flow
   - Service account

2. **Image processing**: Should we resize/optimize drawings before upload?

3. **Voice transcription**: Use Whisper API or rely on user's transcription?

4. **Friends feature**: How do users connect? (username, invite link, etc.)

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code)
- [Metaplex (Solana NFTs)](https://developers.metaplex.com/)
