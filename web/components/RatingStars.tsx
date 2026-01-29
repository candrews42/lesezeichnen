'use client';

interface RatingStarsProps {
  rating: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingStars({ rating, size = 'md' }: RatingStarsProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  if (rating === null || rating === undefined) {
    return <span className={`${sizeClasses[size]} text-gray-500`}>Unrated</span>;
  }

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push(
        <span key={i} className="text-amber-400">
          ★
        </span>
      );
    } else {
      stars.push(
        <span key={i} className="text-gray-600">
          ☆
        </span>
      );
    }
  }

  return <span className={sizeClasses[size]}>{stars}</span>;
}
