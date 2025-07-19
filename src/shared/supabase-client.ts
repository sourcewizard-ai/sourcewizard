import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
}

export class SupabaseAuth {
  private client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database> = supabase) {
    this.client = client;
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(`Sign up failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  /**
   * Get the current user session
   */
  async getSession() {
    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }

    return session;
  }

  /**
   * Get the current user
   */
  async getUser() {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();

    if (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return user;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getSession();
      return session !== null;
    } catch {
      return false;
    }
  }

  /**
   * Set session from stored token (for CLI persistence)
   */
  async setSession(accessToken: string, refreshToken: string) {
    const { data, error } = await this.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw new Error(`Failed to set session: ${error.message}`);
    }

    return data;
  }
}

// Export default instance
export const auth = new SupabaseAuth();
