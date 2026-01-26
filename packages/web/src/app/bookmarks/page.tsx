import { createClient } from '@/lib/supabase-server';
import { BookmarkCard } from '@/components/BookmarkCard';

export const revalidate = 60;

async function getBookmarks() {
  const supabase = createClient();

  const { data } = await supabase
    .from('bookmarks')
    .select(`
      *,
      book:books(title, author, cover_url)
    `)
    .order('created_at', { ascending: false });

  return data || [];
}

export default async function BookmarksPage() {
  const bookmarks = await getBookmarks();

  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold mb-4">
          Bookmark Collection
        </h1>
        <p className="text-primary-600 max-w-xl mx-auto">
          Every bookmark represents a journey through a book. Click to flip between the artwork and thoughts.
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-primary-500 text-lg">
            No bookmarks yet. Be the first to add one!
          </p>
          <a
            href="https://t.me/lesezeichnen_bot"
            className="btn btn-primary mt-4 inline-block"
            target="_blank"
            rel="noopener noreferrer"
          >
            Create Your First Bookmark
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}
