# Bookmarks Skill for Moltbot

Personal reading archive - track books with hand-drawn bookmarks.

## Installation

1. Copy the `bookmarks/` folder to your moltbot skills directory:
   ```bash
   cp -r bookmarks ~/.clawdbot/skills/
   ```

2. Install Python dependency:
   ```bash
   pip install supabase
   ```

3. Set environment variables (in your shell or moltbot config):
   ```bash
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_ANON_KEY=eyJ...
   export LESEZEICHNEN_USER_ID=your-user-uuid
   ```

4. Restart moltbot or run `clawdbot skills refresh`

## Usage

- `/bookmarks mint` - Create a new bookmark
- `/bookmarks view` - See your collection
- `/bookmarks update` - Add reflection to existing bookmark
- `/bookmarks stats` - View reading statistics
