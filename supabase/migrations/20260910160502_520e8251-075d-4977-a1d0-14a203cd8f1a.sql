ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS booking_platform text,
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'link_out';

DELETE FROM public.bookings;
DELETE FROM public.tee_times;
DELETE FROM public.courses;

INSERT INTO public.courses (name, location, distance_miles, par, yards, holes, price_from, booking_url, booking_platform, data_source) VALUES
('Cedar Crest Golf Course', 'Dallas, TX', 6, 71, 6550, 18, 30, 'https://www.golfdallas.org/', 'City of Dallas booking widget', 'link_out'),
('Waterchase Golf Course', 'Fort Worth, TX', 28, 72, 7304, 18, 45, 'https://www.waterchasegolf.com/', 'GolfNow', 'link_out'),
('Golf Club of Dallas', 'Dallas, TX', 9, 71, 6500, 18, 60, 'https://www.golfclubofdallas.com/', 'Purpose Golf', 'link_out'),
('Bear Creek Golf Club', 'Irving, TX', 17, 72, 6670, 36, 55, 'https://www.bearcreekgolfclub.com/', 'Arcis Golf / Quick18', 'link_out'),
('Texas Star Golf Course', 'Euless, TX', 22, 71, 6936, 18, 50, 'https://www.texasstargolf.com/', 'Course booking system', 'link_out'),
('Cowboys Golf Club', 'Grapevine, TX', 25, 72, 7017, 18, 130, 'https://www.cowboysgolfclub.com/', 'Arcis Golf / Quick18', 'link_out');