import { createClient } from '@supabase/supabase-js';

// Support multiple Supabase URL formats
// Priority: NEXT_PUBLIC_SUPABASE_URL > SUPABASE_URL
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    'Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL'
  );
}

// Support multiple Supabase Anon Key formats
// Priority: NEXT_PUBLIC_SUPABASE_ANON_KEY > SUPABASE_ANON_KEY
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error(
    'Missing Supabase Anon Key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY'
  );
}

// Client-side Supabase client (uses anon key)
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Server-side Supabase client (uses service role key - admin access)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase Service Role Key. Please set SUPABASE_SERVICE_ROLE_KEY'
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

