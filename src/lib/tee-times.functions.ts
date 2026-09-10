import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function createPublishableClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const url = process.env['SUPABASE_URL']!;
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) {
          h.delete('Authorization');
        }
        h.set('apikey', key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listCourses = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublishableClient();
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
    const supabase = createPublishableClient();
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

    const { data: teeTime, error: teeTimeError } = await supabase
      .from('tee_times')
      .select('available_spots, status')
      .eq('id', data.teeTimeId)
      .single();
    if (teeTimeError) throw teeTimeError;
    if (!teeTime || teeTime.available_spots < data.players || teeTime.status === 'full') {
      throw new Error('Not enough spots available');
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        tee_time_id: data.teeTimeId,
        user_id: userId,
        players: data.players,
      })
      .select()
      .single();
    if (error) throw error;

    const newSpots = teeTime.available_spots - data.players;
    const { error: updateError } = await supabase
      .from('tee_times')
      .update({
        available_spots: newSpots,
        status: newSpots === 0 ? 'full' : 'available',
      })
      .eq('id', data.teeTimeId);
    if (updateError) throw updateError;

    return booking;
  });
