import { daysUntil, todayStr, thisWeekKey } from "./date";
import { catLabel } from "./tasks";
import type { Habit, HabitLog, Task, TaskCategory, WeightLog, ExamResult } from "./types";

export function buildTaskContext(tasks: Task[]): string {
  const active = tasks.filter((t) => !t.done);
  const late = active.filter((t) => t.due_date && (daysUntil(t.due_date) ?? 0) < 0);
  const L: string[] = [];

  L.push(
    `Tareas activas: ${active.length}${late.length ? `, de las cuales ${late.length} están atrasadas` : ""}.`,
  );
  L.push("No tiene foco definido para hoy.");

  const byCat: Partial<Record<TaskCategory, number>> = {};
  active.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + 1;
  });
  const cats = Object.entries(byCat).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (cats.length) {
    L.push(
      `Carga por área: ${cats.map(([c, n]) => `${catLabel[c as TaskCategory] || c} ${n}`).join(", ")}.`,
    );
  }

  const today = todayStr();
  const ageOf = (t: Task) =>
    Math.round(
      (new Date(today + "T00:00:00").getTime() - new Date(t.created_on + "T00:00:00").getTime()) /
        86400000,
    );
  const stale = active.filter((t) => t.created_on && ageOf(t) >= 7).map((t) => `"${t.title}" (${ageOf(t)} días sin cerrar)`);
  if (stale.length) {
    L.push(
      `LLEVA POSTERGANDO: ${stale.slice(0, 5).join("; ")}. Esto es señal — vale la pena que alguien se lo diga.`,
    );
  }

  return "\n\n" + L.join("\n");
}

export function appendProfile(context: string, profile: string): string {
  if (!profile) return context;
  return `${context}\n\n--- QUIÉN ES ÉL (perfil permanente) ---\n${profile}\n--- FIN DEL PERFIL ---`;
}

// Contexto de hábitos, deporte, peso y exámenes — usado por los prompts de Coach
// (check-in semanal y sentencia de salud).
export function buildHealthContext(
  habits: Habit[],
  habitLogs: HabitLog[],
  weightLog: WeightLog[],
  examResults: ExamResult[],
): string {
  const L: string[] = [];
  const today = todayStr();
  const weekStart = thisWeekKey();

  const daily = habits.filter((h) => h.cadence === "daily");
  const weekly = habits.filter((h) => h.cadence === "week");

  if (daily.length) {
    const lines = daily.map((h) => {
      const dates = habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.occurred_on);
      const done = dates.includes(today);
      return `${h.name}: ${done ? "cumplido hoy" : "no cumplido hoy"} (${dates.length} veces en total)`;
    });
    L.push(`Hábitos diarios:\n${lines.join("\n")}`);
  }
  if (weekly.length) {
    const lines = weekly.map((h) => {
      const count = habitLogs.filter((l) => l.habit_id === h.id && l.occurred_on >= weekStart).length;
      return `${h.name}: ${count} de ${h.weekly_target ?? 0} esta semana`;
    });
    L.push(`Hábitos semanales:\n${lines.join("\n")}`);
  }

  if (weightLog.length) {
    const sorted = [...weightLog].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
    L.push(
      `SERIE DE PESO (${sorted.length} mediciones):\n${sorted.map((p) => `${p.recorded_on}: ${p.kg}`).join(" · ")}`,
    );
  } else {
    L.push("Sin registro de peso.");
  }

  if (examResults.length) {
    const porFecha: Record<string, ExamResult[]> = {};
    examResults.forEach((e) => {
      const f = e.taken_on ?? "sin-fecha";
      (porFecha[f] ??= []).push(e);
    });
    const ex = Object.keys(porFecha)
      .sort()
      .map((f) => `[Control ${f}] ${porFecha[f].map((e) => `${e.test_name}: ${e.value}`).join(" ; ")}`)
      .join("\n");
    L.push(`EXÁMENES:\n${ex}`);
  } else {
    L.push("Sin exámenes.");
  }

  return "\n\n" + L.join("\n\n");
}
