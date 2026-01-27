---
name: ux-review
description: Simulate ICP user testing and focus groups for UX evaluation
allowed-tools: [Read, Glob, Grep, Task]
---

# /ux-review - ICP User Testing & Focus Groups

Simulate user testing sessions with Ideal Customer Profile (ICP) personas to evaluate UX against product requirements.

## When to Use

- Before releasing a feature
- After implementing a new user flow
- When PRD promises don't match implementation
- To identify friction points and gaps
- To prioritize UX improvements

## Actions

### `/ux-review` (default)

Run a full UX review against the PRD.

**What it does:**
1. Reads PRD.md to understand promised user experience
2. Reads implementation files (skills, scripts, UI)
3. Creates 3-4 ICP personas relevant to the product
4. Simulates each persona walking through user journeys
5. Identifies gaps, friction points, and broken promises
6. Prioritizes issues (P0/P1/P2)
7. Outputs actionable recommendations

### `/ux-review personas`

Generate ICP personas for a product without running full review.

### `/ux-review journey <journey_name>`

Test a specific user journey (e.g., "onboarding", "first purchase", "returning user").

### `/ux-review compare`

Compare PRD promises vs actual implementation, highlighting gaps.

---

## How to Run a UX Review

### Step 1: Gather Context

Read these files (if they exist):
- `PRD.md` - Product requirements and user journeys
- `CLAUDE.md` - Developer documentation
- Skill files (`.claude/skills/*/SKILL.md`)
- UI/Frontend code
- API/Backend code

### Step 2: Define ICP Personas

Create 3-4 personas that represent your ideal users. Each persona should have:

```
| Attribute | Description |
|-----------|-------------|
| Name & Age | Human identifier |
| Role/Occupation | What they do |
| Technical Level | Novice / Intermediate / Expert |
| Primary Goal | What they want to achieve |
| Pain Points | Current frustrations |
| Context | When/where they use the product |
```

**Example Personas by Product Type:**

**Developer Tool:**
- Senior engineer at startup (power user, CLI-native)
- Junior developer learning (needs guidance, prefers GUI)
- DevOps engineer (automation-focused, scripts everything)

**Consumer App:**
- Power user (uses daily, knows shortcuts)
- Casual user (uses occasionally, forgets between sessions)
- New user (first time, needs onboarding)

**B2B SaaS:**
- Decision maker (evaluating, needs ROI proof)
- End user (daily operator, cares about efficiency)
- Admin (setup/config, cares about security)

### Step 3: Walk Through User Journeys

For each journey in the PRD:

1. **Identify the journey** (e.g., "First-time setup", "Create a bookmark")
2. **List the steps** as documented in PRD
3. **For each persona**, simulate:
   - What they would try to do
   - What actually happens in the implementation
   - Where they get confused or stuck
   - What's missing vs PRD promise

### Step 4: Document Findings

Use this format for each issue:

```markdown
| Tester | Pain Point | Severity |
|--------|------------|----------|
| [Persona] | "[Quote about the problem]" | HIGH/MEDIUM/LOW |
```

### Step 5: Prioritize

**P0 - Critical (breaks core value prop):**
- Feature doesn't work as promised
- Core user journey is blocked
- Major gap between PRD and implementation

**P1 - Major (significant friction):**
- Requires workarounds
- Confusing UX
- Missing expected functionality

**P2 - Minor (nice to have):**
- Polish issues
- Enhancement requests
- Edge cases

### Step 6: Create Action Plan

Output a prioritized list of fixes with:
- What to change
- Why it matters
- Estimated complexity (S/M/L)

---

## Output Format

```markdown
## UX Review: [Product Name]

### ICP Personas
[Table of personas]

### User Journey: [Journey Name]

#### PRD Promise
[What the PRD says should happen]

#### Current Reality
[What actually happens]

#### Persona Feedback
[Table of pain points by persona]

#### Recommendations
[Numbered list of fixes]

### Gap Summary
[Table: Gap | PRD Promise | Current Reality | Priority]

### Implementation Plan
[Prioritized action items]
```

---

## Example Usage

```
User: /ux-review

Claude: I'll run a UX review for this project.

[Reads PRD.md, SKILL.md, implementation files]

## UX Review: Lesezeichnen

### ICP Personas

| Persona | Description |
|---------|-------------|
| Maya (32) | Librarian, reads 50+ books/year, loves analog + digital |
| Carlos (28) | Software engineer, audiobook listener, uses Notion |
| Priya (41) | Book club organizer, sketches casually |
| Jasper (24) | Art student, creates illustrated journals |

### User Journey: First Bookmark

#### PRD Promise
> User sends photo + natural language description
> Claude extracts metadata automatically
> Bookmark created with drawing attached

#### Current Reality
- User must use CLI with explicit flags
- Image upload is separate command
- No AI extraction of metadata

#### Persona Feedback
| Tester | Pain Point | Severity |
|--------|------------|----------|
| Maya | "PRD shows conversation, but I get CLI flags?" | CRITICAL |
| Jasper | "Where's the photo upload in mint?" | CRITICAL |

...

### Implementation Plan

**P0 - Must Fix:**
1. Add natural language parsing (L)
2. Unified mint + image flow (M)
3. Book name lookup vs UUID (S)

**P1 - Should Fix:**
4. Setup wizard (M)
5. Pretty output mode (S)
```

---

## Tips

1. **Be the user, not the developer** - Don't excuse poor UX because you know how it works
2. **Quote the personas** - Makes feedback tangible and memorable
3. **Compare to PRD literally** - If PRD says "just say X", does it work?
4. **Prioritize ruthlessly** - P0 = blocks core value, not just "would be nice"
5. **Action over observation** - Every finding should have a recommended fix

---

## Moving to Global Skills

To make this skill available across all projects, copy it to your global skills:

```bash
cp -r .claude/skills/ux-review ~/.claude/skills/
```
