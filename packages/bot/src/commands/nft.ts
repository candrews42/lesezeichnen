import { Context, SessionFlavor } from 'grammy';
import { getSupabaseAdmin, VOTES_PER_NFT } from '@lesezeichnen/shared';
import { SessionData } from '../session.js';
import { mintBookmarkNFT, getWalletNFTs } from '../services/solana.js';

type MyContext = Context & SessionFlavor<SessionData>;

export async function handleConnectWallet(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;
  const args = ctx.message?.text?.split(' ').slice(1);
  const walletAddress = args?.[0];

  if (!telegramId) {
    await ctx.reply('Could not identify you.');
    return;
  }

  if (!walletAddress) {
    ctx.session.state = 'awaiting_wallet';
    await ctx.reply(
`**Connect Your Solana Wallet**

Please send your Solana wallet address (public key).

This will allow you to:
- Mint your bookmarks as NFTs
- Vote on the next book to read
- Receive ${VOTES_PER_NFT} voting power per NFT

Example: \`7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\``
    );
    return;
  }

  // Validate wallet address format (basic check)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    await ctx.reply('Invalid Solana wallet address format. Please try again.');
    return;
  }

  // Update user's wallet
  const { error } = await supabase
    .from('users')
    .update({ wallet_address: walletAddress })
    .eq('telegram_id', telegramId);

  if (error) {
    await ctx.reply('Failed to save wallet address. Please try again.');
    return;
  }

  await ctx.reply(
`Wallet connected successfully!

**Address:** \`${walletAddress}\`

You can now:
- Use /mint to create bookmark NFTs
- Use /vote to participate in book voting`
  );
}

export async function handleMintNFT(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;
  const args = ctx.message?.text?.split(' ').slice(1);
  const bookmarkId = args?.[0];

  if (!telegramId) {
    await ctx.reply('Could not identify you.');
    return;
  }

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, wallet_address')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  if (!user.wallet_address) {
    await ctx.reply(
      'Please connect your Solana wallet first with /connectwallet'
    );
    return;
  }

  // If no bookmark ID provided, list available bookmarks
  if (!bookmarkId) {
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select(`
        id,
        nft_minted,
        book:books(title, author)
      `)
      .eq('user_id', user.id)
      .eq('nft_minted', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!bookmarks || bookmarks.length === 0) {
      await ctx.reply(
        'You don\'t have any unminted bookmarks. Use /newbookmark to add one!'
      );
      return;
    }

    let message = '**Select a bookmark to mint as NFT:**\n\n';
    for (const bookmark of bookmarks) {
      const book = bookmark.book as { title: string; author: string } | null;
      message += `\`${bookmark.id.substring(0, 8)}\` - ${book?.title || 'Unknown'} by ${book?.author || 'Unknown'}\n`;
    }
    message += '\nUse: /mint <id>';

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  // Find the bookmark
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select(`
      *,
      book:books(*)
    `)
    .eq('user_id', user.id)
    .ilike('id', `${bookmarkId}%`)
    .limit(1);

  const bookmark = bookmarks?.[0];

  if (!bookmark) {
    await ctx.reply('Bookmark not found. Use /mybookmarks to see your collection.');
    return;
  }

  if (bookmark.nft_minted) {
    await ctx.reply(
      `This bookmark has already been minted!\n\nMint address: \`${bookmark.nft_mint_address}\``
    );
    return;
  }

  await ctx.reply('Minting your bookmark as an NFT on Solana...');

  try {
    const book = bookmark.book as { title: string; author: string; description?: string } | null;

    const result = await mintBookmarkNFT({
      ownerWallet: user.wallet_address,
      bookTitle: book?.title || 'Unknown Book',
      bookAuthor: book?.author || 'Unknown Author',
      frontImageUrl: bookmark.front_image_url,
      backImageUrl: bookmark.back_image_url,
      rating: bookmark.rating,
      thoughts: bookmark.thoughts,
      bookmarkId: bookmark.id,
    });

    // Update bookmark with NFT info
    await supabase
      .from('bookmarks')
      .update({
        nft_minted: true,
        nft_mint_address: result.mintAddress,
        nft_metadata_uri: result.metadataUri,
      })
      .eq('id', bookmark.id);

    // Add to NFT ownership cache
    await supabase
      .from('nft_ownership')
      .upsert({
        mint_address: result.mintAddress,
        owner_wallet: user.wallet_address,
        bookmark_id: bookmark.id,
      });

    await ctx.reply(
`NFT Minted Successfully!

**${book?.title}** by ${book?.author}

**Mint Address:**
\`${result.mintAddress}\`

**Metadata:**
${result.metadataUri}

You now have ${VOTES_PER_NFT} voting power from this NFT!
Use /vote to participate in book voting.

View on Solscan: https://solscan.io/token/${result.mintAddress}`
    );

  } catch (error) {
    console.error('Minting failed:', error);
    await ctx.reply(
      `Minting failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`
    );
  }
}
