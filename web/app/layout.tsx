import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lesezeichnen - Your Reading Archive",
  description: "Track your reading with hand-drawn bookmarks and evolving reflections",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
