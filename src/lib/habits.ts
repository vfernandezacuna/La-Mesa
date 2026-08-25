import { ymd } from "./date";

export function habitStreak(dates: string[], today: string): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  let streak = 0;
  const d = new Date(today + "T00:00:00");
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  while (true) {
    const ds = ymd(d);
    if (set.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

export const DEPORTES = ["Gimnasio", "Trote", "Tenis", "Ciclismo", "Natación", "Otro"];
