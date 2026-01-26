'use client';

import { useState } from 'react';
import Image from 'next/image';

interface BookmarkCardProps {
  bookmark: {
    id: string;
    front_image_url: string;
    back_image_url: string;
    rating?: number;
    format?: string;
    nft_mint_address?: string;
    book?: {
      title: string;
      author: string;
      cover_url?: string;
    };
  };
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const [showBack, setShowBack] = useState(false);
  const book = bookmark.book;

  const renderStars = (rating: number) => {
    return (
      <span className="rating-stars">
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </span>
    );
  };

  return (
    <div className="bookmark-card group">
      <div
        className="relative aspect-[2/3] cursor-pointer overflow-hidden"
        onClick={() => setShowBack(!showBack)}
      >
        {/* Front image */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            showBack ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Image
            src={bookmark.front_image_url}
            alt={`${book?.title || 'Bookmark'} - Front`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        {/* Back image */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            showBack ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={bookmark.back_image_url}
            alt={`${book?.title || 'Bookmark'} - Back`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        {/* Click hint */}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          Click to flip
        </div>

        {/* NFT badge */}
        {bookmark.nft_mint_address && (
          <div className="absolute top-2 left-2 bg-bookmark-gold text-white text-xs px-2 py-1 rounded font-medium">
            NFT
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg truncate">
          {book?.title || 'Unknown Title'}
        </h3>
        <p className="text-primary-600 text-sm truncate">
          by {book?.author || 'Unknown Author'}
        </p>

        <div className="flex items-center justify-between mt-3">
          {bookmark.rating && (
            <div className="text-sm">{renderStars(bookmark.rating)}</div>
          )}
          {bookmark.format && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
              {bookmark.format}
            </span>
          )}
        </div>

        {bookmark.nft_mint_address && (
          <a
            href={`https://solscan.io/token/${bookmark.nft_mint_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-3 text-xs text-primary-500 hover:text-primary-700 truncate"
          >
            View on Solscan
          </a>
        )}
      </div>
    </div>
  );
}
