export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayStr(): string {
  return ymd(new Date());
}

// Lunes de la semana de `d` (lunes=0 ... domingo=6)
export function mondayOf(d: Date): Date {
  const mon = new Date(d);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return mon;
}

export function thisWeekKey(): string {
  return ymd(mondayOf(new Date()));
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round(
    (new Date(dateStr + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) /
      86400000,
  );
}

export function weekRangeLabel(now: Date): string {
  const mon = mondayOf(now);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  return `${fmt(mon)} — ${fmt(sun)}`;
}

export function dueText(dateStr: string | null): string {
  const n = daysUntil(dateStr);
  if (n === null || !dateStr) return "";
  if (n < 0) return `hace ${-n}d`;
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  const dt = new Date(dateStr + "T00:00:00");
  if (n <= 6) return dt.toLocaleDateString("es-CL", { weekday: "long" });
  return dt.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
