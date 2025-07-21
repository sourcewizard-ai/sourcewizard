import {
  AuthSession,
  createClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import { Database } from "./database-types.js";

// Supabase configuration constants
const SUPABASE_URL = "https://sfcheddgbldthfcxoaqn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY2hlZGRnYmxkdGhmY3hvYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE3OTM1MzgsImV4cCI6MjA0NzM2OTUzOH0.pErXNTPwqK71LA-mC3tfZdPtE8rYySyaOo1czW-MpEs";

// Create Supabase client
export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
