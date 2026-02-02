import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Warn context if keys are missing (helpful for setup debugging)
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

// Create and export the client
export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);
