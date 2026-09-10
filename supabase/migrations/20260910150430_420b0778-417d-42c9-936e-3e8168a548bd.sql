CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  distance_miles integer,
  par integer,
  yards integer,
  holes integer DEFAULT 18,
  image_url text,
  price_from integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tee_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  price integer NOT NULL,
  available_spots integer NOT NULL DEFAULT 4,
  max_spots integer NOT NULL DEFAULT 4,
  status text DEFAULT 'available' CHECK (status IN ('available', 'full', 'booked')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tee_time_id uuid NOT NULL REFERENCES public.tee_times(id) ON DELETE CASCADE,
  players integer DEFAULT 1 NOT NULL,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tee_time_id)
);

GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;

GRANT SELECT ON public.tee_times TO anon;
GRANT SELECT ON public.tee_times TO authenticated;
GRANT ALL ON public.tee_times TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tee_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public courses are viewable by everyone"
ON public.courses FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public tee times are viewable by everyone"
ON public.tee_times FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can manage their own bookings"
ON public.bookings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.courses (name, location, distance_miles, par, yards, holes, image_url, price_from) VALUES
('Hollow Creek', 'West Ridge', 14, 72, 7214, 18, 'course-hollow-creek', 86),
('Larkspur Links', 'Coastal Dunes', 9, 71, 6890, 18, 'course-larkspur-links', 112),
('Pine Hollow', 'Pine Valley', 22, 70, 6540, 18, 'course-pine-hollow', 64);

DO $$
DECLARE
  course_record record;
  day_offset integer;
  base_time timestamptz;
  slot_time timestamptz;
  slots text[] := ARRAY['07:00', '07:20', '07:40', '08:00', '08:15', '08:30', '09:00', '09:05', '09:20', '09:40', '10:00', '10:15', '10:30', '10:45', '11:00', '11:20', '11:40', '12:00', '12:20', '12:40', '13:00', '13:20', '13:40', '14:00'];
  slot text;
  spots integer;
BEGIN
  FOR course_record IN SELECT id, price_from FROM public.courses LOOP
    FOR day_offset IN 0..6 LOOP
      base_time := date_trunc('day', now() + interval '1 day' * day_offset);
      FOREACH slot IN ARRAY slots LOOP
        slot_time := base_time + slot::time;
        spots := 4 - floor(random() * 5)::int;
        IF spots < 0 THEN spots := 0; END IF;
        INSERT INTO public.tee_times (course_id, start_time, price, available_spots, max_spots, status)
        VALUES (
          course_record.id,
          slot_time,
          course_record.price_from + floor(random() * 40)::int,
          spots,
          4,
          CASE WHEN spots = 0 THEN 'full' ELSE 'available' END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;