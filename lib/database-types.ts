/**
 * Database types for Supabase tables
 * Auto-generated to match the schema in supabase/schemas/
 */

export interface Database {
  public: {
    Tables: {
      packages: {
        Row: PackageRow;
        Insert: PackageInsert;
        Update: PackageUpdate;
      };
    };
  };
}

export interface PackageRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  setup_prompt: string | null;
  tags: string[];
  metadata: Record<string, any>;
  relevant_files_pattern: string[];
  language: string;
  created_at: string;
  updated_at: string;
}

export interface PackageInsert {
  id?: string;
  user_id: string;
  name: string;
  description: string;
  setup_prompt?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
  relevant_files_pattern?: string[];
  language: string;
  created_at?: string;
  updated_at?: string;
}

export interface PackageUpdate {
  id?: string;
  user_id?: string;
  name?: string;
  description?: string;
  setup_prompt?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
  relevant_files_pattern?: string[];
  language?: string;
  created_at?: string;
  updated_at?: string;
}

// Utility types for working with packages
export type PackageWithoutTimestamps = Omit<
  PackageRow,
  "created_at" | "updated_at"
>;
export type PackageCreateInput = Omit<
  PackageInsert,
  "id" | "created_at" | "updated_at"
>;
export type PackageUpdateInput = Omit<
  PackageUpdate,
  "id" | "user_id" | "created_at" | "updated_at"
>;

// Search and filter types
export interface PackageSearchFilters {
  language?: string;
  tags?: string[];
  user_id?: string;
  search_query?: string;
}

export interface PackageSearchOptions {
  filters?: PackageSearchFilters;
  limit?: number;
  offset?: number;
  order_by?: "created_at" | "updated_at" | "name";
  order_direction?: "asc" | "desc";
}

export interface PackageSearchResult {
  packages: PackageRow[];
  total_count: number;
  has_more: boolean;
}
