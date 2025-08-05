-- Package Submissions Table
-- This table stores user-submitted package requests with name and documentation link

CREATE TABLE IF NOT EXISTS package_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  documentation_link TEXT NOT NULL,
  description TEXT,
  email VARCHAR(255),
  is_owner BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE package_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for anonymous submissions)
CREATE POLICY "Anyone can submit packages" ON package_submissions
  FOR INSERT WITH CHECK (true);

-- Create policy to allow reading all submissions (for admin purposes)
CREATE POLICY "Anyone can read submissions" ON package_submissions
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS package_submissions_name_idx ON package_submissions(name);
CREATE INDEX IF NOT EXISTS package_submissions_status_idx ON package_submissions(status);
CREATE INDEX IF NOT EXISTS package_submissions_created_at_idx ON package_submissions(created_at);
CREATE INDEX IF NOT EXISTS package_submissions_is_owner_idx ON package_submissions(is_owner);

-- Update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_package_submissions_updated_at BEFORE UPDATE
ON package_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();