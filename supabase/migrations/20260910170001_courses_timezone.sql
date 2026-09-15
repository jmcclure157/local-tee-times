-- Add a timezone column to courses so tee times display in the correct local time.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Chicago';

-- Back-fill real values for the seeded DFW courses (all Central time).
UPDATE public.courses SET timezone = 'America/Chicago';
