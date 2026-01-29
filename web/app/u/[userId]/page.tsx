import { getBookmarksByUser } from '@/lib/supabase';
import { BookmarkTable } from '@/components/BookmarkTable';

interface UserPageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserPage({ params }: UserPageProps) {
  const { userId } = await params;
  const bookmarks = await getBookmarksByUser(userId);

  return (
    <main className="page-container">
      <header className="page-header">
        <h1 className="page-title">
          <span>📚</span>
          <span>Reading Collection</span>
        </h1>
      </header>

      {bookmarks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <p>No bookmarks found.</p>
          <p className="text-sm mt-2">
            Use <code className="bg-gray-800 px-2 py-1 rounded">/bookmarks mint</code> to add your first book.
          </p>
        </div>
      ) : (
        <BookmarkTable bookmarks={bookmarks} />
      )}
    </main>
  );
}

export async function generateMetadata() {
  return {
    title: 'Reading Collection - Lesezeichnen',
    description: 'View this reading collection on Lesezeichnen',
  };
}
