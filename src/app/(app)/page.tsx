import { createClient } from "@/lib/supabase/server";
import HoyView from "@/components/hoy/HoyView";
import type { Habit, HabitLog, Task } from "@/lib/types";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ prefillDate?: string }>;
}) {
  const { prefillDate } = await searchParams;
  const supabase = await createClient();

  const [tasksRes, habitsRes, habitLogsRes, profileRes, reviewsRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("done", false),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase.from("profile").select("content").maybeSingle(),
    supabase.from("weekly_reviews").select("week_key").order("week_key", { ascending: false }).limit(3),
  ]);

  return (
    <HoyView
      initialTasks={(tasksRes.data as Task[]) ?? []}
      habits={(habitsRes.data as Habit[]) ?? []}
      initialHabitLogs={(habitLogsRes.data as HabitLog[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      recentWeekKeys={(reviewsRes.data ?? []).map((r) => r.week_key)}
      prefillDate={prefillDate}
    />
  );
}
