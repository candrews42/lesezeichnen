import { Context, SessionFlavor } from 'grammy';
import { getSupabaseAdmin, VOTES_PER_NFT, calculateQuadraticVoteCost, calculateMaxVotes } from '@lesezeichnen/shared';
import { SessionData } from '../session.js';
import { getWalletNFTs } from '../services/solana.js';

type MyContext = Context & SessionFlavor<SessionData>;

export async function handleVote(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;
  const args = ctx.message?.text?.split(' ').slice(1);

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

  if (!user || !user.wallet_address) {
    await ctx.reply('Please connect your wallet first with /connectwallet');
    return;
  }

  // Get user's NFTs and voting power
  const { data: ownedNfts } = await supabase
    .from('nft_ownership')
    .select('mint_address')
    .eq('owner_wallet', user.wallet_address);

  if (!ownedNfts || ownedNfts.length === 0) {
    await ctx.reply(
      'You need to own at least one Lesezeichnen NFT to vote.\n\nUse /mint to create one from your bookmarks!'
    );
    return;
  }

  const totalVotingPower = ownedNfts.length * VOTES_PER_NFT;

  // Get votes already cast
  const { data: existingVotes } = await supabase
    .from('votes')
    .select('votes_spent')
    .eq('voter_wallet', user.wallet_address);

  const votesUsed = existingVotes?.reduce((sum, v) => sum + v.votes_spent, 0) || 0;
  const votesRemaining = totalVotingPower - votesUsed;

  // Get active vote options
  const { data: options } = await supabase
    .from('vote_options')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!options || options.length === 0) {
    await ctx.reply('There are no active voting options right now. Use /suggestbook to add one!');
    return;
  }

  // If no args, show options
  if (!args || args.length < 2) {
    // Get vote tallies
    const { data: allVotes } = await supabase
      .from('votes')
      .select('option_id, vote_count');

    const tallies: Record<string, number> = {};
    for (const vote of allVotes || []) {
      tallies[vote.option_id] = (tallies[vote.option_id] || 0) + vote.vote_count;
    }

    let message = '**Vote on the Next Book!**\n\n';
    message += `Your voting power: **${votesRemaining}** / ${totalVotingPower} votes remaining\n`;
    message += `(${ownedNfts.length} NFTs × ${VOTES_PER_NFT} votes each)\n\n`;
    message += '**Current Options:**\n\n';

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const votes = tallies[opt.id] || 0;
      message += `**${i + 1}.** ${opt.title} by ${opt.author}\n`;
      message += `   Votes: ${votes} | Suggested by: ${opt.suggested_by || 'Anonymous'}\n\n`;
    }

    message += '---\n';
    message += '**To vote:** /vote <number> <vote_count>\n';
    message += 'Example: /vote 1 3 (costs 9 votes for 3 vote weight)\n\n';
    message += 'Remember: Quadratic voting means:\n';
    message += '• 1 vote = 1 cost\n';
    message += '• 2 votes = 4 cost\n';
    message += '• 3 votes = 9 cost\n';

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  // Parse vote
  const optionNum = parseInt(args[0]) - 1;
  const voteCount = parseInt(args[1]);

  if (isNaN(optionNum) || optionNum < 0 || optionNum >= options.length) {
    await ctx.reply('Invalid option number. Use /vote to see available options.');
    return;
  }

  if (isNaN(voteCount) || voteCount < 1) {
    await ctx.reply('Please specify a valid number of votes (minimum 1).');
    return;
  }

  const voteCost = calculateQuadraticVoteCost(voteCount);

  if (voteCost > votesRemaining) {
    const maxVotes = calculateMaxVotes(votesRemaining);
    await ctx.reply(
      `You don't have enough voting power!\n\n` +
      `Requested: ${voteCount} votes (costs ${voteCost})\n` +
      `Available: ${votesRemaining} votes\n` +
      `Maximum votes you can cast: ${maxVotes}`
    );
    return;
  }

  const selectedOption = options[optionNum];

  // Check if already voted for this option
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('option_id', selectedOption.id)
    .eq('voter_wallet', user.wallet_address)
    .single();

  if (existingVote) {
    // Update existing vote
    const newVoteCount = existingVote.vote_count + voteCount;
    const newVotesSpent = existingVote.votes_spent + voteCost;

    await supabase
      .from('votes')
      .update({
        vote_count: newVoteCount,
        votes_spent: newVotesSpent,
      })
      .eq('id', existingVote.id);

    await ctx.reply(
      `Vote added!\n\n` +
      `**${selectedOption.title}** by ${selectedOption.author}\n` +
      `Your total votes for this book: ${newVoteCount}\n` +
      `Total spent on this book: ${newVotesSpent}\n` +
      `Remaining voting power: ${votesRemaining - voteCost}`
    );
  } else {
    // Create new vote (use first NFT as reference)
    await supabase
      .from('votes')
      .insert({
        option_id: selectedOption.id,
        voter_wallet: user.wallet_address,
        nft_mint_address: ownedNfts[0].mint_address,
        vote_count: voteCount,
        votes_spent: voteCost,
      });

    await ctx.reply(
      `Vote cast!\n\n` +
      `**${selectedOption.title}** by ${selectedOption.author}\n` +
      `Votes: ${voteCount} (cost: ${voteCost})\n` +
      `Remaining voting power: ${votesRemaining - voteCost}`
    );
  }
}

export async function handleVoteStatus(ctx: MyContext) {
  const supabase = getSupabaseAdmin();

  // Get active options with vote counts
  const { data: options } = await supabase
    .from('vote_options')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!options || options.length === 0) {
    await ctx.reply('No active voting options.');
    return;
  }

  // Get all votes
  const { data: allVotes } = await supabase
    .from('votes')
    .select('option_id, vote_count, voter_wallet');

  const tallies: Record<string, { votes: number; voters: Set<string> }> = {};
  for (const vote of allVotes || []) {
    if (!tallies[vote.option_id]) {
      tallies[vote.option_id] = { votes: 0, voters: new Set() };
    }
    tallies[vote.option_id].votes += vote.vote_count;
    tallies[vote.option_id].voters.add(vote.voter_wallet);
  }

  // Sort by votes
  const sortedOptions = [...options].sort((a, b) => {
    const votesA = tallies[a.id]?.votes || 0;
    const votesB = tallies[b.id]?.votes || 0;
    return votesB - votesA;
  });

  let message = '**Current Voting Results**\n\n';

  const maxVotes = Math.max(...sortedOptions.map(o => tallies[o.id]?.votes || 0), 1);

  for (let i = 0; i < sortedOptions.length; i++) {
    const opt = sortedOptions[i];
    const data = tallies[opt.id] || { votes: 0, voters: new Set() };
    const barLength = Math.round((data.votes / maxVotes) * 20);
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);

    message += `**${i + 1}. ${opt.title}**\n`;
    message += `   by ${opt.author}\n`;
    message += `   ${bar} ${data.votes} votes (${data.voters.size} voters)\n\n`;
  }

  message += 'Use /vote to participate!';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleSuggestBook(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;
  const args = ctx.message?.text?.split(' ').slice(1).join(' ');

  if (!telegramId) {
    await ctx.reply('Could not identify you.');
    return;
  }

  if (!args) {
    ctx.session.state = 'awaiting_suggestion';
    await ctx.reply(
`**Suggest a Book for Voting**

Please provide the book details in this format:
\`Title by Author\`

Example: \`The Name of the Wind by Patrick Rothfuss\``
    );
    return;
  }

  // Parse "Title by Author" format
  const match = args.match(/^(.+?)\s+by\s+(.+)$/i);

  if (!match) {
    await ctx.reply(
      'Please use the format: `Title by Author`\n\nExample: `The Name of the Wind by Patrick Rothfuss`'
    );
    return;
  }

  const [, title, author] = match;

  // Get user info for suggested_by
  const { data: user } = await supabase
    .from('users')
    .select('telegram_username')
    .eq('telegram_id', telegramId)
    .single();

  const suggestedBy = user?.telegram_username || `user_${telegramId}`;

  // Create vote option
  const { data: option, error } = await supabase
    .from('vote_options')
    .insert({
      title: title.trim(),
      author: author.trim(),
      suggested_by: suggestedBy,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    await ctx.reply('Failed to add book suggestion. Please try again.');
    return;
  }

  await ctx.reply(
`Book suggestion added!

**${title}** by ${author}

This book is now available for voting. Use /vote to see all options!`
  );
}
