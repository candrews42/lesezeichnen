# Lesezeichnen

**Hand-drawn bookmarks for every book you read, minted as NFTs on Solana.**

Lesezeichnen (German for "bookmark") is a platform for tracking your reading journey through unique, hand-drawn bookmarks. Each bookmark captures your thoughts and artwork for a book, which can then be minted as an NFT on Solana. NFT holders can vote on the next book to read using quadratic voting.

## Features

- **Telegram Bot**: Submit bookmark photos and manage your collection
- **AI Analysis**: Automatically extract book title, author, and your thoughts from bookmark images
- **Book Lookup**: Fetch book details from Open Library API
- **NFT Minting**: Mint bookmarks as Solana NFTs using Metaplex
- **Quadratic Voting**: NFT holders get 42 votes per bookmark to vote on next reads
- **Web Interface**: Browse bookmarks and participate in voting

## Project Structure

```
lesezeichnen/
├── packages/
│   ├── bot/          # Telegram bot
│   ├── web/          # Next.js web UI (Vercel)
│   ├── shared/       # Shared types and utilities
│   └── contracts/    # Solana programs (future)
├── supabase/         # Database migrations
├── skills/           # SKILL.md for AI assistants
└── archive/          # Previous NEAR blockchain implementation
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase account
- Telegram Bot Token (from @BotFather)
- OpenRouter API key
- Solana wallet with SOL (devnet for testing)

### Setup

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/candrews42/lesezeichnen.git
   cd lesezeichnen
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up Supabase**:
   - Create a new Supabase project
   - Run the migration in `supabase/migrations/001_initial_schema.sql`
   - Create a storage bucket called "bookmarks"

4. **Generate Solana authority keypair**:
   ```bash
   solana-keygen new --outfile authority.json
   # Copy the array to SOLANA_AUTHORITY_SECRET in .env
   ```

5. **Build and run**:
   ```bash
   # Build all packages
   npm run build

   # Run the Telegram bot
   npm run bot

   # Run the web UI (separate terminal)
   npm run web
   ```

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Register and get started |
| `/newbookmark` | Add a new bookmark (front & back photos) |
| `/mybookmarks` | View your collection |
| `/stats` | See reading statistics |
| `/connectwallet <address>` | Link your Solana wallet |
| `/mint [id]` | Mint a bookmark as NFT |
| `/vote [option] [count]` | Cast votes on next book |
| `/votestatus` | See voting results |
| `/suggestbook Title by Author` | Suggest a book for voting |

## Quadratic Voting

Each NFT grants 42 voting power. Votes cost quadratically:
- 1 vote = 1 cost
- 2 votes = 4 cost
- 3 votes = 9 cost
- 4 votes = 16 cost

This prevents any single voter from dominating while allowing strong preferences to be expressed.

## Deployment

### Web (Vercel)

```bash
cd packages/web
vercel deploy
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SOLANA_RPC_URL`

### Bot (Docker)

```bash
docker-compose up -d
```

Or deploy to Railway, Fly.io, or any Docker host.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI |
| `GOOGLE_BOOKS_API_KEY` | (Optional) Google Books API key |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `SOLANA_AUTHORITY_SECRET` | Minting authority keypair (JSON array) |

## Tech Stack

- **Bot**: Node.js, grammy, TypeScript
- **Web**: Next.js 15, React 19, TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter (Gemini 2.0 Flash)
- **Blockchain**: Solana, Metaplex
- **Book Data**: Open Library API

## API Integrations

### OpenRouter (AI)
Used for analyzing bookmark images to extract:
- Book title and author (from front)
- Reader's thoughts and quotes (from back)

### Open Library
Free API for book metadata:
- ISBN lookup
- Title/author search
- Cover images
- Publication details

### Solana/Metaplex
NFT minting with:
- Standard metadata format
- 5% creator royalty
- Devnet for testing, mainnet for production

## License

MIT

## Links

- Website: https://lesezeichnen.vercel.app
- Telegram Bot: https://t.me/lesezeichnen_bot
- GitHub: https://github.com/candrews42/lesezeichnen
