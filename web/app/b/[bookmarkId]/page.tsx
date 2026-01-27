import { notFound } from 'next/navigation';
import { getBookmarkById } from '@/lib/supabase';
import { BookmarkCard } from '@/components/BookmarkCard';

interface BookmarkPageProps {
  params: Promise<{ bookmarkId: string }>;
}

export default async function BookmarkPage({ params }: BookmarkPageProps) {
  const { bookmarkId } = await params;
  const bookmark = await getBookmarkById(bookmarkId);

  if (!bookmark) {
    notFound();
  }

  return (
    <main className="page-container">
      <BookmarkCard bookmark={bookmark} />
    </main>
  );
}

export async function generateMetadata({ params }: BookmarkPageProps) {
  const { bookmarkId } = await params;
  const bookmark = await getBookmarkById(bookmarkId);

  if (!bookmark) {
    return {
      title: 'Bookmark Not Found - Lesezeichnen',
    };
  }

  return {
    title: `${bookmark.book_name} - Lesezeichnen`,
    description: bookmark.author
      ? `${bookmark.book_name} by ${bookmark.author}`
      : bookmark.book_name,
  };
}
