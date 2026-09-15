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
