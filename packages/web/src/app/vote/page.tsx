import { createClient } from '@/lib/supabase-server';
import { VotingInterface } from '@/components/VotingInterface';
import { VOTES_PER_NFT } from '@lesezeichnen/shared';

export const revalidate = 30;

async function getVoteData() {
  const supabase = createClient();

  // Get active options
  const { data: options } = await supabase
    .from('vote_options')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Get all votes
  const { data: votes } = await supabase
    .from('votes')
    .select('option_id, vote_count, voter_wallet');

  // Calculate tallies
  const tallies: Record<string, { votes: number; voters: number }> = {};
  const votersByOption: Record<string, Set<string>> = {};

  for (const vote of votes || []) {
    if (!tallies[vote.option_id]) {
      tallies[vote.option_id] = { votes: 0, voters: 0 };
      votersByOption[vote.option_id] = new Set();
    }
    tallies[vote.option_id].votes += vote.vote_count;
    votersByOption[vote.option_id].add(vote.voter_wallet);
  }

  // Update voter counts
  for (const [optionId, voters] of Object.entries(votersByOption)) {
    tallies[optionId].voters = voters.size;
  }

  return {
    options: options || [],
    tallies,
  };
}

export default async function VotePage() {
  const { options, tallies } = await getVoteData();

  const totalVotes = Object.values(tallies).reduce((sum, t) => sum + t.votes, 0);
  const maxVotes = Math.max(...Object.values(tallies).map(t => t.votes), 1);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold mb-4">
          Vote on the Next Book
        </h1>
        <p className="text-primary-600 max-w-xl mx-auto mb-4">
          NFT holders can vote on which book should be read next.
          Each NFT grants {VOTES_PER_NFT} votes to spend using quadratic voting.
        </p>
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm">
          <span className="font-semibold">{totalVotes}</span> votes cast
        </div>
      </div>

      {options.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-primary-500 text-lg mb-4">
            No books are up for voting yet.
          </p>
          <p className="text-primary-400 text-sm">
            Suggest a book via the Telegram bot with /suggestbook
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {options
            .sort((a, b) => (tallies[b.id]?.votes || 0) - (tallies[a.id]?.votes || 0))
            .map((option, index) => {
              const tally = tallies[option.id] || { votes: 0, voters: 0 };
              const percentage = maxVotes > 0 ? (tally.votes / maxVotes) * 100 : 0;

              return (
                <div key={option.id} className="card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-primary-300">
                          #{index + 1}
                        </span>
                        <div>
                          <h3 className="font-semibold text-lg">{option.title}</h3>
                          <p className="text-primary-600 text-sm">by {option.author}</p>
                        </div>
                      </div>
                      {option.description && (
                        <p className="text-primary-500 text-sm mt-2 ml-10">
                          {option.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-700">
                        {tally.votes}
                      </div>
                      <div className="text-xs text-primary-500">
                        {tally.voters} voter{tally.voters !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="relative h-4 bg-primary-100 rounded-full overflow-hidden">
                    <div
                      className="vote-bar absolute left-0 top-0 h-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {option.suggested_by && (
                    <p className="text-xs text-primary-400 mt-3">
                      Suggested by @{option.suggested_by}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Voting Interface */}
      <VotingInterface options={options} />

      {/* Quadratic Voting Explanation */}
      <div className="card p-6 mt-8 bg-gradient-to-br from-primary-50 to-bookmark-paper">
        <h3 className="font-semibold text-lg mb-4">How Quadratic Voting Works</h3>
        <p className="text-primary-600 text-sm mb-4">
          Quadratic voting gives more influence to those with strong preferences while
          preventing dominance by any single voter.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[1, 2, 3, 4].map((votes) => (
            <div key={votes} className="bg-white rounded-lg p-3">
              <div className="text-xl font-bold text-primary-700">{votes} vote{votes > 1 ? 's' : ''}</div>
              <div className="text-sm text-primary-500">costs {votes * votes}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-primary-400 mt-4 text-center">
          Each NFT grants {VOTES_PER_NFT} voting power to spend
        </p>
      </div>
    </div>
  );
}
