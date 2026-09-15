-- Atomically books a tee time inside a single transaction.
-- Decrements available_spots (guarded by a row-level check) and inserts
-- the booking in one round-trip, preventing double-booking races.
CREATE OR REPLACE FUNCTION public.book_tee_time(
  p_tee_time_id uuid,
  p_user_id     uuid,
  p_players     int
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  -- Lock the row and decrement spots atomically.
  -- The WHERE clause ensures we only proceed when there are enough spots.
  UPDATE public.tee_times
  SET
    available_spots = available_spots - p_players,
    status          = CASE WHEN (available_spots - p_players) = 0 THEN 'full' ELSE 'available' END
  WHERE id             = p_tee_time_id
    AND status        <> 'full'
    AND available_spots >= p_players;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough spots available'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bookings (tee_time_id, user_id, players)
  VALUES (p_tee_time_id, p_user_id, p_players)
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- Only authenticated users may call this function.
REVOKE EXECUTE ON FUNCTION public.book_tee_time(uuid, uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.book_tee_time(uuid, uuid, int) TO authenticated;
