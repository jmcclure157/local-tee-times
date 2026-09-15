-- saved_courses: lets authenticated users bookmark courses for later.
CREATE TABLE public.saved_courses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  uuid        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.saved_courses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.saved_courses TO authenticated;
GRANT ALL ON public.saved_courses TO service_role;

CREATE POLICY "Users manage their own saved courses"
  ON public.saved_courses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- restore_tee_time_spots: called when a booking is cancelled to give spots back.
CREATE OR REPLACE FUNCTION public.restore_tee_time_spots(
  p_tee_time_id uuid,
  p_players     int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tee_times
  SET
    available_spots = LEAST(available_spots + p_players, max_spots),
    status          = 'available'
  WHERE id = p_tee_time_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_tee_time_spots(uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.restore_tee_time_spots(uuid, int) TO authenticated;
