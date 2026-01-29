'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bookmark } from '@/lib/supabase';
import { RatingStars } from './RatingStars';
import { ReflectionList } from './ReflectionList';

interface BookmarkCardProps {
  bookmark: Bookmark;
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const dateFinished = bookmark.date_finished
    ? new Date(bookmark.date_finished).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const formatDisplay = {
    physical: { icon: '📖', label: 'TOME' },
    ebook: { icon: '📱', label: 'SCROLL' },
    audiobook: { icon: '🎧', label: 'TALE' },
  }[bookmark.format || 'physical'] || { icon: '📚', label: 'CODEX' };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Link */}
      <Link
        href={`/u/${bookmark.user_id}`}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors mb-6"
      >
        ← Back to Collection
      </Link>

      {/* RPG Card */}
      <div className="rpg-card">
        {/* Header */}
        <div className="rpg-card-header">
          <h1 className="rpg-title">{bookmark.book_name.toUpperCase()}</h1>
          {bookmark.author && (
            <p className="rpg-subtitle">by {bookmark.author}</p>
          )}
        </div>

        {/* Main Content */}
        <div className="rpg-card-body">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Image */}
            <div className="flex-shrink-0">
              <div className="rpg-image-frame">
                {bookmark.media_url ? (
                  <Image
                    src={bookmark.media_url}
                    alt={bookmark.book_name}
                    width={200}
                    height={280}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl text-gray-600 bg-gray-900">
                    📚
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex-grow space-y-4">
              {/* Class & Level */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rpg-stat-box">
                  <span className="rpg-stat-label">CLASS</span>
                  <span className="rpg-stat-value">
                    {formatDisplay.icon} {formatDisplay.label}
                  </span>
                </div>
                <div className="rpg-stat-box">
                  <span className="rpg-stat-label">LEVEL</span>
                  <span className="rpg-stat-value">
                    <RatingStars rating={bookmark.rating} size="lg" />
                  </span>
                </div>
              </div>

              {/* Attributes */}
              <div className="rpg-section">
                <h2 className="rpg-section-title">ATTRIBUTES</h2>
                <div className="rpg-divider" />
                <dl className="space-y-2">
                  {dateFinished && (
                    <div className="rpg-attribute">
                      <dt>📅 Conquered</dt>
                      <dd>{dateFinished}</dd>
                    </div>
                  )}
                  {bookmark.reading_context && (
                    <div className="rpg-attribute">
                      <dt>🗺️ Quest Location</dt>
                      <dd>{bookmark.reading_context}</dd>
                    </div>
                  )}
                  {bookmark.recommended_by && (
                    <div className="rpg-attribute">
                      <dt>🧙 Quest Giver</dt>
                      <dd>{bookmark.recommended_by}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Reflections Section */}
        <div className="rpg-card-footer">
          <div className="rpg-section">
            <div className="flex items-center justify-between">
              <h2 className="rpg-section-title">JOURNAL ENTRIES</h2>
              <span className="text-xs text-gray-500">
                {bookmark.reflections?.length || 0} entries
              </span>
            </div>
            <div className="rpg-divider" />
            <ReflectionList reflections={bookmark.reflections || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
