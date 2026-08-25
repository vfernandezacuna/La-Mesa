import { daysUntil, todayStr } from "./date";
import { catLabel } from "./tasks";
import type { Task, TaskCategory } from "./types";

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
