-- Installation Evals Table
-- This table stores evaluation data for installation runs including prompts, tokens, and tool outputs

CREATE TABLE IF NOT EXISTS installation_evals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    package_name text NOT NULL,
    repo_info jsonb NOT NULL,
    system_prompt text NOT NULL,
    prompt text NOT NULL,
    input_tokens integer,
    output_tokens integer,
    tool_output jsonb NOT NULL,
    model_response text,
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT installation_evals_package_name_not_empty CHECK (char_length(package_name) > 0),
    CONSTRAINT installation_evals_system_prompt_not_empty CHECK (char_length(system_prompt) > 0),
    CONSTRAINT installation_evals_prompt_not_empty CHECK (char_length(prompt) > 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_installation_evals_user_id ON installation_evals(user_id);
CREATE INDEX IF NOT EXISTS idx_installation_evals_package_name ON installation_evals(package_name);
CREATE INDEX IF NOT EXISTS idx_installation_evals_created_at ON installation_evals(created_at);
CREATE INDEX IF NOT EXISTS idx_installation_evals_input_tokens ON installation_evals(input_tokens);
CREATE INDEX IF NOT EXISTS idx_installation_evals_output_tokens ON installation_evals(output_tokens);
CREATE INDEX IF NOT EXISTS idx_installation_evals_repo_info ON installation_evals USING GIN(repo_info);
CREATE INDEX IF NOT EXISTS idx_installation_evals_tool_output ON installation_evals USING GIN(tool_output);

-- Row Level Security (RLS) policies
ALTER TABLE installation_evals ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to read their own evals
CREATE POLICY installation_evals_read_own ON installation_evals
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Allow authenticated users to read all evals for analysis (admin access)
CREATE POLICY installation_evals_read_authenticated ON installation_evals
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Allow service role to insert evals
CREATE POLICY installation_evals_service_insert ON installation_evals
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow authenticated users to insert evals for testing
CREATE POLICY installation_evals_authenticated_insert ON installation_evals
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND (user_id IS NULL OR auth.uid() = user_id));