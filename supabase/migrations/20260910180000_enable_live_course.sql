-- Flip Cedar Crest Golf Course to live data so the booking flow is functional.
-- Then regenerate the rolling 7-day tee time window for all live courses.
UPDATE public.courses
SET data_source = 'live'
WHERE name = 'Cedar Crest Golf Course';

SELECT public.refresh_tee_times();
