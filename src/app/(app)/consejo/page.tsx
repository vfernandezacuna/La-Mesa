import { createClient } from "@/lib/supabase/server";
import ConsejoView from "@/components/consejo/ConsejoView";
import { fetchCarteraEntries } from "@/lib/fetch-carteras";
import type { PatrimonioQuarterTotals } from "@/lib/context";
import type {
  Checkin,
  CouncilSession,
  ExamResult,
  Habit,
  HabitLog,
  LearningLogEntry,
  PatrimonioClassCode,
  PatrimonioClassTotal,
  PatrimonioQuarter,
  Task,
  WeeklyReview,
  WeightLog,
} from "@/lib/types";

export default async function ConsejoPage() {
  const supabase = await createClient();

  const [
    tasksRes,
    profileRes,
    checkinsRes,
    habitsRes,
    habitLogsRes,
    weightRes,
    examsRes,
    reviewsRes,
    sessionsRes,
    learningRes,
    quartersRes,
    carteras,
  ] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("profile").select("content").maybeSingle(),
    supabase.from("checkins").select("*").order("created_at", { ascending: true }),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase.from("weight_log").select("*").order("recorded_on", { ascending: true }),
    supabase.from("exam_results").select("*").order("taken_on", { ascending: false }),
    supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
    supabase.from("council_sessions").select("*").order("created_at", { ascending: true }),
    supabase.from("learning_log").select("*").order("created_at", { ascending: true }),
    supabase
      .from("patrimonio_quarters")
      .select("*, patrimonio_class_totals(*)")
      .order("year", { ascending: true })
      .order("quarter", { ascending: true }),
    fetchCarteraEntries(supabase),
  ]);

  const quarters = (
    (quartersRes.data as (PatrimonioQuarter & { patrimonio_class_totals: PatrimonioClassTotal[] })[]) ?? []
  ).map(
    (q): PatrimonioQuarterTotals => ({
      year: q.year,
      quarter: q.quarter,
      totals: Object.fromEntries(
        q.patrimonio_class_totals.map((t) => [t.class_code, t.amount]),
      ) as Partial<Record<PatrimonioClassCode, number>>,
    }),
  );

  return (
    <ConsejoView
      tasks={(tasksRes.data as Task[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      checkins={(checkinsRes.data as Checkin[]) ?? []}
      habits={(habitsRes.data as Habit[]) ?? []}
      habitLogs={(habitLogsRes.data as HabitLog[]) ?? []}
      weightLog={(weightRes.data as WeightLog[]) ?? []}
      examResults={(examsRes.data as ExamResult[]) ?? []}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      initialSessions={(sessionsRes.data as CouncilSession[]) ?? []}
      learningTopics={((learningRes.data as LearningLogEntry[]) ?? []).map((l) => l.topic)}
      carteras={carteras}
      patrimonioQuarters={quarters}
    />
  );
}
