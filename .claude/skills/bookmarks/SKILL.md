---
name: bookmarks
description: Track your reading with hand-drawn bookmarks
allowed-tools: [Bash, Read, Write, WebFetch]
---

# /bookmarks - Personal Reading Archive

Track books you've read with hand-drawn bookmarks and evolving reflections.

## Environment Setup

Requires these environment variables:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

## Actions

### mint

Create a new bookmark for a finished book.

**What to collect from user:**
- Drawing/image of their bookmark (required)
- Book name and author
- Rating (0-5 stars)
- Format (physical, ebook, audiobook)
- Reading context (where/when they read it)
- Their thoughts/reflections

**Example interaction:**
```
User: /bookmarks mint
User: [sends photo of hand-drawn bookmark]
User: Just finished "The Left Hand of Darkness" by Ursula K. Le Guin.
      Read it on my flight to Tokyo. 5 stars - made me think about
      gender and identity in completely new ways.

Claude: Creating your bookmark:

        Book: The Left Hand of Darkness
        Author: Ursula K. Le Guin
        Rating: 5/5
        Format: (not specified - physical?)
        Context: Flight to Tokyo

        Your reflection has been saved. Bookmark created!
```

**Implementation notes:**
- Parse natural language to extract structured fields
- Ask for clarification if book name or author is ambiguous
- Upload image to Supabase Storage bucket "bookmarks"
- Insert record into `bookmarks` table
- Insert initial reflection into `reflections` table

---

### view

Display the user's bookmark collection.

**Optional filters:**
- `rating:5` - Filter by rating
- `author:Le Guin` - Filter by author
- `recent` - Last 10 bookmarks
- No filter shows all bookmarks

**Example interaction:**
```
User: /bookmarks view

Claude: Your bookmarks (12 total):

        [5] The Left Hand of Darkness - Le Guin (Jan 2026)
            "Made me think about gender and identity..."

        [4] Dune - Herbert (Dec 2025)
            "Epic worldbuilding, slow start..."

        [5] Piranesi - Clarke (Nov 2025)
            "Haunting and beautiful..."

        ... (9 more)
```

```
User: /bookmarks view rating:5

Claude: Your 5-star bookmarks (4 total):
        ...
```

---

### update

Add a new reflection to an existing bookmark.

**Flow:**
1. If no bookmark specified, show recent bookmarks to choose from
2. User selects bookmark or specifies by name
3. User provides new reflection
4. Append to `reflections` table

**Example interaction:**
```
User: /bookmarks update
Claude: Which bookmark? Your recent ones:
        1. The Left Hand of Darkness (Jan 2026)
        2. Dune (Dec 2025)
        3. Piranesi (Nov 2025)

User: 1
User: Watched the new adaptation and it brought back all my
      feelings about Estraven. Still thinking about that ending.

Claude: Added reflection to "The Left Hand of Darkness"
        (Now has 3 reflections)
```

---

### stats

Show reading statistics.

**Example interaction:**
```
User: /bookmarks stats

Claude: Your reading stats:

        Total books: 12
        This year: 8
        This month: 2

        Average rating: 4.2
        Favorite author: Ursula K. Le Guin (3 books)

        By format:
        - Physical: 7
        - Ebook: 4
        - Audiobook: 1

        Rating distribution:
        5 stars: #### (4)
        4 stars: ##### (5)
        3 stars: ## (2)
        2 stars: # (1)
```

---

## Supabase Queries

### Insert bookmark
```sql
INSERT INTO bookmarks (user_id, book_name, author, rating, format, date_finished, recommended_by, reading_context, media_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id;
```

### Insert reflection
```sql
INSERT INTO reflections (bookmark_id, content, content_type)
VALUES ($1, $2, 'text');
```

### Get all bookmarks with reflections
```sql
SELECT
  b.*,
  (SELECT json_agg(r ORDER BY r.created_at)
   FROM reflections r
   WHERE r.bookmark_id = b.id) as reflections
FROM bookmarks b
WHERE b.user_id = $1
ORDER BY b.created_at DESC;
```

### Get stats
```sql
SELECT
  COUNT(*) as total,
  AVG(rating) as avg_rating,
  COUNT(*) FILTER (WHERE date_finished >= date_trunc('year', now())) as this_year,
  COUNT(*) FILTER (WHERE date_finished >= date_trunc('month', now())) as this_month
FROM bookmarks
WHERE user_id = $1;
```

---

## Error Handling

- If Supabase connection fails: "Could not connect to your bookmark archive. Check SUPABASE_URL and SUPABASE_ANON_KEY."
- If no bookmarks found: "You haven't created any bookmarks yet. Use `/bookmarks mint` to add your first one!"
- If image upload fails: "Could not upload your drawing. Try again or check your internet connection."
