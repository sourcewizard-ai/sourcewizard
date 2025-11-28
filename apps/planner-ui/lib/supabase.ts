import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Create a single shared Supabase client instance
export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
