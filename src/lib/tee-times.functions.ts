import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPublishableClient } from "@/lib/supabase-server";

export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getPublishableClient();
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('distance_miles', { ascending: true });
  if (error) throw error;
  return data ?? [];
});

export const listTeeTimesForDate = createServerFn({ method: "GET" })
  .inputValidator((data: { courseId?: string; date?: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getPublishableClient();
    const targetDate = data.date ? new Date(data.date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    let query = supabase
      .from('tee_times')
      .select('*')
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString())
      .order('start_time', { ascending: true });

    if (data.courseId) {
      query = query.eq('course_id', data.courseId);
    }

    const { data: teeTimes, error } = await query;
    if (error) throw error;
    return teeTimes ?? [];
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { teeTimeId: string; players: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Single atomic RPC — decrements available_spots and inserts the booking
    // in one transaction, preventing double-booking races.
    const { data: booking, error } = await supabase
      .rpc('book_tee_time', {
        p_tee_time_id: data.teeTimeId,
        p_user_id: userId,
        p_players: data.players,
      })
      .single();
    if (error) throw new Error(error.message);

    return booking;
  });

export const listMyRounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        players,
        status,
        created_at,
        tee_time_id,
        tee_times (
          id,
          start_time,
          price,
          courses (
            id,
            name,
            location,
            timezone,
            holes,
            par
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listSavedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from('saved_courses')
      .select(`
        id,
        created_at,
        courses (
          id,
          name,
          location,
          distance_miles,
          par,
          yards,
          holes,
          price_from,
          booking_url,
          booking_platform,
          data_source,
          timezone
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const toggleSavedCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check if already saved
    const { data: existing } = await supabase
      .from('saved_courses')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', data.courseId)
      .maybeSingle();

    if (existing) {
      // Unsave
      const { error } = await supabase
        .from('saved_courses')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { saved: false };
    } else {
      // Save
      const { error } = await supabase
        .from('saved_courses')
        .insert({ user_id: userId, course_id: data.courseId });
      if (error) throw error;
      return { saved: true };
    }
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookingId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get booking to restore spots
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('players, tee_time_id, status')
      .eq('id', data.bookingId)
      .eq('user_id', userId)
      .single();
    if (fetchError) throw fetchError;
    if (booking.status === 'cancelled') throw new Error('Already cancelled');

    // Mark booking cancelled
    const { error: cancelError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', data.bookingId)
      .eq('user_id', userId);
    if (cancelError) throw cancelError;

    // Restore available spots on the tee time
    const { error: restoreError } = await supabase
      .rpc('restore_tee_time_spots', {
        p_tee_time_id: booking.tee_time_id,
        p_players: booking.players,
      });
    if (restoreError) throw restoreError;

    return { cancelled: true };
  });
