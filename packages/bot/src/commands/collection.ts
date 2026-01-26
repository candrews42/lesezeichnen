import { Context, SessionFlavor } from 'grammy';
import { getSupabaseAdmin, formatRating } from '@lesezeichnen/shared';
import { SessionData } from '../session.js';

type MyContext = Context & SessionFlavor<SessionData>;

export async function handleMyBookmarks(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Could not identify you.');
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select(`
      *,
      book:books(title, author)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    await ctx.reply('Failed to fetch bookmarks. Please try again.');
    return;
  }

  if (!bookmarks || bookmarks.length === 0) {
    await ctx.reply(
      'You don\'t have any bookmarks yet!\n\nUse /newbookmark to add your first bookmark.'
    );
    return;
  }

  let message = `**Your Bookmark Collection** (${bookmarks.length} shown)\n\n`;

  for (const bookmark of bookmarks) {
    const book = bookmark.book as { title: string; author: string } | null;
    const title = book?.title || 'Unknown Title';
    const author = book?.author || 'Unknown Author';
    const rating = bookmark.rating ? formatRating(bookmark.rating) : 'Not rated';
    const nftStatus = bookmark.nft_minted ? 'NFT Minted' : 'Not minted';

    message += `**${title}**\n`;
    message += `by ${author}\n`;
    message += `${rating} | ${bookmark.format || 'Unknown format'} | ${nftStatus}\n`;
    message += `ID: \`${bookmark.id.substring(0, 8)}\`\n\n`;
  }

  message += 'Use /mint <id> to mint a bookmark as NFT';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleStats(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Could not identify you.');
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  // Get bookmark stats
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('rating, format, nft_minted, date_finished')
    .eq('user_id', user.id);

  if (!bookmarks || bookmarks.length === 0) {
    await ctx.reply('You don\'t have any bookmarks yet to show stats.');
    return;
  }

  const totalBooks = bookmarks.length;
  const nftsMinted = bookmarks.filter(b => b.nft_minted).length;
  const avgRating = bookmarks.reduce((sum, b) => sum + (b.rating || 0), 0) / bookmarks.filter(b => b.rating).length;

  // Format breakdown
  const formatCounts: Record<string, number> = {};
  for (const b of bookmarks) {
    const format = b.format || 'unknown';
    formatCounts[format] = (formatCounts[format] || 0) + 1;
  }

  // Rating distribution
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const b of bookmarks) {
    if (b.rating) {
      ratingCounts[b.rating] = (ratingCounts[b.rating] || 0) + 1;
    }
  }

  // Books this year
  const thisYear = new Date().getFullYear();
  const booksThisYear = bookmarks.filter(b => {
    if (!b.date_finished) return false;
    return new Date(b.date_finished).getFullYear() === thisYear;
  }).length;

  let message = `**Your Reading Stats**\n\n`;
  message += `**Total Books:** ${totalBooks}\n`;
  message += `**Books This Year:** ${booksThisYear}\n`;
  message += `**NFTs Minted:** ${nftsMinted}\n`;
  message += `**Average Rating:** ${avgRating.toFixed(1)} / 5\n\n`;

  message += `**By Format:**\n`;
  for (const [format, count] of Object.entries(formatCounts)) {
    message += `  ${format}: ${count}\n`;
  }

  message += `\n**Rating Distribution:**\n`;
  for (let i = 5; i >= 1; i--) {
    const count = ratingCounts[i] || 0;
    const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, 10 - count));
    message += `  ${i}★ ${bar} ${count}\n`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
