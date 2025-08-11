-- Packages table for storing user-created package configurations
CREATE TABLE IF NOT EXISTS packages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL,
    setup_prompt text,
    tags text[] DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    relevant_files_pattern text[] DEFAULT '{}',
    language text NOT NULL,
    staging boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT packages_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT packages_description_not_empty CHECK (char_length(description) > 0),
    CONSTRAINT packages_language_not_empty CHECK (char_length(language) > 0),
    
    -- Unique constraint for user_id + name combination
    UNIQUE(user_id, name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_packages_user_id ON packages(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_language ON packages(language);
CREATE INDEX IF NOT EXISTS idx_packages_tags ON packages USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_packages_metadata ON packages USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_packages_created_at ON packages(created_at);
CREATE INDEX IF NOT EXISTS idx_packages_updated_at ON packages(updated_at);
CREATE INDEX IF NOT EXISTS idx_packages_staging ON packages(staging);

-- Create text search index for name and description
CREATE INDEX IF NOT EXISTS idx_packages_search ON packages USING GIN(
    to_tsvector('english', name || ' ' || description)
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION name_description(packages)
RETURNS TEXT AS $$
 SELECT $1.name || ' ' || $1.description;
$$ LANGUAGE SQL IMMUTABLE;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_packages_updated_at
    BEFORE UPDATE ON packages
    FOR EACH ROW
    EXECUTE FUNCTION update_packages_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read any packages
CREATE POLICY packages_read_all ON packages
    FOR SELECT
    USING (true);

-- Policy: Users can insert their own packages
CREATE POLICY packages_user_insert ON packages
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own packages
CREATE POLICY packages_user_update ON packages
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own packages
CREATE POLICY packages_user_delete ON packages
    FOR DELETE
    USING (auth.uid() = user_id); 