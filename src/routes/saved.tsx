import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bookmark, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { listSavedCourses, toggleSavedCourse } from "@/lib/tee-times.functions";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const savedCoursesQueryOptions = queryOptions({
  queryKey: ["saved-courses"],
  queryFn: () => listSavedCourses(),
});

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Courses — Turf" },
      { name: "description", content: "Your saved golf courses." },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(savedCoursesQueryOptions),
  component: SavedPage,
});

function SavedPage() {
  const queryClient = useQueryClient();
  const { data: saved } = useSuspenseQuery(savedCoursesQueryOptions);
  const toggleSavedFn = useServerFn(toggleSavedCourse);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (courseId: string, savedId: string) => {
    setRemovingId(savedId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in required");
        return;
      }
      await toggleSavedFn({ data: { courseId } });
      toast.success("Removed from saved");
      queryClient.invalidateQueries({ queryKey: ["saved-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    } catch (error) {
      toast.error("Couldn't remove", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setRemovingId(null);
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
            <Link to="/rounds" className="text-ink-soft hover:text-ink">
              My rounds
            </Link>
            <Link to="/saved" className="text-ink">
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
              Your list
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Saved courses
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {saved.length} course{saved.length !== 1 ? "s" : ""} saved
            </p>
          </div>

          {saved.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-line">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-fairway/10">
                <Bookmark className="size-5 text-fairway" />
              </div>
              <p className="font-display text-xl font-semibold">No saved courses</p>
              <p className="mx-auto mt-2 max-w-[40ch] text-sm text-ink-soft">
                Tap the bookmark on any course to save it here for quick access.
              </p>
              <Link
                to="/"
                className="mt-5 inline-block rounded-full bg-fairway px-5 py-2.5 text-sm font-semibold text-paper"
              >
                Browse courses
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {saved.map((item) => {
                const course = item.courses as {
                  id: string;
                  name: string;
                  location: string | null;
                  distance_miles: number | null;
                  par: number | null;
                  yards: number | null;
                  holes: number | null;
                  price_from: number | null;
                  booking_url: string | null;
                  booking_platform: string | null;
                  data_source: string;
                  timezone: string;
                } | null;

                if (!course) return null;
                const isRemoving = removingId === item.id;
                const isLive = course.data_source === "live";

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white ring-1 ring-line overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="font-display text-xl font-semibold tracking-tight">
                          {course.name}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                          <MapPin className="size-3.5 shrink-0" />
                          {course.location ?? "—"} · {course.distance_miles ?? "?"} mi
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
                          {course.par != null && <span>Par {course.par}</span>}
                          {course.yards != null && <span>{course.yards.toLocaleString()} yds</span>}
                          {course.holes != null && <span>{course.holes} holes</span>}
                          {course.price_from != null && (
                            <span className="font-semibold text-ink">from ${course.price_from}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(course.id, item.id)}
                        disabled={isRemoving}
                        title="Remove from saved"
                        aria-label="Remove from saved"
                        className="shrink-0 grid size-8 place-items-center rounded-full bg-fairway/10 text-fairway transition hover:bg-fairway/20 disabled:opacity-50"
                      >
                        <Bookmark className="size-4 fill-fairway" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-t border-line px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isLive
                            ? "bg-fairway/10 text-fairway"
                            : "bg-paper text-ink-soft ring-1 ring-line"
                        }`}
                      >
                        {isLive ? "Live times" : "Book on site"}
                      </span>
                      {isLive ? (
                        <Link
                          to="/"
                          className="flex items-center gap-0.5 text-sm font-medium text-fairway"
                        >
                          See tee times
                          <ArrowRight className="size-4" />
                        </Link>
                      ) : (
                        <a
                          href={course.booking_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-sm font-medium text-fairway"
                        >
                          Book on course site
                          <ArrowRight className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
