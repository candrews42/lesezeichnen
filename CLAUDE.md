# Lesezeichnen Development Instructions

**IMPORTANT:** Before implementing any feature, read [PRD.md](PRD.md) for the system architecture and design decisions.

## Your Guidelines as Co-developer

1. First think through the problem, read PRD.md for relevant context
2. Explain changes at a high level with your reasoning
3. Maintain PRD.md, but ASK before making changes to it
4. Use AskUserQuestion frequently to clarify intent and decisions
5. Give 2-3 options with recommendations when appropriate
6. Never commit without explicit request - wait for "commit", "push", or similar

---

## Project Overview

Lesezeichnen (German for "bookmark") is a personal reading archive where you create hand-drawn bookmarks for finished books. Each bookmark captures your artwork and evolving reflections about the book.

**Core Features:**
- Create bookmarks from your drawings + thoughts (text, voice, images)
- View your collection with filters and stats
- Add reflections to existing bookmarks over time
- Future: See what friends are reading, mint as Solana NFTs

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Auth | Supabase Auth |
| Skill | Claude Code `/bookmarks` |
| Future | Solana (Metaplex NFTs) |

---

## Project Structure

```
lesezeichnen/
├── CLAUDE.md               # This file
├── PRD.md                  # Product requirements
├── LICENSE
│
├── .claude/
│   └── skills/
│       └── bookmarks/
│           └── SKILL.md    # /bookmarks skill definition
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
└── nft-contract/           # Legacy NEAR contract (deprecated)
    └── ...
```

---

## Key Files

| File | Purpose |
|------|---------|
| `PRD.md` | Full product spec, Supabase setup, data model |
| `.claude/skills/bookmarks/SKILL.md` | Skill definition for `/bookmarks` |
| `supabase/migrations/*.sql` | Database schema migrations |

---

## Data Model

### `bookmarks` table
```sql
- id: uuid (PK)
- user_id: uuid (FK -> auth.users)
- book_name: text
- author: text
- rating: int (0-5)
- format: text (physical, ebook, audiobook)
- date_finished: date
- recommended_by: text
- reading_context: text
- media_url: text (drawing image URL)
- solana_mint_address: text (future)
- created_at, updated_at: timestamps
```

### `reflections` table
```sql
- id: uuid (PK)
- bookmark_id: uuid (FK -> bookmarks)
- content: text
- content_type: text (text, voice_transcript, drawing_note)
- created_at: timestamp
```

---

## `/bookmarks` Skill

### Actions

| Action | Description |
|--------|-------------|
| `mint` | Create new bookmark from drawing + reflections |
| `view` | See your collection |
| `update` | Add reflection to existing bookmark |
| `stats` | View reading statistics |

### Example Usage

```
/bookmarks mint
[send photo of drawing]
Just finished "Dune" - 5 stars, read it on vacation

/bookmarks view

/bookmarks update
Still thinking about the sandworms...
```

---

## Environment Variables

Required in `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...  # Server-side only
```

---

## Development Commands

```bash
# Run Supabase locally (requires Docker)
supabase start

# Apply migrations
supabase db push

# Generate TypeScript types (optional)
supabase gen types typescript --local > types/supabase.ts
```

---

## Testing Checklist

### Before Committing
- [ ] Supabase migrations apply cleanly
- [ ] RLS policies work correctly (test as different users)
- [ ] Skill actions execute without errors

### For Skill Changes
- [ ] `mint` creates bookmark and uploads image
- [ ] `view` returns user's bookmarks only
- [ ] `update` appends reflection to correct bookmark
- [ ] Error messages are helpful

---

## Git Workflow

Use conventional commits:
```bash
git commit -m "feat: Add /bookmarks mint action

- Extracts metadata from user input
- Uploads drawing to Supabase Storage
- Creates bookmark record with initial reflection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Roadmap

### Phase 1: MVP (Current)
- [ ] Supabase schema setup
- [ ] `/bookmarks` skill (mint, view, update)
- [ ] Image upload to Supabase Storage

### Phase 2: Polish
- [ ] Stats view
- [ ] Search/filter
- [ ] Voice transcription

### Phase 3: Social
- [ ] Friend connections
- [ ] See friends' reads

### Phase 4: Blockchain
- [ ] Solana wallet connection
- [ ] Mint as Metaplex NFT

---

## Quick Links

- **PRD**: [PRD.md](PRD.md)
- **Supabase Docs**: https://supabase.com/docs
- **Claude Code Skills**: https://docs.anthropic.com/en/docs/claude-code
- **Metaplex (Future)**: https://developers.metaplex.com/
