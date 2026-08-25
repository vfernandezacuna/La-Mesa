"use client";

import Link from "next/link";
import { daysUntil, mondayOf, ymd } from "@/lib/date";
import type { Task } from "@/lib/types";

const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export default function WeekStrip({ tasks, now }: { tasks: Task[]; now: Date }) {
  const mon = mondayOf(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <>
      <div className="week-strip">
        {days.map((d, i) => {
          const ds = ymd(d);
          const isToday = ds === ymd(now);
          const isPast = (daysUntil(ds) ?? 0) < 0;
          const dayTasks = tasks.filter((t) => !t.done && t.due_date === ds);
          return (
            <Link
              key={ds}
              href="/calendario"
              className={`wk-day ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}
              title={`${dayTasks.length} pendiente${dayTasks.length === 1 ? "" : "s"}`}
            >
              <span className="wk-dow">{DOW[i]}</span>
              <span className="wk-num">{d.getDate()}</span>
              <div className="wk-dots">
                {dayTasks.length === 0 && <span className="wk-empty">·</span>}
                {dayTasks.slice(0, 4).map((t) => (
                  <span
                    key={t.id}
                    className={`wk-dot ${t.from_weekly ? "week" : isPast ? "late" : ""}`}
                  />
                ))}
                {dayTasks.length > 4 && <span className="wk-more">+{dayTasks.length - 4}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
