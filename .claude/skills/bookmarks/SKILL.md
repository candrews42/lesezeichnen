---
name: bookmarks
description: Track your reading with hand-drawn bookmarks
allowed-tools: [Bash, Read, Write, WebFetch]
---

# /bookmarks - Personal Reading Archive

Track books you've read with hand-drawn bookmarks and evolving reflections.

**This is a conversational skill.** Users describe books naturally; you extract the structured data.

---

## Quick Reference

| Action | What it does |
|--------|--------------|
| `/bookmarks mint` | Create a new bookmark from drawing + thoughts |
| `/bookmarks view` | See your collection |
| `/bookmarks update` | Add reflection to existing bookmark |
| `/bookmarks stats` | View reading statistics |

---

## Environment Setup

Requires these environment variables (see `.env.example`):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
LESEZEICHNEN_USER_ID=your-user-uuid
```

---

## Natural Language Parsing

**IMPORTANT:** Users will describe books conversationally. Extract structured data from their natural language.

### Extraction Rules

| Field | How to extract |
|-------|----------------|
| `book_name` | Titles in quotes, capitalized phrases, or "finished [Title]" |
| `author` | "by [Name]", "written by", or author mentioned separately |
| `rating` | "X stars", "X/5", "loved it" (5), "liked it" (4), "okay" (3), "meh" (2), "didn't like" (1) |
| `format` | "audiobook", "kindle", "ebook", "physical", "hardcover", "paperback" |
| `reading_context` | Location/time phrases: "on vacation", "during my commute", "at the beach" |
| `recommended_by` | "recommended by [Name]", "[Name] suggested" |

### Parsing Examples

**Input:** "Just finished Dune by Frank Herbert. 5 stars! Read it on my flight to Tokyo."
**Extract:**
- book_name: "Dune"
- author: "Frank Herbert"
- rating: 5
- reading_context: "flight to Tokyo"

**Input:** "Finally got through The Brothers Karamazov. Took me 3 months but wow. 4/5"
**Extract:**
- book_name: "The Brothers Karamazov"
- author: (unknown - ask or lookup)
- rating: 4
- reading_context: (none)

**Input:** "Sarah recommended this audiobook - Project Hail Mary. Loved it!"
**Extract:**
- book_name: "Project Hail Mary"
- author: (lookup: Andy Weir)
- rating: 5 (from "loved it")
- format: "audiobook"
- recommended_by: "Sarah"

### When Uncertain

If you can't confidently extract a field:
1. For book_name: **Always ask** - it's required
2. For author: Try to look it up, or ask
3. For rating: Ask "How would you rate it? (1-5 stars)"
4. For other fields: Leave as null, don't ask unless user seems to want to provide

---

## Actions

### mint

Create a new bookmark for a finished book.

**Flow:**
1. User invokes `/bookmarks mint`
2. User shares their drawing (image path or describes it)
3. User describes the book naturally
4. **You extract** book_name, author, rating, format, context, reflection
5. **You confirm** the extracted data with the user
6. If confirmed, save using the CLI helper
7. Report success

**Handling Images:**
- If user provides an image path: Use `--image` flag
- If user describes drawing but no file: Note in reflection, skip image upload
- If user says "I'll add the image later": Create bookmark without image

**Example Interaction:**
```
User: /bookmarks mint

Claude: Ready to create a bookmark! Share your drawing and tell me about the book.

User: [shares /Users/me/drawings/dune.jpg]
      Just finished "Dune" by Frank Herbert. Read it on vacation in Hawaii.
      Absolutely incredible worldbuilding - 5 stars. The ecology stuff blew my mind.

Claude: Great! Here's what I captured:

        📚 Book: Dune
        ✍️  Author: Frank Herbert
        ⭐ Rating: 5/5
        📖 Format: (physical book?)
        🌴 Context: Vacation in Hawaii
        📝 Reflection: "Absolutely incredible worldbuilding... The ecology stuff blew my mind."
        🎨 Drawing: dune.jpg

        Does this look right? (yes/no/edit)

User: yes

Claude: [runs CLI command]
        ✅ Bookmark created for "Dune"!
        Your reflection and drawing have been saved.
```

**CLI Command (internal):**
```bash
python scripts/bookmarks.py mint \
  --book "Dune" \
  --author "Frank Herbert" \
  --rating 5 \
  --context "Vacation in Hawaii" \
  --reflection "Absolutely incredible worldbuilding... The ecology stuff blew my mind." \
  --image /Users/me/drawings/dune.jpg
```

---

### view

Display the user's bookmark collection.

**Filters (optional):**
- `rating:5` - Only 5-star books
- `author:Le Guin` - Books by author (fuzzy match)
- `recent` or `last 5` - Most recent N bookmarks
- `format:audiobook` - By format

**Example Interactions:**

```
User: /bookmarks view

Claude: [runs: python scripts/bookmarks.py view --format pretty]

        📚 Your bookmarks (12 total):

        [⭐⭐⭐⭐⭐] The Left Hand of Darkness
                   by Ursula K. Le Guin | Jan 2026
                   "Made me think about gender and identity..."
                   💭 3 reflections

        [⭐⭐⭐⭐] Dune
                 by Frank Herbert | Dec 2025
                 "Epic worldbuilding, slow start..."
                 💭 1 reflection

        [⭐⭐⭐⭐⭐] Piranesi
                   by Susanna Clarke | Nov 2025
                   "Haunting and beautiful..."
                   💭 2 reflections

        ... and 9 more
```

```
User: /bookmarks view rating:5

Claude: Your 5-star bookmarks (4 total):
        [Shows only 5-star books]
```

```
User: Show me my Le Guin books

Claude: [Interprets as view filter]
        Books by Ursula K. Le Guin (3 total):
        ...
```

---

### update

Add a new reflection to an existing bookmark.

**Key Feature:** Users can reference books by name, not UUID!

**Flow:**
1. User invokes `/bookmarks update` (optionally with book name)
2. If no book specified, show recent bookmarks to choose from
3. User provides new reflection
4. Save using CLI with `--book` flag (fuzzy match) or `--last`

**Example Interactions:**

```
User: /bookmarks update Dune
      Still thinking about the sandworms after watching the movie...

Claude: [runs: python scripts/bookmarks.py update --book "Dune" --reflection "..."]
        ✅ Added reflection to "Dune"
        (Now has 2 reflections)
```

```
User: /bookmarks update
      I keep thinking about that Le Guin book...

Claude: Which bookmark? Your recent ones:
        1. The Left Hand of Darkness - Le Guin (Jan 2026)
        2. Dune - Herbert (Dec 2025)
        3. Piranesi - Clarke (Nov 2025)

        Or did you mean "The Left Hand of Darkness"?

User: yes, that one

Claude: Got it! What's your new reflection?

User: The winter scenes keep coming back to me. Such vivid imagery.

Claude: [runs: python scripts/bookmarks.py update --book "The Left Hand of Darkness" --reflection "..."]
        ✅ Added reflection to "The Left Hand of Darkness"
        (Now has 4 reflections)
```

```
User: Add a note to my last book

Claude: [runs: python scripts/bookmarks.py update --last --reflection "..."]
        Which book was "Piranesi" - adding note there.
        What's your reflection?
```

**CLI Command (internal):**
```bash
# By book name (fuzzy match)
python scripts/bookmarks.py update --book "Dune" --reflection "..."

# By most recent
python scripts/bookmarks.py update --last --reflection "..."

# By UUID (fallback)
python scripts/bookmarks.py update --id <uuid> --reflection "..."
```

---

### stats

Show reading statistics.

**Example:**
```
User: /bookmarks stats

Claude: [runs: python scripts/bookmarks.py stats --format pretty]

        📊 Your Reading Stats

        Total books: 12
        This year: 8
        This month: 2

        Average rating: 4.2 ⭐
        Favorite author: Ursula K. Le Guin (3 books)

        By format:
        📖 Physical: 7
        📱 Ebook: 4
        🎧 Audiobook: 1

        Rating distribution:
        5⭐ ████████ (4)
        4⭐ ██████████ (5)
        3⭐ ████ (2)
        2⭐ ██ (1)
```

---

## CLI Helper Reference

The CLI tool (`scripts/bookmarks.py`) handles database operations:

```bash
# Mint with all options
python scripts/bookmarks.py mint \
  --book "Book Name" \
  --author "Author" \
  --rating 5 \
  --format physical \
  --context "Where I read it" \
  --reflection "My thoughts" \
  --image /path/to/drawing.jpg

# View with filters
python scripts/bookmarks.py view [--filter rating:5] [--limit 10] [--format pretty]

# Update by book name (new!)
python scripts/bookmarks.py update --book "Dune" --reflection "New thoughts"

# Update most recent (new!)
python scripts/bookmarks.py update --last --reflection "New thoughts"

# Update by ID (fallback)
python scripts/bookmarks.py update --id <uuid> --reflection "New thoughts"

# Stats
python scripts/bookmarks.py stats [--format pretty]

# List recent (for selection)
python scripts/bookmarks.py recent --limit 5
```

---

## Web View URLs

After successful operations, include a link to view the collection or bookmark on the web.

**Base URL:** `https://lesezeichnen.vercel.app` (or localhost:3000 for development)

| View | URL Pattern |
|------|-------------|
| User's collection | `/u/{user_id}` |
| Single bookmark | `/b/{bookmark_id}` |

**After mint:**
```
✅ Bookmark created for "Dune"!

View your collection: https://lesezeichnen.vercel.app/u/{user_id}
View this bookmark: https://lesezeichnen.vercel.app/b/{bookmark_id}
```

**After view:**
```
📚 Your bookmarks (12 total):
...

View online: https://lesezeichnen.vercel.app/u/{user_id}
```

**Note:** Get the user_id from the `LESEZEICHNEN_USER_ID` environment variable. Get bookmark_id from the CLI response after mint.

---

## Error Handling

| Situation | Response |
|-----------|----------|
| Supabase not configured | "I can't connect to your bookmark archive. Run `/bookmarks setup` or check your `.env` file." |
| No bookmarks yet | "You haven't created any bookmarks yet! Tell me about a book you've finished." |
| Book not found | "I couldn't find a bookmark matching '[name]'. Your recent books are: [list]" |
| Multiple matches | "I found several books matching '[name]': [list]. Which one?" |
| Image upload failed | "Couldn't upload your drawing. I'll save the bookmark without it - you can add the image later." |

---

## Conversation Tips

1. **Be encouraging** - "Great choice!" / "I love that book too!"
2. **Be concise** - Don't over-explain, users know what they want
3. **Be helpful** - If user is vague, offer specific options
4. **Remember context** - If user mentioned a book earlier, reference it
5. **Celebrate milestones** - "That's your 10th bookmark this year!"
