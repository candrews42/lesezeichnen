import { ImageAnalysisResult } from '@lesezeichnen/shared';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function analyzeBookmarkImage(
  imageBuffer: Buffer,
  isFront: boolean
): Promise<ImageAnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set, returning empty analysis');
    return {
      confidence: 0,
      isFront,
    };
  }

  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/jpeg';

  const prompt = isFront
    ? `You are analyzing the FRONT of a hand-drawn bookmark for a book.
       This side typically contains artwork, possibly the book title and/or author name.

       Please extract:
       1. The book title (if visible)
       2. The author name (if visible)
       3. Any other text or notable elements

       Respond in JSON format:
       {
         "title": "extracted title or null",
         "author": "extracted author or null",
         "description": "brief description of the artwork",
         "confidence": 0.0-1.0
       }`
    : `You are analyzing the BACK of a hand-drawn bookmark.
       This side typically contains the reader's thoughts, notes, and favorite quotes about the book.

       Please extract:
       1. The reader's thoughts/review
       2. Any favorite quotes mentioned
       3. The book title if mentioned
       4. The author if mentioned

       Respond in JSON format:
       {
         "thoughts": "extracted thoughts/review",
         "quotes": ["quote1", "quote2"],
         "title": "book title if found or null",
         "author": "author if found or null",
         "confidence": 0.0-1.0
       }`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lesezeichnen.vercel.app',
        'X-Title': 'Lesezeichnen Bookmark Analyzer',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return {
        confidence: 0,
        isFront,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        confidence: 0,
        isFront,
      };
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      title: parsed.title || undefined,
      author: parsed.author || undefined,
      thoughts: parsed.thoughts || undefined,
      quotes: parsed.quotes || undefined,
      confidence: parsed.confidence || 0.5,
      isFront,
    };

  } catch (error) {
    console.error('AI analysis failed:', error);
    return {
      confidence: 0,
      isFront,
    };
  }
}

export async function generateNFTDescription(
  bookTitle: string,
  bookAuthor: string,
  thoughts?: string,
  rating?: number
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || !thoughts) {
    // Fallback description
    return `A hand-drawn bookmark for "${bookTitle}" by ${bookAuthor}. ${rating ? `Rated ${rating}/5 stars.` : ''}`;
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lesezeichnen.vercel.app',
        'X-Title': 'Lesezeichnen NFT Generator',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: `Create a brief, compelling NFT description (max 200 chars) for a hand-drawn bookmark.

Book: "${bookTitle}" by ${bookAuthor}
Rating: ${rating || 'Not rated'}/5
Reader's thoughts: ${thoughts.substring(0, 500)}

The description should be poetic and capture the essence of the reading experience.
Respond with just the description, no quotes or formatting.`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ||
      `A hand-drawn bookmark for "${bookTitle}" by ${bookAuthor}.`;

  } catch (error) {
    console.error('Description generation failed:', error);
    return `A hand-drawn bookmark for "${bookTitle}" by ${bookAuthor}. ${rating ? `Rated ${rating}/5 stars.` : ''}`;
  }
}
