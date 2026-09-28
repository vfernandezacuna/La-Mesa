import { createClient } from "@/lib/supabase/server";
import RevisionView from "@/components/revision/RevisionView";
import type { Checkin, ExamResult, Habit, HabitLog, Task, WeeklyReview, WeightLog } from "@/lib/types";

export default async function RevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ prio?: string }>;
}) {
  const { prio } = await searchParams;
  const supabase = await createClient();

  const [tasksRes, reviewsRes, profileRes, checkinsRes, habitsRes, habitLogsRes, weightRes, examsRes] =
    await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
      supabase.from("profile").select("content").maybeSingle(),
      supabase.from("checkins").select("*").order("created_at", { ascending: true }),
      supabase.from("habits").select("*"),
      supabase.from("habit_logs").select("*"),
      supabase.from("weight_log").select("*").order("recorded_on", { ascending: true }),
      supabase.from("exam_results").select("*").order("taken_on", { ascending: false }),
    ]);

  return (
    <RevisionView
      initialTasks={(tasksRes.data as Task[]) ?? []}
      initialReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      prioPrefill={prio}
      checkins={(checkinsRes.data as Checkin[]) ?? []}
      habits={(habitsRes.data as Habit[]) ?? []}
      habitLogs={(habitLogsRes.data as HabitLog[]) ?? []}
      weightLog={(weightRes.data as WeightLog[]) ?? []}
      examResults={(examsRes.data as ExamResult[]) ?? []}
    />
  );
}
