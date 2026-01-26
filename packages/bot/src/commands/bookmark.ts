import { Context, SessionFlavor } from 'grammy';
import { getSupabaseAdmin, uploadImage } from '@lesezeichnen/shared';
import { SessionData } from '../session.js';
import { analyzeBookmarkImage } from '../services/ai.js';
import { lookupBook } from '../services/bookLookup.js';

type MyContext = Context & SessionFlavor<SessionData>;

export async function handleNewBookmark(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Could not identify you. Please try again.');
    return;
  }

  // Get or create user
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  // Create pending submission
  const { data: submission, error } = await supabase
    .from('pending_submissions')
    .insert({
      user_id: user.id,
      telegram_chat_id: ctx.chat?.id,
      status: 'awaiting_images',
    })
    .select()
    .single();

  if (error || !submission) {
    await ctx.reply('Failed to start bookmark submission. Please try again.');
    return;
  }

  ctx.session.state = 'awaiting_front';
  ctx.session.pendingSubmissionId = submission.id;
  ctx.session.userId = user.id;

  await ctx.reply(
`Let's add a new bookmark!

Please send me a photo of the **FRONT** of your bookmark (the artwork side).

I'll analyze the image to extract the book title and author.`
  );
}

export async function handlePhoto(ctx: MyContext) {
  const supabase = getSupabaseAdmin();
  const photo = ctx.message?.photo;

  if (!photo || photo.length === 0) {
    await ctx.reply('Could not process the photo. Please try again.');
    return;
  }

  // Get the largest photo
  const largestPhoto = photo[photo.length - 1];
  const file = await ctx.api.getFile(largestPhoto.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  // Download the image
  const response = await fetch(fileUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  const timestamp = Date.now();
  const userId = ctx.session.userId || 'unknown';

  if (ctx.session.state === 'awaiting_front') {
    await ctx.reply('Processing front image...');

    // Upload to Supabase storage
    const imagePath = `${userId}/${timestamp}_front.jpg`;
    const publicUrl = await uploadImage(supabase, 'bookmarks', imagePath, imageBuffer, 'image/jpeg');

    // Update pending submission
    await supabase
      .from('pending_submissions')
      .update({
        front_image_url: publicUrl,
        status: 'awaiting_images',
      })
      .eq('id', ctx.session.pendingSubmissionId);

    // Analyze with AI
    const analysis = await analyzeBookmarkImage(imageBuffer, true);

    // Store extracted data
    await supabase
      .from('pending_submissions')
      .update({
        extracted_data: {
          ...((await supabase.from('pending_submissions').select('extracted_data').eq('id', ctx.session.pendingSubmissionId).single()).data?.extracted_data || {}),
          front: analysis,
        },
      })
      .eq('id', ctx.session.pendingSubmissionId);

    ctx.session.state = 'awaiting_back';
    ctx.session.tempData = { frontAnalysis: analysis };

    let message = 'Front image received!\n\n';
    if (analysis.title) {
      message += `Detected title: **${analysis.title}**\n`;
    }
    if (analysis.author) {
      message += `Detected author: **${analysis.author}**\n`;
    }
    message += `\nNow please send me a photo of the **BACK** of your bookmark (your thoughts).`;

    await ctx.reply(message);

  } else if (ctx.session.state === 'awaiting_back') {
    await ctx.reply('Processing back image...');

    // Upload to Supabase storage
    const imagePath = `${userId}/${timestamp}_back.jpg`;
    const publicUrl = await uploadImage(supabase, 'bookmarks', imagePath, imageBuffer, 'image/jpeg');

    // Update pending submission
    await supabase
      .from('pending_submissions')
      .update({
        back_image_url: publicUrl,
        status: 'processing',
      })
      .eq('id', ctx.session.pendingSubmissionId);

    // Analyze back with AI
    const backAnalysis = await analyzeBookmarkImage(imageBuffer, false);
    const frontAnalysis = ctx.session.tempData?.frontAnalysis as { title?: string; author?: string } || {};

    // Combine analyses
    const title = frontAnalysis.title || backAnalysis.title;
    const author = frontAnalysis.author || backAnalysis.author;

    // Look up book info
    let bookInfo = null;
    if (title || author) {
      bookInfo = await lookupBook(title || '', author || '');
    }

    // Determine missing fields
    const missingFields: string[] = [];
    if (!title && !bookInfo?.title) missingFields.push('title');
    if (!author && !bookInfo?.author) missingFields.push('author');
    missingFields.push('rating', 'format', 'date_finished');

    // Update with all extracted data
    const extractedData = {
      front: frontAnalysis,
      back: backAnalysis,
      bookLookup: bookInfo,
      title: bookInfo?.title || title,
      author: bookInfo?.author || author,
      isbn: bookInfo?.isbn,
      thoughts: backAnalysis.thoughts,
      quotes: backAnalysis.quotes,
    };

    await supabase
      .from('pending_submissions')
      .update({
        extracted_data: extractedData,
        missing_fields: missingFields,
        status: 'awaiting_info',
      })
      .eq('id', ctx.session.pendingSubmissionId);

    // Build summary message
    let message = 'Both images received! Here\'s what I found:\n\n';

    if (extractedData.title) message += `**Title:** ${extractedData.title}\n`;
    if (extractedData.author) message += `**Author:** ${extractedData.author}\n`;
    if (extractedData.isbn) message += `**ISBN:** ${extractedData.isbn}\n`;
    if (bookInfo?.pageCount) message += `**Pages:** ${bookInfo.pageCount}\n`;
    if (extractedData.thoughts) message += `\n**Your thoughts:** ${extractedData.thoughts.substring(0, 200)}...\n`;

    message += '\n---\n';
    message += 'Now I need a few more details.\n\n';
    message += '**What rating would you give this book? (1-5)**';

    ctx.session.state = 'awaiting_info';
    ctx.session.missingFields = missingFields;
    ctx.session.currentField = 'rating';

    await ctx.reply(message);

  } else {
    await ctx.reply(
      'I wasn\'t expecting a photo right now. Use /newbookmark to start adding a new bookmark.'
    );
  }
}

export async function handleText(ctx: MyContext) {
  if (ctx.session.state !== 'awaiting_info' || !ctx.session.currentField) {
    // Not in a conversation flow, ignore
    return;
  }

  const supabase = getSupabaseAdmin();
  const text = ctx.message?.text?.trim();

  if (!text) return;

  const { data: submission } = await supabase
    .from('pending_submissions')
    .select('*')
    .eq('id', ctx.session.pendingSubmissionId)
    .single();

  if (!submission) {
    ctx.session.state = 'idle';
    await ctx.reply('Session expired. Please use /newbookmark to start again.');
    return;
  }

  const extractedData = submission.extracted_data || {};
  const currentField = ctx.session.currentField;

  // Process the current field
  switch (currentField) {
    case 'rating':
      const rating = parseInt(text);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        await ctx.reply('Please enter a number between 1 and 5.');
        return;
      }
      extractedData.rating = rating;
      ctx.session.currentField = 'format';
      await supabase.from('pending_submissions').update({ extracted_data: extractedData }).eq('id', submission.id);
      await ctx.reply('**How did you read this book?**\n\n1. Physical book\n2. E-book\n3. Audiobook\n\nReply with 1, 2, or 3.');
      break;

    case 'format':
      const formatMap: Record<string, string> = { '1': 'physical', '2': 'ebook', '3': 'audiobook' };
      const format = formatMap[text] || text.toLowerCase();
      if (!['physical', 'ebook', 'audiobook'].includes(format)) {
        await ctx.reply('Please reply with 1 (physical), 2 (ebook), or 3 (audiobook).');
        return;
      }
      extractedData.format = format;
      ctx.session.currentField = 'date_finished';
      await supabase.from('pending_submissions').update({ extracted_data: extractedData }).eq('id', submission.id);
      await ctx.reply('**When did you finish reading?**\n\nEnter a date (e.g., "2024-01-15" or "January 2024") or "skip" to skip.');
      break;

    case 'date_finished':
      if (text.toLowerCase() !== 'skip') {
        extractedData.date_finished = text;
      }
      ctx.session.currentField = 'recommended_by';
      await supabase.from('pending_submissions').update({ extracted_data: extractedData }).eq('id', submission.id);
      await ctx.reply('**Who recommended this book?**\n\nEnter a name or "skip" to skip.');
      break;

    case 'recommended_by':
      if (text.toLowerCase() !== 'skip') {
        extractedData.recommended_by = text;
      }
      // All fields collected - finalize the bookmark
      await finalizeBookmark(ctx, submission.id, extractedData);
      break;

    default:
      ctx.session.state = 'idle';
      await ctx.reply('Something went wrong. Please use /newbookmark to start again.');
  }
}

async function finalizeBookmark(ctx: MyContext, submissionId: string, extractedData: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();

  const { data: submission } = await supabase
    .from('pending_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (!submission) {
    await ctx.reply('Session expired. Please try again.');
    return;
  }

  // Create or find the book
  let bookId: string | null = null;
  if (extractedData.title && extractedData.author) {
    // Check if book exists
    const { data: existingBook } = await supabase
      .from('books')
      .select('id')
      .eq('title', extractedData.title)
      .eq('author', extractedData.author)
      .single();

    if (existingBook) {
      bookId = existingBook.id;
    } else {
      // Create new book
      const bookLookup = extractedData.bookLookup as Record<string, unknown> || {};
      const { data: newBook } = await supabase
        .from('books')
        .insert({
          title: extractedData.title,
          author: extractedData.author,
          isbn: bookLookup.isbn || extractedData.isbn,
          isbn13: bookLookup.isbn13,
          publisher: bookLookup.publisher,
          published_year: bookLookup.publishedYear,
          page_count: bookLookup.pageCount,
          genres: bookLookup.genres,
          description: bookLookup.description,
          cover_url: bookLookup.coverUrl,
          open_library_id: bookLookup.openLibraryId,
        })
        .select()
        .single();

      bookId = newBook?.id || null;
    }
  }

  // Create the bookmark
  const { data: bookmark, error } = await supabase
    .from('bookmarks')
    .insert({
      book_id: bookId,
      user_id: submission.user_id,
      front_image_url: submission.front_image_url,
      back_image_url: submission.back_image_url,
      format: extractedData.format,
      rating: extractedData.rating,
      date_finished: extractedData.date_finished ? new Date(extractedData.date_finished as string).toISOString().split('T')[0] : null,
      recommended_by: extractedData.recommended_by,
      thoughts: extractedData.thoughts,
      favorite_quotes: extractedData.quotes,
      ai_extracted_data: {
        front: extractedData.front,
        back: extractedData.back,
      },
    })
    .select()
    .single();

  if (error || !bookmark) {
    console.error('Failed to create bookmark:', error);
    await ctx.reply('Failed to save bookmark. Please try again.');
    return;
  }

  // Update submission status
  await supabase
    .from('pending_submissions')
    .update({ status: 'completed' })
    .eq('id', submissionId);

  // Reset session
  ctx.session.state = 'idle';
  ctx.session.pendingSubmissionId = undefined;
  ctx.session.currentField = undefined;
  ctx.session.missingFields = undefined;
  ctx.session.tempData = undefined;

  const stars = '★'.repeat(extractedData.rating as number) + '☆'.repeat(5 - (extractedData.rating as number));

  await ctx.reply(
`Bookmark saved successfully!

**${extractedData.title}** by ${extractedData.author}
Rating: ${stars}
Format: ${extractedData.format}

Use /mint to turn this bookmark into an NFT!
Use /mybookmarks to view your collection.`
  );
}
