import { createClient } from "@/lib/supabase/server";
import HoyView from "@/components/hoy/HoyView";
import type { Checkin, ExamResult, Habit, HabitLog, Task, WeeklyReview, WeightLog } from "@/lib/types";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ prefillDate?: string }>;
}) {
  const { prefillDate } = await searchParams;
  const supabase = await createClient();

  const [
    tasksRes,
    habitsRes,
    habitLogsRes,
    profileRes,
    reviewsRes,
    insightRes,
    checkinsRes,
    weightRes,
    examsRes,
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("done", false),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase.from("profile").select("content").maybeSingle(),
    supabase.from("weekly_reviews").select("*").order("week_key", { ascending: false }).limit(3),
    supabase
      .from("weekly_reviews")
      .select("review_date,coach_conclusion,coach_semana,coach_accion")
      .not("coach_conclusion", "is", null)
      .order("review_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("checkins").select("*").order("created_at", { ascending: true }),
    supabase.from("weight_log").select("*").order("recorded_on", { ascending: true }),
    supabase.from("exam_results").select("*").order("taken_on", { ascending: false }),
  ]);

  return (
    <HoyView
      initialTasks={(tasksRes.data as Task[]) ?? []}
      habits={(habitsRes.data as Habit[]) ?? []}
      initialHabitLogs={(habitLogsRes.data as HabitLog[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      recentWeekKeys={(reviewsRes.data as WeeklyReview[] ?? []).map((r) => r.week_key)}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      prefillDate={prefillDate}
      lastInsight={insightRes.data ?? null}
      checkins={(checkinsRes.data as Checkin[]) ?? []}
      weightLog={(weightRes.data as WeightLog[]) ?? []}
      examResults={(examsRes.data as ExamResult[]) ?? []}
    />
  );
}
