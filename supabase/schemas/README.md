# Supabase Schema Documentation

This directory contains the declarative schema definitions for the Supabase database.

## Tables

### packages

The `packages` table stores user-created package configurations for the MCP Package Manager.

#### Schema

| Column                   | Type          | Constraints                                           | Description                                     |
| ------------------------ | ------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `id`                     | `uuid`        | PRIMARY KEY, DEFAULT gen_random_uuid()                | Unique identifier for the package               |
| `user_id`                | `uuid`        | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the package                            |
| `name`                   | `text`        | NOT NULL, CHECK (char_length(name) > 0)               | Package name                                    |
| `description`            | `text`        | NOT NULL, CHECK (char_length(description) > 0)        | Package description                             |
| `setup_prompt`           | `text`        | NULLABLE                                              | Optional setup instructions                     |
| `tags`                   | `text[]`      | DEFAULT '{}'                                          | Array of tags for categorization                |
| `metadata`               | `jsonb`       | DEFAULT '{}'                                          | Additional metadata in JSON format              |
| `relevant_files_pattern` | `text[]`      | DEFAULT '{}'                                          | Array of file patterns relevant to this package |
| `language`               | `text`        | NOT NULL, CHECK (char_length(language) > 0)           | Programming language                            |
| `created_at`             | `timestamptz` | DEFAULT now(), NOT NULL                               | Creation timestamp                              |
| `updated_at`             | `timestamptz` | DEFAULT now(), NOT NULL                               | Last update timestamp                           |

#### Unique Constraints

- `(user_id, name)` - Each user can only have one package with a given name

#### Indexes

- `idx_packages_user_id` - B-tree index on user_id for fast user-specific queries
- `idx_packages_language` - B-tree index on language for filtering by programming language
- `idx_packages_tags` - GIN index on tags array for tag-based searches
- `idx_packages_metadata` - GIN index on metadata jsonb for metadata queries
- `idx_packages_created_at` - B-tree index on created_at for date-based sorting
- `idx_packages_updated_at` - B-tree index on updated_at for recent updates
- `idx_packages_search` - GIN text search index on name and description for full-text search

#### Triggers

- `trigger_packages_updated_at` - Automatically updates the `updated_at` field on row modifications

#### Row Level Security (RLS)

The table implements Row Level Security with the following policies:

- `packages_user_isolation` - Users can only access their own packages
- `packages_user_insert` - Users can only insert packages for themselves
- `packages_user_update` - Users can only update their own packages
- `packages_user_delete` - Users can only delete their own packages

#### Usage Examples

```sql
-- Insert a new package
INSERT INTO packages (user_id, name, description, language, tags, metadata, relevant_files_pattern)
VALUES (
    auth.uid(),
    'react-component-boilerplate',
    'A reusable React component template with TypeScript',
    'typescript',
    ARRAY['react', 'typescript', 'component'],
    '{"framework": "react", "version": "18.x"}',
    ARRAY['**/*.tsx', '**/*.ts', 'package.json']
);

-- Search packages by language
SELECT * FROM packages WHERE language = 'typescript';

-- Search packages by tags
SELECT * FROM packages WHERE tags && ARRAY['react'];

-- Full-text search in name and description
SELECT * FROM packages
WHERE to_tsvector('english', name || ' ' || description)
@@ plainto_tsquery('english', 'react component');

-- Get user's packages ordered by most recent
SELECT * FROM packages
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;
```

## Schema Management

This is a declarative schema setup. To apply changes:

1. Edit the schema files in this directory
2. The schema will be automatically applied to the Supabase project
3. No manual migrations are needed

## Project Information

- **Supabase Project ID**: sfcheddgbldthfcxoaqn (typeconf)
- **Schema Type**: Declarative
- **Database**: PostgreSQL with Supabase extensions
