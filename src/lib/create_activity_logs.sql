-- Create Activity Logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  user_name text NOT NULL,
  action text NOT NULL,
  details text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: members can only view activity for their own club
CREATE POLICY "Allow members to read club activity" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (club_id = public.get_user_club_id());

-- Insert policy: members can insert logs scoped to their own club
CREATE POLICY "Allow members to log activity" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (club_id = public.get_user_club_id());
