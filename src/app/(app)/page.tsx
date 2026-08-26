import { createClient } from "@/lib/supabase/server";
import HoyView from "@/components/hoy/HoyView";
import type { Habit, HabitLog, Task } from "@/lib/types";

export default async function HoyPage() {
  const supabase = await createClient();

  const [tasksRes, habitsRes, habitLogsRes, profileRes, reviewsRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("done", false),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase.from("profile").select("content").maybeSingle(),
    supabase.from("weekly_reviews").select("week_key").order("week_key", { ascending: false }).limit(3),
  ]);

  // Diagnóstico temporal — se retira una vez resuelto el problema de hábitos vacíos.
  const errors = [
    ["tasks", tasksRes.error],
    ["habits", habitsRes.error],
    ["habit_logs", habitLogsRes.error],
    ["profile", profileRes.error],
    ["weekly_reviews", reviewsRes.error],
  ].filter(([, e]) => e);
  if (errors.length) {
    return (
      <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.85rem" }}>
        <h2>Errores de Supabase (diagnóstico temporal)</h2>
        {errors.map(([name, e]) => (
          <div key={name as string} style={{ marginBottom: 12 }}>
            <strong>{name as string}:</strong> {JSON.stringify(e, null, 2)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Diagnóstico temporal — se retira una vez resuelto el problema de hábitos vacíos. */}
      <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#9a9793", marginBottom: 8 }}>
        debug: tasks={tasksRes.data?.length ?? "null"} habits={habitsRes.data?.length ?? "null"}{" "}
        habit_logs={habitLogsRes.data?.length ?? "null"} profile=
        {profileRes.data ? "sí" : "no"}
      </div>
      <HoyView
        initialTasks={(tasksRes.data as Task[]) ?? []}
        habits={(habitsRes.data as Habit[]) ?? []}
        initialHabitLogs={(habitLogsRes.data as HabitLog[]) ?? []}
        profile={profileRes.data?.content ?? ""}
        recentWeekKeys={(reviewsRes.data ?? []).map((r) => r.week_key)}
      />
    </>
  );
}
