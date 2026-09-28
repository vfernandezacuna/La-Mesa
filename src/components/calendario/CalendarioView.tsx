"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { daysUntil, ymd } from "@/lib/date";
import { catLabel } from "@/lib/tasks";
import type { Task } from "@/lib/types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export default function CalendarioView({
  tasks,
  initialDate,
}: {
  tasks: Task[];
  initialDate?: string;
}) {
  const router = useRouter();
  const detailRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);
  const [calSelected, setCalSelected] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    const init = () => {
      const base = initialDate ? new Date(initialDate + "T00:00:00") : new Date();
      setCalYear(base.getFullYear());
      setCalMonth(base.getMonth());
      if (initialDate) setCalSelected(initialDate);
      setToday(ymd(new Date()));
      setMounted(true);
    };
    init();
  }, [initialDate]);

  useEffect(() => {
    if (initialDate) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Solo al llegar con una fecha preseleccionada desde otra pestaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) {
    return <div className="loading">Cargando calendario…</div>;
  }

  function tasksOnDate(ds: string) {
    return tasks
      .filter((t) => !t.done && t.due_date === ds)
      .sort((a, b) => {
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        if (a.due_time) return -1;
        if (b.due_time) return 1;
        return 0;
      });
  }

  function shift(delta: number) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setCalMonth(m);
    setCalYear(y);
    setCalSelected(null);
  }

  function goToday() {
    const d = new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalSelected(today);
  }

  function addOnDate(ds: string) {
    router.push(`/?prefillDate=${ds}`);
  }

  const first = new Date(calYear, calMonth, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }),
  ];

  const selectedTasks = calSelected ? tasksOnDate(calSelected) : [];
  const selectedLabel = calSelected
    ? (() => {
        const label = new Date(calSelected + "T00:00:00").toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
      })()
    : "";

  return (
    <>
      <div className="cal-head">
        <div>
          <div className="fh-label">Panorámica del mes</div>
          <h1 className="page-title">
            {MESES[calMonth].charAt(0).toUpperCase() + MESES[calMonth].slice(1)} {calYear}
          </h1>
        </div>
        <div className="cal-nav">
          <button className="cal-arrow" onClick={() => shift(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <button className="ghost cal-today" onClick={goToday}>
            Hoy
          </button>
          <button className="cal-arrow" onClick={() => shift(1)} aria-label="Mes siguiente">
            ›
          </button>
        </div>
      </div>
      <div className="page-sub" style={{ margin: "-2px 0 18px 0" }}>
        Solo tus tareas de La Mesa — no tus reuniones de Outlook. Toca un día para ver o agregar.
      </div>
      <div className="cal-weekdays">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((ds, i) => {
          if (!ds) return <div key={`blank-${i}`} className="cal-cell blank" />;
          const dayTasks = tasksOnDate(ds);
          const isToday = ds === today;
          const isSel = ds === calSelected;
          const isPast = (daysUntil(ds) ?? 0) < 0;
          const maxShow = 2;
          return (
            <div
              key={ds}
              className={`cal-cell ${isToday ? "today" : ""} ${isSel ? "sel" : ""}`}
              onClick={() => setCalSelected((prev) => (prev === ds ? null : ds))}
            >
              <span className="cal-daynum">{Number(ds.slice(-2))}</span>
              <div className="cal-items">
                {dayTasks.slice(0, maxShow).map((t) => (
                  <div key={t.id} className={`cal-item ${t.from_weekly ? "week" : isPast ? "late" : ""}`}>
                    {t.due_time && <span className="ci-h">{t.due_time.slice(0, 5)}</span>}
                    <span className="ci-t">{t.title}</span>
                  </div>
                ))}
                {dayTasks.length > maxShow && (
                  <div className="cal-item-more">+{dayTasks.length - maxShow} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={detailRef}>
        {calSelected && (
          <div className="cal-detail">
            <div className="cal-detail-head">
              <span className="cd-date">{selectedLabel}</span>
              <span className="cal-detail-add" onClick={() => addOnDate(calSelected)}>
                + agregar aquí
              </span>
            </div>
            {selectedTasks.length ? (
              selectedTasks.map((t) => (
                <div className="mini-row" key={t.id}>
                  <span className="cd-time">{t.due_time ? t.due_time.slice(0, 5) : "—"}</span>
                  <span className="m-name">{t.title}</span>
                  {t.from_weekly ? (
                    <span className="m-val" style={{ color: "var(--azul-deep)" }}>
                      semana
                    </span>
                  ) : (
                    <span className={`chip chip-${t.category}`}>{catLabel[t.category]}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-note" style={{ padding: "4px 0" }}>
                Nada este día. Toca &quot;agregar aquí&quot; para poner algo.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
