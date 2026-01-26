import { Context } from 'grammy';
import { getSupabaseAdmin } from '@lesezeichnen/shared';

export async function handleStart(ctx: Context) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;

  if (telegramId) {
    // Create or update user
    await supabase
      .from('users')
      .upsert({
        telegram_id: telegramId,
        telegram_username: username,
      }, {
        onConflict: 'telegram_id',
      });
  }

  await ctx.reply(
`Welcome to Lesezeichnen - Your Book Bookmark NFT Collection!

I help you track every book you read with beautiful hand-drawn bookmarks.

Here's what I can do:

**Bookmark Management**
/newbookmark - Add a new bookmark (front & back images)
/mybookmarks - View your bookmark collection
/stats - See your reading statistics

**NFT & Wallet**
/connectwallet - Link your Solana wallet
/mint - Mint a bookmark as an NFT

**Voting** (NFT holders only)
/vote - Vote on the next book to read
/votestatus - See current voting results
/suggestbook - Suggest a book for voting

Send me photos of your bookmarks to get started!`
  );
}

export async function handleHelp(ctx: Context) {
  await ctx.reply(
`**Lesezeichnen Help**

**Adding a Bookmark:**
1. Use /newbookmark to start
2. Send a photo of the front (artwork side)
3. Send a photo of the back (your thoughts)
4. I'll analyze the images with AI
5. Confirm or edit the extracted info

**Bookmark Info Tracked:**
- Book title & author (from image + lookup)
- Your rating (1-5 stars)
- Format (physical/ebook/audiobook)
- Who recommended it
- Where you started/finished reading
- Date read & date drawn
- Your thoughts & favorite quotes

**NFT Minting:**
- Each bookmark can become a Solana NFT
- Connect your wallet with /connectwallet
- Use /mint to create the NFT

**Quadratic Voting:**
- NFT holders get 42 votes per bookmark
- Votes cost quadratically (1 vote = 1, 2 votes = 4, etc.)
- Vote on what I should read next!

Questions? Issues? Visit: github.com/candrews42/lesezeichnen`
  );
}
