# Lesezeichnen Implementation Plan

## UX Review Summary

The UX review identified a critical gap: **the PRD promises a conversational AI experience, but the implementation is a CLI tool with explicit flags.** The core value proposition of "tell Claude about your book and it figures out the rest" is not implemented.

---

## Priority Matrix

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **P0** | No AI extraction from natural language | Breaks core value prop | Large |
| **P0** | Separate image upload from mint | Breaks promised UX flow | Medium |
| **P0** | UUID-based bookmark references | Major friction | Small |
| **P1** | Complex manual setup | Onboarding friction | Medium |
| **P1** | JSON-only output | Poor readability | Small |
| **P2** | No search by content | Missing feature | Medium |
| **P2** | No reading goals/streaks | Missing feature | Medium |

---

## P0 Fixes (Critical)

### 1. Natural Language Parsing in Skill

**Problem:** User must specify `--book "Dune" --author "Frank Herbert" --rating 5`
**Promise:** User says "Just finished Dune by Frank Herbert, 5 stars, loved the worldbuilding"

**Solution:** Update SKILL.md to instruct Claude to:
1. Parse free-form text to extract structured fields
2. Use Claude's own understanding to identify book_name, author, rating, context
3. Confirm extracted data with user before saving
4. Fall back to asking clarifying questions if ambiguous

**Files to modify:**
- `.claude/skills/bookmarks/SKILL.md` - Add parsing instructions

**Implementation:**
```markdown
## Parsing Natural Language

When user provides free-form text about a book, extract:
- **book_name**: Look for titles in quotes or capitalized phrases
- **author**: Look for "by [Name]" patterns
- **rating**: Look for "X stars", "X/5", or sentiment words
- **format**: Look for "audiobook", "kindle", "physical", etc.
- **reading_context**: Look for location/time references

Example parsing:
Input: "Just finished Dune by Frank Herbert on my flight to Tokyo. 5 stars!"
Output:
- book_name: "Dune"
- author: "Frank Herbert"
- rating: 5
- reading_context: "flight to Tokyo"

Always confirm with user before saving:
"I'll create a bookmark for:
  Book: Dune
  Author: Frank Herbert
  Rating: 5/5
  Context: Flight to Tokyo

Does this look right?"
```

---

### 2. Unified Mint Flow with Image

**Problem:** Image upload is a separate command after creating the bookmark
**Promise:** Single flow: send photo + description → bookmark created

**Solution:**
1. Accept image path/URL in the mint conversation
2. Auto-detect if user shared an image
3. Upload image first, then create bookmark with media_url

**Files to modify:**
- `.claude/skills/bookmarks/SKILL.md` - Update mint flow
- `scripts/bookmarks.py` - Add `--image` flag to mint command

**New CLI flow:**
```bash
# Single command with image
python scripts/bookmarks.py mint \
  --book "Dune" \
  --image /path/to/drawing.jpg \
  --reflection "Epic worldbuilding"
```

**Skill flow:**
```markdown
### mint (updated)

1. User invokes `/bookmarks mint`
2. User shares image (path or attachment)
3. User describes the book in natural language
4. Claude extracts metadata
5. Claude confirms with user
6. If confirmed:
   a. Upload image to Supabase Storage
   b. Create bookmark record with media_url
   c. Add initial reflection
7. Respond with success message including image preview URL
```

---

### 3. Book Name Lookup Instead of UUID

**Problem:** `--id abc-123-456-789` for updates
**Promise:** "update Dune" or "add note to my last book"

**Solution:**
1. Add fuzzy search by book name
2. Add `--last` flag for most recent bookmark
3. Handle ambiguous matches gracefully

**Files to modify:**
- `scripts/bookmarks.py` - Add name-based lookup
- `.claude/skills/bookmarks/SKILL.md` - Update examples

**New CLI:**
```bash
# By name (fuzzy match)
python scripts/bookmarks.py update --book "Dune" --reflection "..."

# By last bookmark
python scripts/bookmarks.py update --last --reflection "..."

# If ambiguous, show matches
python scripts/bookmarks.py update --book "The"
# Output: Multiple matches found:
#   1. The Left Hand of Darkness (Jan 2026)
#   2. The Dispossessed (Dec 2025)
# Use --id <uuid> to specify, or be more specific.
```

**Implementation in bookmarks.py:**
```python
def find_bookmark_by_name(client, user_id, name):
    """Fuzzy search for bookmark by name."""
    result = client.table("bookmarks") \
        .select("id, book_name, author, created_at") \
        .eq("user_id", user_id) \
        .ilike("book_name", f"%{name}%") \
        .order("created_at", desc=True) \
        .execute()

    return result.data or []
```

---

## P1 Fixes (Major Friction)

### 4. Setup Wizard

**Problem:** 6-step manual setup process
**Solution:** Add `/bookmarks setup` action

**Flow:**
```
User: /bookmarks setup

Claude: Let's set up your bookmark archive!

1. Do you have a Supabase account?
   [Yes] [No, help me create one]

2. [If yes] Please provide your Supabase URL:
   User: https://abc.supabase.co

3. Please provide your anon key:
   User: eyJ...

4. I'll now create the database tables...
   [Runs migration SQL]

5. Creating your user profile...
   [Auto-generates user ID]

Setup complete! Try `/bookmarks mint` to create your first bookmark.
```

---

### 5. Pretty Output Mode

**Problem:** Raw JSON output
**Solution:** Add `--format` flag with `json` (default) and `pretty` options

**Pretty output example:**
```
Your bookmarks (3 total):

[5★] The Left Hand of Darkness
     by Ursula K. Le Guin | Jan 2026
     "Made me think about gender and identity..."
     📎 3 reflections

[4★] Dune
     by Frank Herbert | Dec 2025
     "Epic worldbuilding, slow start..."
     📎 1 reflection

[5★] Piranesi
     by Susanna Clarke | Nov 2025
     "Haunting and beautiful..."
     📎 2 reflections
```

---

## Implementation Order

### Phase 1: Core UX (This PR)

1. **Update SKILL.md with natural language parsing instructions** (30 min)
   - Add parsing guidelines
   - Update example interactions
   - Add confirmation flow

2. **Add `--image` to mint command** (1 hr)
   - Modify mint_bookmark() to accept image path
   - Upload image first, get URL
   - Include media_url in bookmark creation

3. **Add book name lookup** (1 hr)
   - Add find_bookmark_by_name() function
   - Add `--book` and `--last` flags to update command
   - Handle ambiguous matches

### Phase 2: Polish (Next PR)

4. **Add pretty output mode** (30 min)
5. **Add setup wizard to skill** (1 hr)

### Phase 3: Nice to Have (Future)

6. Search by reflection content
7. Reading goals and streaks
8. Shareable stats cards

---

## Testing Checklist

After implementing P0 fixes:

- [ ] Can mint a bookmark with natural language only (no flags)
- [ ] Can mint with image in single command
- [ ] Can update by book name instead of UUID
- [ ] Can update using `--last` flag
- [ ] Ambiguous book names show helpful matches
- [ ] Skill examples in SKILL.md match actual behavior

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `.claude/skills/bookmarks/SKILL.md` | Natural language parsing instructions, updated examples |
| `scripts/bookmarks.py` | `--image` flag, `--book`/`--last` lookup, pretty output |
| `.claude/skills/ux-review/SKILL.md` | New skill (created) |
| `IMPLEMENTATION_PLAN.md` | This file (created) |
