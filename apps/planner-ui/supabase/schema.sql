-- GitHub installations table for storing user's GitHub App installations
CREATE TABLE IF NOT EXISTS github_installations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    github_id bigint NOT NULL, -- GitHub's installation ID
    name text NOT NULL, -- Installation account name
    url text NOT NULL, -- Account URL
    branch text DEFAULT 'main', -- Default branch (unused, kept for compatibility)
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, github_id) -- User can only add the same installation once
);

-- Sandbox sessions table for storing Vercel Sandbox instances
CREATE TABLE IF NOT EXISTS sandbox_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    installation_id uuid REFERENCES github_installations(id) ON DELETE SET NULL, -- Reference to GitHub installation
    sandbox_id text NOT NULL UNIQUE,
    sdk_session_id text, -- SDK session ID for resuming agent sessions
    integration text NOT NULL,
    repo_url text, -- Keep for backward compatibility and local paths
    repository_url text, -- Selected repository URL from the installation
    branch text DEFAULT 'main', -- Selected branch
    conversation_history jsonb DEFAULT '[]',
    current_stage text DEFAULT 'start', -- Current stage in the planning workflow
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz NOT NULL
);

-- Create indexes for github_installations
CREATE INDEX IF NOT EXISTS idx_github_installations_user_id ON github_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_github_installations_github_id ON github_installations(github_id);

-- Create indexes for sandbox_sessions
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_user_id ON sandbox_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_installation_id ON sandbox_sessions(installation_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_sandbox_id ON sandbox_sessions(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_status ON sandbox_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_expires_at ON sandbox_sessions(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at for github_installations
CREATE TRIGGER trigger_github_installations_updated_at
    BEFORE UPDATE ON github_installations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for sandbox_sessions
CREATE TRIGGER trigger_sandbox_sessions_updated_at
    BEFORE UPDATE ON sandbox_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for github_installations
CREATE POLICY "Users can view their own installations"
    ON github_installations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own installations"
    ON github_installations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own installations"
    ON github_installations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own installations"
    ON github_installations
    FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for sandbox_sessions
CREATE POLICY "Users can view their own sessions"
    ON sandbox_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON sandbox_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON sandbox_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
    ON sandbox_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Allow service role to bypass RLS (for backend operations)
-- Note: Service role key operations automatically bypass RLS
