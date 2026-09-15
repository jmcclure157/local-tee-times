import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import {
  format,
  addDays,
  startOfDay,
  isSameDay,
  parseISO,
} from "date-fns";
import { MapPin, Calendar, ArrowRight } from "lucide-react";

import { useServerFn } from "@tanstack/react-start";
import {
  listCourses,
  listTeeTimesForDate,
  createBooking,
} from "@/lib/tee-times.functions";
import hollowCreekImage from "@/assets/course-hollow-creek.jpg";
import larkspurLinksImage from "@/assets/course-larkspur-links.jpg";
import pineHollowImage from "@/assets/course-pine-hollow.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fallbackImages = [hollowCreekImage, larkspurLinksImage, pineHollowImage];

function courseImage(index: number) {
  return fallbackImages[index % fallbackImages.length] ?? hollowCreekImage;
}

const coursesQueryOptions = queryOptions({
  queryKey: ["courses"],
  queryFn: () => listCourses(),
});

// #7: include courseId so only the selected course's times are fetched,
// and each course/date pair is cached independently.
function teeTimesQueryOptions(date: Date, courseId: string | null) {
  return queryOptions({
    queryKey: ["tee-times", format(date, "yyyy-MM-dd"), courseId ?? "all"],
    queryFn: () =>
      listTeeTimesForDate({
        data: courseId
          ? { date: format(date, "yyyy-MM-dd"), courseId }
          : { date: format(date, "yyyy-MM-dd") },
      }),

  });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Turf — Find your morning round" },
      {
        name: "description",
        content:
          "Browse local golf courses, scan available tee times, and book your next round.",
      },
      { property: "og:title", content: "Turf — Find your morning round" },
      {
        property: "og:description",
        content:
          "Browse local golf courses, scan available tee times, and book your next round.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(coursesQueryOptions),
  component: HomePage,
});

function HomePage() {
  const queryClient = useQueryClient();
  const { data: courses } = useSuspenseQuery(coursesQueryOptions);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    courses[0]?.id ?? null
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTeeTimeId, setSelectedTeeTimeId] = useState<string | null>(
    null
  );
  const [players, setPlayers] = useState(1);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  // #4: search filter state
  const [courseSearch, setCourseSearch] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId]
  );

  // #7: fetch only the selected course's tee times
  const { data: selectedCourseTeeTimes = [] } = useSuspenseQuery(
    teeTimesQueryOptions(selectedDate, selectedCourse?.id ?? null)
  );

  // #4: filtered course list based on search input
  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  const selectedTeeTime = useMemo(
    () => selectedCourseTeeTimes.find((t) => t.id === selectedTeeTimeId),
    [selectedCourseTeeTimes, selectedTeeTimeId]
  );

  // #3: clamp players to available spots whenever the selection changes
  const maxPlayers = selectedTeeTime?.available_spots ?? 4;

  const createBookingFn = useServerFn(createBooking);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startOfDay(new Date()), i));
    }
    return days;
  }, []);

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedTeeTimeId(null);
    setPlayers(1);
  };

  const handleBook = async () => {
    if (!selectedTeeTime) return;
    setBookingInProgress(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in required", {
          description: "Please sign in to book a tee time.",
        });
        return;
      }
      await createBookingFn({
        data: { teeTimeId: selectedTeeTime.id, players },
      });
      toast.success("Tee time booked", {
        description: `You're set for ${selectedCourse?.name} at ${formatTime(
          selectedTeeTime.start_time)}.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["tee-times", format(selectedDate, "yyyy-MM-dd"), selectedCourse?.id ?? "all"],
      });
      setSelectedTeeTimeId(null);
    } catch (error) {
      toast.error("Booking failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBookingInProgress(false);
    }
  };

  const openSlotsCount = selectedCourseTeeTimes.filter((t) => t.status !== "full").length;

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
            <Link to="/" className="text-ink">
              Nearby
            </Link>
            <span className="cursor-not-allowed opacity-60">My rounds</span>
            <span className="cursor-not-allowed opacity-60">Saved</span>
          </nav>
          <div className="flex items-center gap-2 text-sm font-medium">
            {selectedCourse?.booking_url && (
              <a
                href={selectedCourse.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-amber px-4 py-2 text-fairway-dark ring-1 ring-fairway-dark/10"
              >
                Book {selectedCourse.name.split(" ")[0]}
              </a>
            )}
          </div>

        </header>

        <section className="grid gap-8 border-b border-line py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="rise">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fairway">
              Tee times near you
            </p>
            <h1 className="max-w-[20ch] font-display text-5xl font-semibold leading-none tracking-tight text-balance sm:text-6xl">
              Find your morning round.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg text-ink-soft text-pretty sm:text-[17px]">
              Browse dewy local courses, scan the day's openings, and lock a tee
              before the light turns.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-5 py-3 ring-1 ring-line">
                <MapPin className="size-4 shrink-0 text-fairway" />
                <input
                  type="text"
                  placeholder="City or course"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  aria-label="Filter by city or course name"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft/70"
                />
              </div>
              <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 ring-1 ring-line">
                <Calendar className="size-4 shrink-0 text-fairway" />
                <input
                  type="date"
                  value={format(selectedDate, "yyyy-MM-dd")}
                  min={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => {
                    setSelectedDate(startOfDay(parseISO(e.target.value)));
                    setSelectedTeeTimeId(null);
                  }}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-soft">
              <span className="rounded-full bg-fairway/10 px-3 py-1 text-fairway">
                {courses.length} courses within 25 mi
              </span>
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-line">
                {openSlotsCount} open on {format(selectedDate, "EEE MMM d")}
              </span>
            </div>
          </div>

          <div
            className="rise rounded-[20px] bg-fairway p-6 text-paper"
            style={{ animationDelay: "0.08s" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/60">
                Selected round
              </span>
              <span className="text-xs font-medium text-amber">
                {format(selectedDate, "EEE d")}
              </span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              {selectedCourse?.name ?? "Select a course"}
            </h2>
            <p className="mt-1 text-sm text-paper/70">
              {selectedCourse
                ? `${(selectedCourse.yards ?? 0).toLocaleString()} yds · Par ${
                    selectedCourse.par ?? "—"
                  } · ${selectedCourse.holes ?? 18} holes`
                : "Choose a course to see details"}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-fairway-dark/60 py-3">
                <div className="font-display text-2xl font-semibold">
                  {selectedTeeTime ? formatTime(selectedTeeTime.start_time) : "—"}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-paper/50">
                  Tee
                </div>
              </div>
              <div className="rounded-xl bg-fairway-dark/60 py-3">
                <div className="font-display text-2xl font-semibold">
                  {selectedTeeTime ? `$${selectedTeeTime.price}` : "—"}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-paper/50">
                  Rate
                </div>
              </div>
              <div className="rounded-xl bg-fairway-dark/60 py-3">
                <div className="font-display text-2xl font-semibold">
                  {players}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-paper/50">
                  Players
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-fairway-dark/60 px-4 py-3 text-sm">
              <span className="text-paper/70">Players</span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((n) => {
                  const unavailable = n > maxPlayers;
                  return (
                    <button
                      key={n}
                      onClick={() => setPlayers(n)}
                      disabled={unavailable}
                      aria-label={`${n} player${n !== 1 ? "s" : ""}`}
                      aria-pressed={players === n}
                      className={`grid size-7 place-items-center rounded-full text-xs font-semibold transition ${
                        unavailable
                          ? "cursor-not-allowed opacity-30 bg-fairway-dark/60 text-paper"
                          : players === n
                          ? "bg-amber text-fairway-dark"
                          : "bg-fairway-dark/60 text-paper hover:bg-fairway-dark"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleBook}
              disabled={!selectedTeeTime || bookingInProgress}
              className="mt-5 w-full rounded-full bg-amber py-3 text-sm font-semibold text-fairway-dark ring-1 ring-amber/40 transition-transform hover:-translate-y-[1px] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {bookingInProgress ? "Booking…" : "Confirm tee time"}
            </button>
            <button
              disabled
              title="Coming soon"
              className="mt-2 w-full cursor-not-allowed rounded-full py-2 text-sm font-medium text-paper/40"
            >
              Save to my list
            </button>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Nearby courses
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex overflow-hidden rounded-full ring-1 ring-line">
                <button className="bg-fairway px-4 py-1.5 text-xs font-semibold text-paper">
                  List
                </button>
                <button
                  disabled
                  title="Coming soon"
                  className="cursor-not-allowed bg-white px-4 py-1.5 text-xs font-medium text-ink-soft opacity-50"
                >
                  Map
                </button>
              </div>
              <span className="hidden text-xs font-medium text-ink-soft sm:block">
                Sort: Openings
              </span>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {filteredCourses.map((course, index) => {
              const image = courseImage(index);
              const isLive = course.data_source === "live";
              // For the course list preview, use selectedCourseTeeTimes only for the selected course;
              // for other courses we don't have per-course data loaded (they're fetched on demand).
              const courseTeeTimes =
                course.id === selectedCourse?.id ? selectedCourseTeeTimes : [];
              const previewSlots = courseTeeTimes
                .filter((t) => t.status !== "full")
                .slice(0, 3);
              const openCount = courseTeeTimes.filter(
                (t) => t.status !== "full"
              ).length;

              return (
                <article
                  key={course.id}
                  className="rise overflow-hidden rounded-[16px] bg-white ring-1 ring-line"
                  style={{ animationDelay: `${index * 0.06}s` }}
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-fairway/10">
                    <img
                      src={image}
                      alt={`${course.name} golf course`}
                      width={1080}
                      height={720}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold tracking-tight">
                        {course.name}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isLive
                            ? "bg-fairway/10 text-fairway"
                            : "bg-paper text-ink-soft ring-1 ring-line"
                        }`}
                      >
                        {isLive ? `${openCount} open` : "Book on site"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {course.location} · {course.distance_miles ?? "?"} mi · Par{" "}
                      {course.par ?? "—"} ·{" "}
                      {(course.yards ?? 0).toLocaleString()} yds
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {isLive && previewSlots.length > 0 ? (
                        previewSlots.map((slot) => (
                          <span
                            key={slot.id}
                            className="rounded-md bg-paper px-2.5 py-1 text-xs font-medium"
                          >
                            {formatTime(slot.start_time)}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft">
                          Live times not connected ·{" "}
                          {course.booking_platform ?? "course website"}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                      <span className="text-sm font-semibold">
                        {course.price_from != null ? `from $${course.price_from}` : "—"}
                      </span>
                      {isLive ? (
                        <button
                          onClick={() => handleCourseSelect(course.id)}
                          className="text-sm font-medium text-fairway"
                        >
                          See times
                          <ArrowRight className="ml-0.5 inline size-4 shrink-0" />
                        </button>
                      ) : (
                        <a
                          href={course.booking_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-fairway"
                        >
                          Book on course site
                          <ArrowRight className="ml-0.5 inline size-4 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pb-28">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Tee times · {selectedCourse?.name}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Pick a day, then a slot
              </p>
            </div>
            <span className="text-xs font-medium text-ink-soft">
              {selectedCourse?.price_from != null
                ? `Rates from $${selectedCourse.price_from}`
                : ""}
            </span>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {weekDays.map((day) => {
              const active = isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDate(day);
                    setSelectedTeeTimeId(null);
                  }}
                  className={`shrink-0 rounded-xl px-4 py-3 text-center transition ${
                    active
                      ? "bg-fairway text-paper"
                      : "bg-white ring-1 ring-line"
                  }`}
                >
                  <div
                    className={`text-[11px] uppercase tracking-wider ${
                      active ? "text-paper/70" : "text-ink-soft"
                    }`}
                  >
                    {format(day, "EEE")}
                  </div>
                  <div className="font-display text-lg font-semibold">
                    {format(day, "d")}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedCourse?.data_source !== "live" || selectedCourseTeeTimes.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-line">
              <p className="font-medium">
                Live availability isn't connected for {selectedCourse?.name} yet.
              </p>
              <p className="mx-auto mt-2 max-w-[52ch] text-sm text-ink-soft">
                This course books through{" "}
                {selectedCourse?.booking_platform ?? "its own website"}. Check
                current openings there — we'll show them here once a feed is
                available.
              </p>
              {selectedCourse?.booking_url && (
                <a
                  href={selectedCourse.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-block rounded-full bg-fairway px-5 py-2.5 text-sm font-semibold text-paper"
                >
                  Open booking site
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {selectedCourseTeeTimes.map((slot) => {
                const selected = selectedTeeTimeId === slot.id;
                const full = slot.status === "full";
                return (
                  <button
                    key={slot.id}
                    disabled={full}
                    onClick={() => {
                      setSelectedTeeTimeId(slot.id);
                      // #3: clamp players if the newly selected slot has fewer spots
                      if (players > slot.available_spots) setPlayers(Math.max(1, slot.available_spots));
                    }}
                    aria-pressed={selected}
                    aria-label={`${formatTime(slot.start_time)}, ${full ? "full" : `${slot.available_spots} spots left`}`}
                    className={`rounded-xl py-4 text-center transition ${
                      selected
                        ? "bg-amber text-fairway-dark ring-1 ring-fairway-dark/20"
                        : full
                          ? "bg-white ring-1 ring-line opacity-60"
                          : "bg-white ring-1 ring-line hover:bg-paper"
                    }`}
                  >
                    <div className="font-display text-lg font-semibold">
                      {formatTime(slot.start_time)}
                    </div>
                    <div
                      className={`text-[11px] uppercase tracking-wider ${
                        selected
                          ? "text-fairway-dark/80"
                          : full
                            ? "text-ink-soft"
                            : slot.available_spots <= 2
                              ? "text-fairway"
                              : "text-ink-soft"
                      }`}
                    >
                      {full
                        ? "Full"
                        : selected
                          ? "Selected"
                          : `${slot.available_spots} left`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedTeeTime && selectedCourse && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {selectedCourse.name} · {format(selectedDate, "EEE d")} ·{" "}
                {formatTime(selectedTeeTime.start_time)}
              </div>
              <div className="text-xs text-ink-soft">
                {players} player{players !== 1 ? "s" : ""} · ${
                  selectedTeeTime.price
                }{" "}
                / player
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                disabled
                title="Coming soon"
                className="cursor-not-allowed rounded-full px-4 py-2.5 text-sm font-medium text-fairway ring-1 ring-fairway/20 opacity-50"
              >
                Save
              </button>
              <button
                onClick={handleBook}
                disabled={bookingInProgress}
                className="rounded-full bg-fairway px-5 py-2.5 text-sm font-semibold text-paper ring-1 ring-fairway disabled:opacity-50"
              >
                {bookingInProgress ? "Booking…" : "Book tee time"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// #2: formatTime now accepts a timezone so each course renders in its local time.
// The formatter is created per-timezone and cached to avoid recreating on every render.
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
