"use client";

import { habitStreak, DEPORTES } from "@/lib/habits";
import { thisWeekKey } from "@/lib/date";
import type { Habit, HabitLog } from "@/lib/types";

export default function HabitsBox({
  habits,
  habitLogs,
  today,
  onToggleDaily,
  onAddWeekly,
  onUndoWeekly,
}: {
  habits: Habit[];
  habitLogs: HabitLog[];
  today: string;
  onToggleDaily: (habitId: string) => void;
  onAddWeekly: (habitId: string, tipo: string) => void;
  onUndoWeekly: (habitId: string) => void;
}) {
  const daily = habits.filter((h) => h.cadence === "daily");
  const weekly = habits.filter((h) => h.cadence === "week");
  const weekStart = thisWeekKey();

  return (
    <div>
      <div className="habit-sub">Cada día</div>
      {daily.map((h) => {
        const dates = habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.occurred_on);
        const done = dates.includes(today);
        const streak = habitStreak(dates, today);
        return (
          <div
            key={h.id}
            className={`habit-row ${done ? "done" : ""}`}
            onClick={() => onToggleDaily(h.id)}
          >
            <span className="habit-check">✓</span>
            <span className="habit-name">{h.name}</span>
            <span className={`habit-streak ${streak ? "" : "zero"}`}>
              {streak ? `🔥 ${streak} ${streak === 1 ? "día" : "días"}` : "—"}
            </span>
          </div>
        );
      })}

      <div className="habit-sub" style={{ marginTop: 16 }}>
        Esta semana
      </div>
      {weekly.map((h) => {
        const thisWeek = habitLogs
          .filter((l) => l.habit_id === h.id && l.occurred_on >= weekStart)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const count = thisWeek.length;
        const meta = h.weekly_target ?? 0;
        const met = count >= meta;
        return (
          <div key={h.id} className="habit-week">
            <div className="habit-week-top">
              <span className="habit-week-name">{h.name}</span>
              <span className={`habit-week-count ${met ? "met" : ""}`}>
                {count} de {meta}
                {met ? " ✓" : ""}
              </span>
            </div>
            <div className="habit-pips">
              {Array.from({ length: meta }, (_, i) => (
                <span key={i} className={`habit-pip ${i < count ? "on" : ""}`} />
              ))}
            </div>
            {thisWeek.length > 0 && (
              <div className="dep-list">
                {thisWeek.map((l) => (
                  <span key={l.id} className="dep-tag">
                    {l.meta?.tipo ?? "Sesión"}
                    <span className="dep-day">
                      {new Date(l.occurred_on + "T00:00:00").toLocaleDateString("es-CL", {
                        weekday: "short",
                      })}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {met && <div className="habit-week-done-note">Meta de la semana cumplida. Lo extra es ganancia.</div>}
            <div className="dep-picker">
              <span className="dep-picker-lbl">{met ? "¿Sumas otra?" : "¿Qué hiciste hoy?"}</span>
              <div className="dep-btns">
                {DEPORTES.map((d) => (
                  <button key={d} className="dep-btn" onClick={() => onAddWeekly(h.id, d)}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {count > 0 && (
              <div style={{ marginTop: 9 }}>
                <button
                  className="ghost"
                  style={{ fontSize: "0.76rem", padding: "5px 11px" }}
                  onClick={() => onUndoWeekly(h.id)}
                >
                  deshacer última
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
