import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Calendar, Users, DollarSign, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { listMyRounds, cancelBooking } from "@/lib/tee-times.functions";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const myRoundsQueryOptions = queryOptions({
  queryKey: ["my-rounds"],
  queryFn: () => listMyRounds(),
});

export const Route = createFileRoute("/rounds")({
  head: () => ({
    meta: [
      { title: "My Rounds — Turf" },
      { name: "description", content: "View and manage your booked tee times." },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(myRoundsQueryOptions),
  component: RoundsPage,
});

// #2: reuse the same per-timezone cached formatter from index.tsx
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();
function getTimeFormatter(timezone: string) {
  let fmt = timeFormatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
    timeFormatterCache.set(timezone, fmt);
  }
  return fmt;
}
function formatTime(iso: string, timezone = "America/Chicago") {
  return getTimeFormatter(timezone).format(parseISO(iso)).replace(":00", "").toLowerCase();
}

function RoundsPage() {
  const queryClient = useQueryClient();
  const { data: rounds } = useSuspenseQuery(myRoundsQueryOptions);
  const cancelBookingFn = useServerFn(cancelBooking);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const confirmed = rounds.filter((r) => r.status !== "cancelled");
  const cancelled = rounds.filter((r) => r.status === "cancelled");

  const handleCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in required");
        return;
      }
      await cancelBookingFn({ data: { bookingId } });
      toast.success("Booking cancelled", {
        description: "Your spot has been released.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-rounds"] });
    } catch (error) {
      toast.error("Couldn't cancel", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-center justify-between py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-fairway font-display text-sm font-semibold text-paper">
              T
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Turf
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-soft sm:flex">
            <Link to="/" className="text-ink-soft hover:text-ink">
              Nearby
            </Link>
            <Link to="/rounds" className="text-ink">
              My rounds
            </Link>
            <Link to="/saved" className="text-ink-soft hover:text-ink">
              Saved
            </Link>
          </nav>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </header>

        <section className="py-8">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-fairway">
              Your history
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              My rounds
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {confirmed.length} upcoming or confirmed · {cancelled.length} cancelled
            </p>
          </div>

          {rounds.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-line">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-fairway/10">
                <Calendar className="size-5 text-fairway" />
              </div>
              <p className="font-display text-xl font-semibold">No rounds yet</p>
              <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink-soft">
                Book a tee time and it'll show up here.
              </p>
              <Link
                to="/"
                className="mt-5 inline-block rounded-full bg-fairway px-5 py-2.5 text-sm font-semibold text-paper"
              >
                Find a tee time
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {confirmed.length > 0 && (
                <>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
                    Confirmed
                  </h2>
                  {confirmed.map((round) => {
                    const teeTime = round.tee_times as {
                      id: string;
                      start_time: string;
                      price: number;
                      courses: {
                        id: string;
                        name: string;
                        location: string | null;
                        timezone: string;
                        holes: number | null;
                        par: number | null;
                      } | null;
                    } | null;
                    const course = teeTime?.courses;
                    const isCancelling = cancellingId === round.id;
                    const isPast = teeTime
                      ? new Date(teeTime.start_time) < new Date()
                      : false;

                    return (
                      <div
                        key={round.id}
                        className="rounded-2xl bg-white ring-1 ring-line overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-line">
                          <div>
                            <div className="font-display text-xl font-semibold tracking-tight">
                              {course?.name ?? "Unknown course"}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
                              <MapPin className="size-3.5 shrink-0" />
                              {course?.location ?? "—"}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                              isPast
                                ? "bg-paper text-ink-soft ring-1 ring-line"
                                : "bg-fairway/10 text-fairway"
                            }`}
                          >
                            {isPast ? "Completed" : "Upcoming"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-line px-0">
                          <div className="flex flex-col items-center gap-1 py-4">
                            <Clock className="size-4 text-ink-soft" />
                            <div className="font-display text-lg font-semibold">
                              {teeTime
                                ? formatTime(teeTime.start_time, course?.timezone)
                                : "—"}
                            </div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-soft">
                              {teeTime
                                ? format(parseISO(teeTime.start_time), "EEE MMM d")
                                : "—"}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 py-4">
                            <Users className="size-4 text-ink-soft" />
                            <div className="font-display text-lg font-semibold">
                              {round.players}
                            </div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-soft">
                              Player{round.players !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 py-4">
                            <DollarSign className="size-4 text-ink-soft" />
                            <div className="font-display text-lg font-semibold">
                              ${teeTime ? teeTime.price * round.players : "—"}
                            </div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-soft">
                              Total
                            </div>
                          </div>
                        </div>
                        {!isPast && (
                          <div className="border-t border-line px-5 py-3 flex justify-end">
                            <button
                              onClick={() => handleCancel(round.id)}
                              disabled={isCancelling}
                              className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              {isCancelling ? "Cancelling…" : "Cancel booking"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {cancelled.length > 0 && (
                <>
                  <h2 className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
                    Cancelled
                  </h2>
                  {cancelled.map((round) => {
                    const teeTime = round.tee_times as {
                      id: string;
                      start_time: string;
                      price: number;
                      courses: {
                        id: string;
                        name: string;
                        location: string | null;
                        timezone: string;
                        holes: number | null;
                        par: number | null;
                      } | null;
                    } | null;
                    const course = teeTime?.courses;

                    return (
                      <div
                        key={round.id}
                        className="rounded-2xl bg-white ring-1 ring-line overflow-hidden opacity-60"
                      >
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div>
                            <div className="font-display text-lg font-semibold tracking-tight line-through">
                              {course?.name ?? "Unknown course"}
                            </div>
                            <div className="mt-0.5 text-sm text-ink-soft">
                              {teeTime
                                ? `${format(parseISO(teeTime.start_time), "EEE MMM d")} · ${formatTime(teeTime.start_time, course?.timezone)} · ${round.players} player${round.players !== 1 ? "s" : ""}`
                                : "—"}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line">
                            Cancelled
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
