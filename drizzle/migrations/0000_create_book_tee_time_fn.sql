create or replace function public.book_tee_time(p_tee_time_id uuid, p_user_id uuid, p_players integer)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  update public.tee_times
     set available_spots = available_spots - p_players,
         status = case when available_spots - p_players <= 0 then 'full' else status end
   where id = p_tee_time_id
     and available_spots >= p_players;

  if not found then
    raise exception 'Not enough spots available';
  end if;

  insert into public.bookings (tee_time_id, user_id, players)
  values (p_tee_time_id, p_user_id, p_players)
  returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.book_tee_time(uuid, uuid, integer) to authenticated;
grant execute on function public.book_tee_time(uuid, uuid, integer) to service_role;