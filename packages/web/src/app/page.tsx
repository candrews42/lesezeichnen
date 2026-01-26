import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { BookmarkCard } from '@/components/BookmarkCard';

export const revalidate = 60; // Revalidate every minute

async function getRecentBookmarks() {
  const supabase = createClient();

  const { data } = await supabase
    .from('bookmarks')
    .select(`
      *,
      book:books(title, author, cover_url)
    `)
    .eq('nft_minted', true)
    .order('created_at', { ascending: false })
    .limit(6);

  return data || [];
}

async function getStats() {
  const supabase = createClient();

  const [bookmarks, nfts, votes] = await Promise.all([
    supabase.from('bookmarks').select('id', { count: 'exact', head: true }),
    supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('nft_minted', true),
    supabase.from('votes').select('vote_count'),
  ]);

  const totalVotes = votes.data?.reduce((sum, v) => sum + v.vote_count, 0) || 0;

  return {
    totalBookmarks: bookmarks.count || 0,
    totalNFTs: nfts.count || 0,
    totalVotes,
  };
}

export default async function HomePage() {
  const [bookmarks, stats] = await Promise.all([
    getRecentBookmarks(),
    getStats(),
  ]);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="font-display text-5xl md:text-6xl font-bold text-bookmark-ink mb-6">
          Lesezeichnen
        </h1>
        <p className="text-xl text-primary-700 max-w-2xl mx-auto mb-8">
          Hand-drawn bookmarks for every book you read.
          <br />
          Mint them as NFTs. Vote on what to read next.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://t.me/lesezeichnen_bot"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Start on Telegram
          </a>
          <Link href="/bookmarks" className="btn btn-secondary">
            Browse Collection
          </Link>
          <Link href="/vote" className="btn btn-secondary">
            Vote Now
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="card p-6 text-center">
          <div className="text-4xl font-display font-bold text-primary-600">
            {stats.totalBookmarks}
          </div>
          <div className="text-primary-500 mt-2">Bookmarks Created</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-4xl font-display font-bold text-primary-600">
            {stats.totalNFTs}
          </div>
          <div className="text-primary-500 mt-2">NFTs Minted</div>
        </div>
        <div className="card p-6 text-center">
          <div className="text-4xl font-display font-bold text-primary-600">
            {stats.totalVotes}
          </div>
          <div className="text-primary-500 mt-2">Votes Cast</div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto">
        <h2 className="font-display text-3xl font-bold text-center mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            {
              step: '1',
              title: 'Read & Draw',
              description: 'Finish a book and create a hand-drawn bookmark with your artwork and thoughts.',
            },
            {
              step: '2',
              title: 'Submit via Telegram',
              description: 'Send photos of your bookmark front and back to our bot.',
            },
            {
              step: '3',
              title: 'Mint NFT',
              description: 'Turn your bookmark into a Solana NFT with one command.',
            },
            {
              step: '4',
              title: 'Vote',
              description: 'Use your NFT to vote on the next book with 42 quadratic votes.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-primary-600 text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent NFTs */}
      {bookmarks.length > 0 && (
        <section>
          <h2 className="font-display text-3xl font-bold text-center mb-8">
            Recent Bookmark NFTs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarks.map((bookmark) => (
              <BookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/bookmarks" className="btn btn-secondary">
              View All Bookmarks
            </Link>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="card p-12 text-center bg-gradient-to-br from-primary-50 to-bookmark-paper">
        <h2 className="font-display text-3xl font-bold mb-4">
          Start Your Reading Journey
        </h2>
        <p className="text-primary-600 mb-8 max-w-xl mx-auto">
          Join the community of readers who celebrate every book with unique, hand-drawn art.
        </p>
        <a
          href="https://t.me/lesezeichnen_bot"
          className="btn btn-primary text-lg"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Started on Telegram
        </a>
      </section>
    </div>
  );
}
