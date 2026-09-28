import { createClient } from "@/lib/supabase/server";
import CoachView from "@/components/coach/CoachView";
import type {
  Checkin,
  ExamResult,
  Habit,
  HabitLog,
  HealthVerdict,
  Task,
  WeeklyReview,
  WeightLog,
} from "@/lib/types";

export default async function CoachPage() {
  const supabase = await createClient();

  const [
    checkinsRes,
    weightRes,
    examsRes,
    verdictsRes,
    habitsRes,
    habitLogsRes,
    tasksRes,
    profileRes,
    insightRes,
    reviewsRes,
  ] = await Promise.all([
    supabase.from("checkins").select("*").order("created_at", { ascending: true }),
    supabase.from("weight_log").select("*").order("recorded_on", { ascending: true }),
    supabase.from("exam_results").select("*").order("taken_on", { ascending: false }),
    supabase.from("health_verdicts").select("*").order("created_at", { ascending: false }).limit(1),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase.from("tasks").select("*").eq("done", false),
    supabase.from("profile").select("content").maybeSingle(),
    supabase
      .from("weekly_reviews")
      .select("review_date,coach_conclusion,coach_semana,coach_accion")
      .not("coach_conclusion", "is", null)
      .order("review_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
  ]);

  return (
    <CoachView
      initialCheckins={(checkinsRes.data as Checkin[]) ?? []}
      initialWeightLog={(weightRes.data as WeightLog[]) ?? []}
      initialExamResults={(examsRes.data as ExamResult[]) ?? []}
      initialVerdict={((verdictsRes.data as HealthVerdict[]) ?? [])[0] ?? null}
      habits={(habitsRes.data as Habit[]) ?? []}
      habitLogs={(habitLogsRes.data as HabitLog[]) ?? []}
      tasks={(tasksRes.data as Task[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      weeklyInsight={insightRes.data ?? null}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
    />
  );
}
