import { BookLookupResult } from '@lesezeichnen/shared';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_WORKS_URL = 'https://openlibrary.org';
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

export async function lookupBook(
  title: string,
  author: string
): Promise<BookLookupResult | null> {
  // Try Open Library first (free, no API key required)
  const openLibraryResult = await searchOpenLibrary(title, author);
  if (openLibraryResult) {
    return openLibraryResult;
  }

  // Fallback to Google Books
  const googleResult = await searchGoogleBooks(title, author);
  if (googleResult) {
    return googleResult;
  }

  return null;
}

async function searchOpenLibrary(
  title: string,
  author: string
): Promise<BookLookupResult | null> {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const url = `${OPEN_LIBRARY_SEARCH_URL}?q=${query}&limit=5&fields=key,title,author_name,isbn,publisher,publish_year,number_of_pages_median,subject,cover_i,first_sentence`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Open Library API error');
    }

    const data = await response.json();
    const docs = data.docs;

    if (!docs || docs.length === 0) {
      return null;
    }

    // Find best match (prioritize exact title match)
    let bestMatch = docs[0];
    for (const doc of docs) {
      if (doc.title?.toLowerCase() === title.toLowerCase()) {
        bestMatch = doc;
        break;
      }
    }

    const isbn = bestMatch.isbn?.[0];
    const isbn13 = bestMatch.isbn?.find((i: string) => i.length === 13);
    const coverId = bestMatch.cover_i;

    return {
      title: bestMatch.title,
      author: bestMatch.author_name?.[0] || author,
      isbn: isbn,
      isbn13: isbn13,
      publisher: bestMatch.publisher?.[0],
      publishedYear: bestMatch.publish_year?.[0],
      pageCount: bestMatch.number_of_pages_median,
      genres: bestMatch.subject?.slice(0, 5),
      description: bestMatch.first_sentence?.value || bestMatch.first_sentence,
      coverUrl: coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : undefined,
      openLibraryId: bestMatch.key,
      source: 'openlibrary',
    };

  } catch (error) {
    console.error('Open Library search failed:', error);
    return null;
  }
}

async function searchGoogleBooks(
  title: string,
  author: string
): Promise<BookLookupResult | null> {
  try {
    const query = encodeURIComponent(`intitle:${title} inauthor:${author}`);
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    let url = `${GOOGLE_BOOKS_API_URL}?q=${query}&maxResults=5`;
    if (apiKey) {
      url += `&key=${apiKey}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Google Books API error');
    }

    const data = await response.json();
    const items = data.items;

    if (!items || items.length === 0) {
      return null;
    }

    const bestMatch = items[0];
    const volumeInfo = bestMatch.volumeInfo;

    // Extract ISBN
    const identifiers = volumeInfo.industryIdentifiers || [];
    const isbn10 = identifiers.find((i: { type: string }) => i.type === 'ISBN_10')?.identifier;
    const isbn13 = identifiers.find((i: { type: string }) => i.type === 'ISBN_13')?.identifier;

    return {
      title: volumeInfo.title,
      author: volumeInfo.authors?.[0] || author,
      isbn: isbn10,
      isbn13: isbn13,
      publisher: volumeInfo.publisher,
      publishedYear: volumeInfo.publishedDate
        ? parseInt(volumeInfo.publishedDate.substring(0, 4))
        : undefined,
      pageCount: volumeInfo.pageCount,
      genres: volumeInfo.categories,
      description: volumeInfo.description?.substring(0, 500),
      coverUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
      source: 'google_books',
    };

  } catch (error) {
    console.error('Google Books search failed:', error);
    return null;
  }
}

export async function lookupByISBN(isbn: string): Promise<BookLookupResult | null> {
  try {
    // Clean ISBN
    const cleanIsbn = isbn.replace(/[-\s]/g, '');

    // Try Open Library ISBN endpoint
    const url = `${OPEN_LIBRARY_WORKS_URL}/isbn/${cleanIsbn}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Need to fetch work details for full info
    if (data.works?.[0]?.key) {
      const workUrl = `${OPEN_LIBRARY_WORKS_URL}${data.works[0].key}.json`;
      const workResponse = await fetch(workUrl);
      const workData = await workResponse.json();

      return {
        title: data.title || workData.title,
        author: data.by_statement || 'Unknown',
        isbn: cleanIsbn.length === 10 ? cleanIsbn : undefined,
        isbn13: cleanIsbn.length === 13 ? cleanIsbn : undefined,
        publisher: data.publishers?.[0],
        publishedYear: data.publish_date
          ? parseInt(data.publish_date.match(/\d{4}/)?.[0] || '')
          : undefined,
        pageCount: data.number_of_pages,
        description: typeof workData.description === 'string'
          ? workData.description
          : workData.description?.value,
        coverUrl: data.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
          : undefined,
        openLibraryId: data.key,
        source: 'openlibrary',
      };
    }

    return null;

  } catch (error) {
    console.error('ISBN lookup failed:', error);
    return null;
  }
}
