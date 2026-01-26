'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getSupabase } from '@/lib/supabase-client';
import { VOTES_PER_NFT, calculateQuadraticVoteCost, calculateMaxVotes } from '@lesezeichnen/shared';

interface VoteOption {
  id: string;
  title: string;
  author: string;
}

interface VotingInterfaceProps {
  options: VoteOption[];
}

export function VotingInterface({ options }: VotingInterfaceProps) {
  const { publicKey, connected } = useWallet();
  const [votingPower, setVotingPower] = useState({ total: 0, used: 0, remaining: 0 });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [voteCount, setVoteCount] = useState(1);
  const [isVoting, setIsVoting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      loadVotingPower();
    } else {
      setVotingPower({ total: 0, used: 0, remaining: 0 });
    }
  }, [connected, publicKey]);

  async function loadVotingPower() {
    if (!publicKey) return;

    const supabase = getSupabase();
    const wallet = publicKey.toBase58();

    // Get NFTs owned
    const { data: nfts } = await supabase
      .from('nft_ownership')
      .select('mint_address')
      .eq('owner_wallet', wallet);

    const nftCount = nfts?.length || 0;
    const total = nftCount * VOTES_PER_NFT;

    // Get votes used
    const { data: votes } = await supabase
      .from('votes')
      .select('votes_spent')
      .eq('voter_wallet', wallet);

    const used = votes?.reduce((sum, v) => sum + v.votes_spent, 0) || 0;

    setVotingPower({
      total,
      used,
      remaining: total - used,
    });
  }

  async function handleVote() {
    if (!publicKey || !selectedOption || voteCount < 1) return;

    const cost = calculateQuadraticVoteCost(voteCount);
    if (cost > votingPower.remaining) {
      setMessage({ type: 'error', text: 'Not enough voting power!' });
      return;
    }

    setIsVoting(true);
    setMessage(null);

    try {
      const supabase = getSupabase();
      const wallet = publicKey.toBase58();

      // Get user's first NFT for the vote record
      const { data: nfts } = await supabase
        .from('nft_ownership')
        .select('mint_address')
        .eq('owner_wallet', wallet)
        .limit(1);

      if (!nfts || nfts.length === 0) {
        throw new Error('No NFTs found');
      }

      // Check for existing vote
      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('option_id', selectedOption)
        .eq('voter_wallet', wallet)
        .single();

      if (existingVote) {
        // Update existing vote
        await supabase
          .from('votes')
          .update({
            vote_count: existingVote.vote_count + voteCount,
            votes_spent: existingVote.votes_spent + cost,
          })
          .eq('id', existingVote.id);
      } else {
        // Create new vote
        await supabase.from('votes').insert({
          option_id: selectedOption,
          voter_wallet: wallet,
          nft_mint_address: nfts[0].mint_address,
          vote_count: voteCount,
          votes_spent: cost,
        });
      }

      setMessage({ type: 'success', text: `Successfully cast ${voteCount} vote(s)!` });
      setSelectedOption(null);
      setVoteCount(1);
      loadVotingPower();

      // Trigger page refresh after a delay
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error('Voting failed:', error);
      setMessage({ type: 'error', text: 'Failed to cast vote. Please try again.' });
    } finally {
      setIsVoting(false);
    }
  }

  if (!connected) {
    return (
      <div className="card p-6 mt-8 text-center">
        <h3 className="font-semibold text-lg mb-2">Connect Wallet to Vote</h3>
        <p className="text-primary-500 text-sm">
          Connect your Solana wallet to participate in voting.
          You need to own Lesezeichnen NFTs to vote.
        </p>
      </div>
    );
  }

  if (votingPower.total === 0) {
    return (
      <div className="card p-6 mt-8 text-center">
        <h3 className="font-semibold text-lg mb-2">No Voting Power</h3>
        <p className="text-primary-500 text-sm mb-4">
          You need to own Lesezeichnen NFTs to vote.
          Mint your first bookmark NFT via the Telegram bot!
        </p>
        <a
          href="https://t.me/lesezeichnen_bot"
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Started
        </a>
      </div>
    );
  }

  const maxVotesAllowed = calculateMaxVotes(votingPower.remaining);
  const voteCost = calculateQuadraticVoteCost(voteCount);

  return (
    <div className="card p-6 mt-8">
      <h3 className="font-semibold text-lg mb-4">Cast Your Vote</h3>

      <div className="flex items-center justify-between mb-6 p-3 bg-primary-50 rounded-lg">
        <span className="text-sm text-primary-600">Your Voting Power</span>
        <span className="font-bold text-primary-700">
          {votingPower.remaining} / {votingPower.total} remaining
        </span>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg mb-4 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Select a book</label>
          <select
            value={selectedOption || ''}
            onChange={(e) => setSelectedOption(e.target.value || null)}
            className="input"
          >
            <option value="">Choose a book...</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title} by {option.author}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Number of votes (max: {maxVotesAllowed})
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max={maxVotesAllowed}
              value={voteCount}
              onChange={(e) => setVoteCount(parseInt(e.target.value))}
              className="flex-1"
              disabled={maxVotesAllowed < 1}
            />
            <span className="w-16 text-center font-bold">{voteCount}</span>
          </div>
          <p className="text-sm text-primary-500 mt-1">
            Cost: {voteCost} voting power
          </p>
        </div>

        <button
          onClick={handleVote}
          disabled={!selectedOption || isVoting || voteCost > votingPower.remaining}
          className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVoting ? 'Casting Vote...' : `Cast ${voteCount} Vote${voteCount > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
