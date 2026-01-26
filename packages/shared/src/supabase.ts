import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Database helper functions
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}

export async function getBookById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getBookmarksByUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      *,
      book:books(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getActiveVoteOptions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('vote_options')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getVoteTallies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('votes')
    .select(`
      option_id,
      vote_count
    `)
    .eq('is_active', true);

  if (error) throw error;

  // Aggregate votes by option
  const tallies: Record<string, number> = {};
  for (const vote of data || []) {
    tallies[vote.option_id] = (tallies[vote.option_id] || 0) + vote.vote_count;
  }

  return tallies;
}
