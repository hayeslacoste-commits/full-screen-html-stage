CREATE TABLE public.saved_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.saved_games TO service_role;
ALTER TABLE public.saved_games ENABLE ROW LEVEL SECURITY;
-- No public policies: only the server (after the private sign-in check) can read or write.