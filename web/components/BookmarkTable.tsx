'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark } from '@/lib/supabase';
import { RatingStars } from './RatingStars';

interface BookmarkTableProps {
  bookmarks: Bookmark[];
}

type SortField = 'book_name' | 'author' | 'rating' | 'date_finished' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface SortButtonProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortButton({ field, label, currentField, direction, onSort }: SortButtonProps) {
  const isActive = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`px-3 py-1 rounded text-sm transition-colors ${
        isActive
          ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
          : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-amber-600/50'
      }`}
    >
      {label} {isActive && (direction === 'asc' ? '↑' : '↓')}
    </button>
  );
}

export function BookmarkTable({ bookmarks }: BookmarkTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date_finished');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filteredAndSorted = useMemo(() => {
    let result = [...bookmarks];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.book_name.toLowerCase().includes(searchLower) ||
          (b.author && b.author.toLowerCase().includes(searchLower))
      );
    }

    // Sort (always prioritize entries with a front image)
    result.sort((a, b) => {
      const aHasMedia = Boolean(a.media_url);
      const bHasMedia = Boolean(b.media_url);

      if (aHasMedia !== bHasMedia) {
        return aHasMedia ? -1 : 1;
      }

      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case 'book_name':
          aVal = a.book_name.toLowerCase();
          bVal = b.book_name.toLowerCase();
          break;
        case 'author':
          aVal = a.author?.toLowerCase() || '';
          bVal = b.author?.toLowerCase() || '';
          break;
        case 'rating':
          aVal = a.rating ?? 0;
          bVal = b.rating ?? 0;
          break;
        case 'date_finished':
          aVal = a.date_finished || '';
          bVal = b.date_finished || '';
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
      }

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [bookmarks, search, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <input
          type="text"
          placeholder="Search by title or author..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-600/50"
        />
        <div className="flex gap-2 flex-wrap">
          <span className="text-gray-500 text-sm self-center">Sort:</span>
          <SortButton field="book_name" label="Title" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          <SortButton field="author" label="Author" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          <SortButton field="rating" label="Rating" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          <SortButton field="date_finished" label="Finished" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          <SortButton field="created_at" label="Added" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {filteredAndSorted.length} bookmark{filteredAndSorted.length !== 1 ? 's' : ''}
        {search && <span> matching &quot;{search}&quot;</span>}
      </p>

      {/* Bookmark List */}
      <div className="space-y-4">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? 'No bookmarks match your search.' : 'No bookmarks yet.'}
          </div>
        ) : (
          filteredAndSorted.map((bookmark) => (
            <BookmarkRow key={bookmark.id} bookmark={bookmark} />
          ))
        )}
      </div>
    </div>
  );
}

function BookmarkRow({ bookmark }: { bookmark: Bookmark }) {
  const firstReflection = bookmark.reflections?.[0];
  const reflectionCount = bookmark.reflections?.length || 0;
  const dateAdded = new Date(bookmark.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <Link href={`/b/${bookmark.id}`}>
      <div className="group flex gap-4 p-4 bg-gray-900/30 border border-gray-800 rounded-lg hover:border-amber-600/50 hover:bg-gray-900/50 transition-all cursor-pointer">
        {/* Image */}
        <div className="flex-shrink-0 w-20 h-28 bg-gray-800 rounded overflow-hidden border border-gray-700">
          {bookmark.media_url ? (
            <Image
              src={bookmark.media_url}
              alt={bookmark.book_name}
              width={80}
              height={112}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">
              📚
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {bookmark.book_name}
              </h3>
              {bookmark.author && (
                <p className="text-sm text-gray-400">by {bookmark.author}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <RatingStars rating={bookmark.rating} size="sm" />
              <p className="text-xs text-gray-500 mt-1">{dateAdded}</p>
            </div>
          </div>

          {firstReflection && (
            <p className="mt-2 text-sm text-gray-400 line-clamp-2">
              &quot;{firstReflection.content}&quot;
            </p>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            {bookmark.format && (
              <span className="flex items-center gap-1">
                {bookmark.format === 'physical' && '📖'}
                {bookmark.format === 'ebook' && '📱'}
                {bookmark.format === 'audiobook' && '🎧'}
                {bookmark.format}
              </span>
            )}
            {reflectionCount > 0 && (
              <span>💭 {reflectionCount} reflection{reflectionCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="flex-shrink-0 self-center text-gray-600 group-hover:text-amber-400 transition-colors">
          →
        </div>
      </div>
    </Link>
  );
}
