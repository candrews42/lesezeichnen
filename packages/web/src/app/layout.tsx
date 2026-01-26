import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Lesezeichnen - Book Bookmark NFTs',
  description: 'Hand-drawn bookmarks for every book you read, minted as NFTs on Solana. Vote on the next book with quadratic voting.',
  openGraph: {
    title: 'Lesezeichnen - Book Bookmark NFTs',
    description: 'Hand-drawn bookmarks for every book you read, minted as NFTs on Solana.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-bookmark-cream text-bookmark-ink">
        <Providers>
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-primary-200 py-8 text-center text-sm text-primary-600">
            <p>Lesezeichnen - A reading journey, one bookmark at a time</p>
            <p className="mt-2">
              <a href="https://t.me/lesezeichnen_bot" className="hover:text-primary-800">
                Telegram Bot
              </a>
              {' | '}
              <a href="https://github.com/candrews42/lesezeichnen" className="hover:text-primary-800">
                GitHub
              </a>
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
