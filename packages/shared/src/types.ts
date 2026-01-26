// Book and Bookmark Types
export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  isbn13?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  genres?: string[];
  description?: string;
  coverUrl?: string;
  openLibraryId?: string;
  goodreadsId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReadingFormat = 'physical' | 'ebook' | 'audiobook';

export interface Bookmark {
  id: string;
  bookId: string;
  userId: string;

  // Bookmark images
  frontImageUrl: string;
  backImageUrl: string;

  // Reading metadata
  format: ReadingFormat;
  rating: number; // 1-5
  dateStarted?: Date;
  dateFinished?: Date;
  dateDrawn?: Date;

  // Context
  recommendedBy?: string;
  startedLocation?: string;
  finishedLocation?: string;

  // Extracted from back of bookmark
  thoughts?: string;
  favoriteQuotes?: string[];

  // NFT status
  nftMinted: boolean;
  nftMintAddress?: string;
  nftMetadataUri?: string;

  // AI extraction confidence
  aiExtractedData?: AIExtractedData;

  createdAt: Date;
  updatedAt: Date;
}

export interface AIExtractedData {
  extractedTitle?: string;
  extractedAuthor?: string;
  extractedThoughts?: string;
  confidence: number;
  rawResponse?: string;
}

// Voting Types
export interface VoteOption {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  suggestedBy?: string;
  createdAt: Date;
  isActive: boolean;
}

export interface Vote {
  id: string;
  optionId: string;
  voterWallet: string;
  nftMintAddress: string;
  voteCount: number; // Quadratic: sqrt of votes spent
  votesSpent: number; // Actual votes spent (squared of voteCount)
  createdAt: Date;
}

export interface VotingPower {
  wallet: string;
  totalNftsOwned: number;
  totalVotes: number; // 42 per NFT
  votesUsed: number;
  votesRemaining: number;
}

// User Types
export interface User {
  id: string;
  telegramId?: string;
  telegramUsername?: string;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface BookLookupResult {
  title: string;
  author: string;
  isbn?: string;
  isbn13?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  genres?: string[];
  description?: string;
  coverUrl?: string;
  openLibraryId?: string;
  source: 'openlibrary' | 'google_books';
}

export interface ImageAnalysisResult {
  title?: string;
  author?: string;
  thoughts?: string;
  quotes?: string[];
  confidence: number;
  isFront: boolean;
}

// Constants
export const VOTES_PER_NFT = 42;
export const MAX_RATING = 5;
export const MIN_RATING = 1;

// Helper functions
export function calculateQuadraticVoteCost(voteCount: number): number {
  return voteCount * voteCount;
}

export function calculateMaxVotes(votesAvailable: number): number {
  return Math.floor(Math.sqrt(votesAvailable));
}

export function formatRating(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(MAX_RATING - rating);
}
