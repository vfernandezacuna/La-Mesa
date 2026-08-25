"use client";

import Link from "next/link";
import type { Task } from "@/lib/types";

export default function FocusGrid({
  weekTasks,
  onToggle,
  onRemove,
}: {
  weekTasks: Task[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const doneN = weekTasks.filter((t) => t.done).length;
  const slots = Array.from({ length: 3 }, (_, i) => weekTasks[i]);

  return (
    <>
      <div className="focus-hero-head">
        <div>
          <div className="fh-label">Tu compromiso de esta semana</div>
          <h2 className="fh-title">El foco de la semana</h2>
        </div>
        <span className="fh-count">
          {doneN}/{weekTasks.length || 3} hechas
        </span>
      </div>
      <div className="focus-grid">
        {slots.map((t, i) =>
          t ? (
            <div key={t.id} className={`focus-card ${t.done ? "done" : ""}`}>
              <input
                type="checkbox"
                className="fcheck"
                checked={t.done}
                onChange={() => onToggle(t.id)}
              />
              <div className="num">0{i + 1}</div>
              <div className="txt">{t.title}</div>
              <button
                type="button"
                className="focus-del"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t.id);
                }}
                title="Quitar esta prioridad"
              >
                ✕ quitar
              </button>
            </div>
          ) : (
            <Link key={`empty-${i}`} href="/revision" className="focus-empty">
              <span className="fe-plus">+</span>
              <span>Fíjala en tu revisión semanal</span>
            </Link>
          ),
        )}
      </div>
    </>
  );
}
