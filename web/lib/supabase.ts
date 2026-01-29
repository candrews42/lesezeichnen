import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client lazily to avoid build-time errors when env vars aren't set
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export interface Bookmark {
  id: string;
  user_id: string;
  book_name: string;
  author: string | null;
  rating: number | null;
  format: 'physical' | 'ebook' | 'audiobook' | null;
  date_finished: string | null;
  recommended_by: string | null;
  reading_context: string | null;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  reflections?: Reflection[];
}

export interface Reflection {
  id: string;
  bookmark_id: string;
  content: string;
  content_type: 'text' | 'voice_transcript' | 'drawing_note';
  created_at: string;
}

export async function getBookmarksByUser(userId: string): Promise<Bookmark[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('bookmarks')
      .select(`
        *,
        reflections (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookmarks:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Supabase not configured:', e);
    return [];
  }
}

export async function getBookmarkById(bookmarkId: string): Promise<Bookmark | null> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('bookmarks')
      .select(`
        *,
        reflections (*)
      `)
      .eq('id', bookmarkId)
      .single();

    if (error) {
      console.error('Error fetching bookmark:', error);
      return null;
    }

    return data;
  } catch (e) {
    console.error('Supabase not configured:', e);
    return null;
  }
}
