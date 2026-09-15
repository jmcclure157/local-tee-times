-- Creates a function that regenerates tee times on a rolling 7-day window
-- so the app always has current availability regardless of when the migration was run.
-- Call this via pg_cron or a Supabase Edge Function cron to keep slots fresh.

CREATE OR REPLACE FUNCTION public.refresh_tee_times()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course    record;
  v_day       date;
  v_slot_time timestamptz;
  v_spots     int;
  v_slots     text[] := ARRAY[
    '07:00','07:20','07:40','08:00','08:15','08:30',
    '09:00','09:05','09:20','09:40','10:00','10:15',
    '10:30','10:45','11:00','11:20','11:40','12:00',
    '12:20','12:40','13:00','13:20','13:40','14:00'
  ];
  v_slot      text;
  v_day_offset int;
BEGIN
  -- Delete slots that have already passed (older than today) or are more than 7 days out.
  DELETE FROM public.tee_times
  WHERE start_time < date_trunc('day', now())
     OR start_time >= date_trunc('day', now()) + interval '8 days';

  -- Insert slots for today + 7 days ahead, skipping any that already exist.
  FOR v_course IN SELECT id, price_from FROM public.courses WHERE data_source = 'live' LOOP
    FOR v_day_offset IN 0..6 LOOP
      v_day := (CURRENT_DATE + v_day_offset);
      FOREACH v_slot IN ARRAY v_slots LOOP
        v_slot_time := (v_day::text || ' ' || v_slot)::timestamptz;

        -- Only insert if this slot doesn't already exist (idempotent).
        IF NOT EXISTS (
          SELECT 1 FROM public.tee_times
          WHERE course_id = v_course.id AND start_time = v_slot_time
        ) THEN
          v_spots := 4 - floor(random() * 5)::int;
          IF v_spots < 0 THEN v_spots := 0; END IF;

          INSERT INTO public.tee_times (course_id, start_time, price, available_spots, max_spots, status)
          VALUES (
            v_course.id,
            v_slot_time,
            v_course.price_from + floor(random() * 40)::int,
            v_spots,
            4,
            CASE WHEN v_spots = 0 THEN 'full' ELSE 'available' END
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- Grant execute to service_role so a cron job / Edge Function can call it.
REVOKE EXECUTE ON FUNCTION public.refresh_tee_times() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refresh_tee_times() TO service_role;

-- Do an immediate refresh so slots are populated right after this migration runs.
SELECT public.refresh_tee_times();
