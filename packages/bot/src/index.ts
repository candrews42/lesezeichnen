import { Bot, Context, session, SessionFlavor } from 'grammy';
import { getSupabaseAdmin } from '@lesezeichnen/shared';
import { handleStart, handleHelp } from './commands/basic.js';
import { handleNewBookmark, handlePhoto, handleText } from './commands/bookmark.js';
import { handleMyBookmarks, handleStats } from './commands/collection.js';
import { handleMintNFT, handleConnectWallet } from './commands/nft.js';
import { handleVote, handleVoteStatus, handleSuggestBook } from './commands/voting.js';
import { SessionData, getInitialSessionData } from './session.js';

type MyContext = Context & SessionFlavor<SessionData>;

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }

  // Verify Supabase connection
  const supabase = getSupabaseAdmin();
  console.log('Connected to Supabase');

  const bot = new Bot<MyContext>(token);

  // Session middleware
  bot.use(session({
    initial: getInitialSessionData,
  }));

  // Basic commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);

  // Bookmark management
  bot.command('newbookmark', handleNewBookmark);
  bot.command('mybookmarks', handleMyBookmarks);
  bot.command('stats', handleStats);

  // NFT commands
  bot.command('mint', handleMintNFT);
  bot.command('connectwallet', handleConnectWallet);

  // Voting commands
  bot.command('vote', handleVote);
  bot.command('votestatus', handleVoteStatus);
  bot.command('suggestbook', handleSuggestBook);

  // Handle photos (bookmark images)
  bot.on('message:photo', handlePhoto);

  // Handle text messages (for multi-step conversations)
  bot.on('message:text', handleText);

  // Error handling
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  console.log('Starting Lesezeichnen bot...');
  await bot.start();
}

main().catch(console.error);
