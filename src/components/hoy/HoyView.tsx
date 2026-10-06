"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { askClaude } from "@/lib/claude-client";
import { captureSystemPrompt, coachStripSystemPrompt } from "@/lib/prompts";
import { buildTaskContext, buildAdvisorContext, appendProfile } from "@/lib/context";
import { daysUntil, mondayOf, thisWeekKey, weekRangeLabel, ymd } from "@/lib/date";
import { dayOfYear, reflectionsMixed, quoteTagLabels } from "@/lib/quotes";
import type {
  Checkin,
  ExamResult,
  Habit,
  HabitLog,
  Task,
  TaskCategory,
  TaskPriority,
  WeeklyReview,
  WeightLog,
} from "@/lib/types";
import FocusGrid from "./FocusGrid";
import TaskRow from "./TaskRow";
import EmptyState from "./EmptyState";
import WeekStrip from "./WeekStrip";
import HabitsBox from "./HabitsBox";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

// La frase del coach se genera una vez al día por dispositivo (cada llamada a
// Claude se cobra); "Otra frase" la regenera a pedido.
const COACH_KEY = "lamesa-coach-dia";

function leerCoachGuardado(hoy: string): string | null {
  try {
    const raw = window.localStorage.getItem(COACH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { fecha?: string; texto?: string };
    return v.fecha === hoy && v.texto ? v.texto : null;
  } catch {
    return null;
  }
}

function guardarCoach(hoy: string, texto: string) {
  try {
    window.localStorage.setItem(COACH_KEY, JSON.stringify({ fecha: hoy, texto }));
  } catch {
    // sin almacenamiento local: se regenerará en la próxima visita
  }
}

interface LastInsight {
  review_date: string | null;
  coach_conclusion: string | null;
  coach_semana: string | null;
  coach_accion: string | null;
}

export default function HoyView({
  initialTasks,
  habits,
  initialHabitLogs,
  profile,
  recentWeekKeys,
  weeklyReviews,
  prefillDate,
  lastInsight,
  checkins,
  weightLog,
  examResults,
}: {
  initialTasks: Task[];
  habits: Habit[];
  initialHabitLogs: HabitLog[];
  profile: string;
  recentWeekKeys: string[];
  weeklyReviews: WeeklyReview[];
  prefillDate?: string;
  lastInsight: LastInsight | null;
  checkins: Checkin[];
  weightLog: WeightLog[];
  examResults: ExamResult[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(initialHabitLogs);

  const [captureValue, setCaptureValue] = useState("");
  const [captureStatus, setCaptureStatus] = useState(
    "Yo interpreto cuándo, de qué tipo y qué tan urgente es.",
  );
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const [quoteOffset, setQuoteOffset] = useState(0);
  const [coachText, setCoachText] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      setMounted(true);
    };
    tick();
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const cargar = async () => {
      const guardado = leerCoachGuardado(ymd(new Date()));
      if (guardado) setCoachText(guardado);
      else await loadCoach();
    };
    void cargar();
    // Solo al montar: es un saludo de una vez, no debe re-disparar en cada cambio de tarea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    const applyPrefill = () => {
      if (!mounted || !prefillDate) return;
      const label = new Date(prefillDate + "T00:00:00").toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
      });
      setCaptureValue(`... el ${label}`);
      setCaptureStatus(`Escribe la tarea reemplazando los puntos — le pondré fecha ${label}.`);
      const input = captureInputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(0, 3);
      }
    };
    applyPrefill();
    // Solo al llegar desde Calendario con una fecha prellenada.
  }, [mounted, prefillDate]);

  async function loadCoach() {
    const active = tasks.filter((t) => !t.done);
    const hour = new Date().getHours();
    let ctxSemanal = "";
    if (lastInsight?.coach_conclusion && lastInsight.review_date) {
      const dias = Math.round(
        (new Date(ymd(new Date()) + "T00:00:00").getTime() -
          new Date(lastInsight.review_date + "T00:00:00").getTime()) /
          86400000,
      );
      if (dias <= 7) {
        ctxSemanal = `\n\nEn el cierre de su semana le dijiste esto — mantente COHERENTE con esa línea, es la misma conversación:\n"${lastInsight.coach_conclusion.slice(0, 700)}"`;
      }
    }
    const user =
      `Son las ${hour}h. ${
        active.length
          ? `Tiene ${active.length} tarea${active.length === 1 ? "" : "s"} pendiente${active.length === 1 ? "" : "s"}.`
          : "Hoy no tiene tareas capturadas todavía."
      } ¿Cómo debería encarar el día?` +
      appendProfile(
        buildTaskContext(tasks) +
          buildAdvisorContext("coach", { checkins, habits, habitLogs, weightLog, examResults, weeklyReviews }),
        profile,
      ) +
      ctxSemanal;
    setCoachLoading(true);
    try {
      const txt = (await askClaude(coachStripSystemPrompt(), user, 300, "low")).trim();
      if (txt) {
        setCoachText(txt);
        guardarCoach(ymd(new Date()), txt);
      }
    } catch {
      setCoachText(
        "Tu mentor no está disponible ahora mismo. Igual: empieza por lo que de verdad importa, no por lo que grita más fuerte.",
      );
    }
    setCoachLoading(false);
  }

  async function toggleDone(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const done = !t.done;
    const completed_at = done ? ymd(new Date()) : null;
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, done, completed_at } : x)));
    await supabase.from("tasks").update({ done, completed_at }).eq("id", id);
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  async function capture() {
    const raw = captureValue.trim();
    if (!raw) return;
    setCapturing(true);
    setCaptureStatus("Interpretando...");
    const today = ymd(new Date());
    const weekday = new Date().toLocaleDateString("es-CL", { weekday: "long" });
    try {
      const rp = await askClaude(captureSystemPrompt(today, weekday), raw, 1200, "low");
      const parsed = JSON.parse(rp.replace(/```json|```/g, "").trim()) as Array<{
        title?: string;
        date?: string | null;
        time?: string | null;
        category?: TaskCategory;
        isMeeting?: boolean;
        isDeadline?: boolean;
        priority?: TaskPriority;
      }>;
      const rows = parsed.map((t) => ({
        title: t.title || raw,
        due_date: t.date || null,
        due_time: t.time || null,
        category: t.category || "personal",
        is_meeting: !!t.isMeeting,
        is_deadline: !!t.isDeadline,
        priority: t.priority || "media",
        created_on: today,
      }));
      const { data, error } = await supabase.from("tasks").insert(rows).select();
      if (error) throw error;
      setTasks((prev) => [...prev, ...((data as Task[]) ?? [])]);
      setCaptureValue("");
      setCaptureStatus(
        rows.length === 1 ? "Tarea agregada y ordenada." : `${rows.length} tareas agregadas y ordenadas.`,
      );
    } catch {
      const { data } = await supabase
        .from("tasks")
        .insert({ title: raw, category: "personal", priority: "media", created_on: today })
        .select();
      setTasks((prev) => [...prev, ...((data as Task[]) ?? [])]);
      setCaptureValue("");
      setCaptureStatus("Agregada (sin interpretar detalles).");
    } finally {
      setCapturing(false);
    }
  }

  function toggleDictado() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setCaptureStatus(
        "Tu navegador no soporta dictado. En iPhone/Mac usa el micrófono del teclado sobre el campo.",
      );
      return;
    }
    if (recording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recog = new SR();
    recognitionRef.current = recog;
    recog.lang = "es-CL";
    recog.continuous = true;
    recog.interimResults = true;
    const base = captureValue ? captureValue + " " : "";
    recog.onstart = () => {
      setRecording(true);
      setCaptureStatus("Escuchando… habla normal y toca el micrófono para terminar.");
    };
    recog.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setCaptureValue(base + txt);
    };
    recog.onerror = (ev) => {
      setRecording(false);
      setCaptureStatus(
        ev.error === "not-allowed"
          ? "El micrófono está bloqueado aquí. Usa el dictado del teclado."
          : `No se pudo escuchar (${ev.error}). Puedes escribir directamente.`,
      );
    };
    recog.onend = () => setRecording(false);
    recog.start();
  }

  async function toggleDailyHabit(habitId: string) {
    const today = ymd(new Date());
    const existing = habitLogs.find((l) => l.habit_id === habitId && l.occurred_on === today);
    if (existing) {
      setHabitLogs((prev) => prev.filter((l) => l.id !== existing.id));
      await supabase.from("habit_logs").delete().eq("id", existing.id);
    } else {
      const { data } = await supabase
        .from("habit_logs")
        .insert({ habit_id: habitId, occurred_on: today })
        .select()
        .single();
      if (data) setHabitLogs((prev) => [...prev, data as HabitLog]);
    }
  }

  async function addWeeklyHabit(habitId: string, tipo: string) {
    const { data } = await supabase
      .from("habit_logs")
      .insert({ habit_id: habitId, occurred_on: ymd(new Date()), meta: { tipo } })
      .select()
      .single();
    if (data) setHabitLogs((prev) => [...prev, data as HabitLog]);
  }

  async function undoWeeklyHabit(habitId: string) {
    const weekStart = thisWeekKey();
    const last = [...habitLogs]
      .filter((l) => l.habit_id === habitId && l.occurred_on >= weekStart)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!last) return;
    setHabitLogs((prev) => prev.filter((l) => l.id !== last.id));
    await supabase.from("habit_logs").delete().eq("id", last.id);
  }

  // ---- derivados (todo depende de "now", solo válido tras montar) ----
  const today = ymd(now);
  const weekKey = ymd(mondayOf(now));
  const active = tasks.filter((t) => !t.done);
  const weekTasks = tasks.filter((t) => t.from_weekly && t.week_key === weekKey);
  const noWeekly = (t: Task) => !t.from_weekly;

  const agenda = active
    .filter((t) => noWeekly(t) && t.due_date && (daysUntil(t.due_date) ?? 1) <= 0)
    .sort((a, b) => {
      const da = daysUntil(a.due_date) ?? 0;
      const db = daysUntil(b.due_date) ?? 0;
      if (da !== db) return da - db;
      return (a.due_time || "99").localeCompare(b.due_time || "99");
    });

  const noSemanal = active.filter(noWeekly);
  const ordenar = (arr: Task[]) => [...arr].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const trabajo = ordenar(noSemanal.filter((t) => t.category === "trabajo" || t.category === "inversiones"));
  const personal = ordenar(noSemanal.filter((t) => t.category !== "trabajo" && t.category !== "inversiones"));

  const isSunday = now.getDay() === 0;
  const alreadyDoneThisWeek = weekTasks.length > 0 || recentWeekKeys.includes(weekKey);
  const showWeeklyBanner = isSunday && !alreadyDoneThisWeek;

  const dow = now.getDay(); // 1 = lunes
  const diasDesdeInsight = lastInsight?.review_date
    ? Math.round(
        (new Date(today + "T00:00:00").getTime() - new Date(lastInsight.review_date + "T00:00:00").getTime()) /
          86400000,
      )
    : null;
  const showMondayInsight =
    !!lastInsight?.coach_conclusion &&
    (dow === 1 || dow === 2) &&
    diasDesdeInsight !== null &&
    diasDesdeInsight <= 4;

  const quoteIdx = (dayOfYear(now) + quoteOffset) % reflectionsMixed.length;
  const quote = reflectionsMixed[quoteIdx];

  const hour = now.getHours();
  const saludo = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const fechaTxt = now.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (!mounted) {
    return <div className="loading">Cargando tu día…</div>;
  }

  return (
    <>
      <div className="hoy-masthead">
        <div className="mh-left">
          <h1 className="greeting">{saludo}</h1>
          <div className="date-line">
            {fechaTxt} ·{" "}
            <span className="live-clock">
              {pad(now.getHours())}:{pad(now.getMinutes())}
              <span className="cl-sec">:{pad(now.getSeconds())}</span>
            </span>
          </div>
          <div className="capture-mini">
            <input
              ref={captureInputRef}
              type="text"
              placeholder="Anota o dicta una tarea…"
              value={captureValue}
              onChange={(e) => setCaptureValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void capture();
              }}
            />
            <button className={`mic-btn ${recording ? "rec" : ""}`} onClick={toggleDictado} title="Dictar">
              🎙
            </button>
            <button id="capture-btn" onClick={() => void capture()} disabled={capturing}>
              +
            </button>
          </div>
          <div className="capture-hint">{captureStatus}</div>
        </div>

        <div className="daily-quote">
          <div className="dq-head">
            <span className="dq-lbl">Reflexión del día</span>
            <span className={`dq-tag ${quote.t}`}>{quoteTagLabels[quote.t]}</span>
          </div>
          <div className="dq-text">“{quote.text}”</div>
          <div className="dq-source">— {quote.src}</div>
          <button className="dq-refresh" onClick={() => setQuoteOffset((o) => o + 1)}>
            Ver otra
          </button>
        </div>
      </div>

      <div className="coach-strip">
        <div className="lbl">
          Tu coach, hoy
          <button className="coach-otra" onClick={() => void loadCoach()} disabled={coachLoading}>
            {coachLoading ? "pensando…" : "otra frase"}
          </button>
        </div>
        <div style={{ opacity: coachText && !coachLoading ? 1 : 0.45 }}>{coachText ?? "…"}</div>
      </div>

      {showWeeklyBanner && (
        <Link prefetch={false} href="/revision" className="weekly-banner">
          <span className="wb-icon">↻</span>
          <div className="wb-txt">
            <div className="wb-title">Es domingo — tu revisión semanal</div>
            <div className="wb-sub">5 minutos para cerrar la semana y fijar el foco de la próxima.</div>
          </div>
          <span className="wb-go">→</span>
        </Link>
      )}

      {showMondayInsight && lastInsight && (
        <div className="close-insight" style={{ marginTop: 0, marginBottom: 22 }}>
          <div className="ci-lbl">Tu coach, sobre la semana que cerraste</div>
          <div className="ci-body">{lastInsight.coach_semana || lastInsight.coach_conclusion}</div>
          {lastInsight.coach_accion && (
            <div className="ci-action">
              <div className="ci-action-lbl">Tu acción para esta semana</div>
              <div className="ci-body" style={{ fontWeight: 600 }}>
                {lastInsight.coach_accion}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2>Tareas del día</h2>
        </div>
        {agenda.length ? (
          agenda.map((t) => <TaskRow key={t.id} task={t} showTime onToggle={toggleDone} onDelete={deleteTask} />)
        ) : (
          <EmptyState icon="◷" text='Nada para hoy. Captura algo arriba y ponle "hoy".' />
        )}
      </div>

      <div className="focus-hero">
        <FocusGrid weekTasks={weekTasks} onToggle={toggleDone} onRemove={deleteTask} />
      </div>

      <div className="section week-under-focus">
        <div className="section-head">
          <h2>Tu semana</h2>
          <span className="count">{weekRangeLabel(now)}</span>
        </div>
        <WeekStrip tasks={tasks} now={now} />
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Personal</h2>
        </div>
        {personal.length ? (
          personal.map((t) => <TaskRow key={t.id} task={t} showTime onToggle={toggleDone} onDelete={deleteTask} />)
        ) : (
          <EmptyState icon="◆" text="Nada personal pendiente." />
        )}
      </div>
      <div className="section">
        <div className="section-head">
          <h2>Trabajo</h2>
        </div>
        {trabajo.length ? (
          trabajo.map((t) => <TaskRow key={t.id} task={t} showTime onToggle={toggleDone} onDelete={deleteTask} />)
        ) : (
          <EmptyState icon="▪" text="Sin pendientes de trabajo." />
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Hábitos innegociables</h2>
        </div>
        <HabitsBox
          habits={habits}
          habitLogs={habitLogs}
          today={today}
          onToggleDaily={toggleDailyHabit}
          onAddWeekly={addWeeklyHabit}
          onUndoWeekly={undoWeeklyHabit}
        />
      </div>
    </>
  );
}
