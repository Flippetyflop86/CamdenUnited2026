-- 1. Create Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Email Templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated managers to manage email templates" 
  ON email_templates 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 2. Create Email History Table
CREATE TABLE IF NOT EXISTS email_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body_content text NOT NULL,
  recipient_group text NOT NULL,
  recipients_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Delivered',
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Email History
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated managers to view email history" 
  ON email_history 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 3. Add session_code to matches and training_sessions tables if not exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS session_code text;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_code text;
