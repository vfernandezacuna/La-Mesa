"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude } from "@/lib/claude-client";
import { analizarCierreSystemPrompt } from "@/lib/prompts";
import { appendProfile, buildAdvisorContext, buildTaskContext } from "@/lib/context";
import { daysUntil, dueText, inThisWeek, mondayOf, ymd } from "@/lib/date";
import type { Checkin, ExamResult, Habit, HabitLog, Task, WeeklyReview, WeightLog } from "@/lib/types";

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

export default function RevisionView({
  initialTasks,
  initialReviews,
  profile,
  prioPrefill,
  checkins,
  habits,
  habitLogs,
  weightLog,
  examResults,
}: {
  initialTasks: Task[];
  initialReviews: WeeklyReview[];
  profile: string;
  prioPrefill?: string;
  checkins: Checkin[];
  habits: Habit[];
  habitLogs: HabitLog[];
  weightLog: WeightLog[];
  examResults: ExamResult[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [reviews, setReviews] = useState<WeeklyReview[]>(initialReviews);

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [noteValue, setNoteValue] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [savedNoteMsg, setSavedNoteMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = () => {
      setNow(new Date());
      setMounted(true);
    };
    init();
  }, []);

  const weekKey = ymd(mondayOf(now));

  // Pre-carga: prioridades ya fijadas esta semana, y las que quedaron abiertas.
  useEffect(() => {
    const prefill = () => {
      if (!mounted) return;
      const wpOpen = tasks.filter((t) => t.from_weekly && t.week_key === weekKey && !t.done);
      if (!p1 && wpOpen[0]) setP1(wpOpen[0].title);
      if (!p2 && wpOpen[1]) setP2(wpOpen[1].title);
      if (!p3 && wpOpen[2]) setP3(wpOpen[2].title);
    };
    prefill();
    // Solo al montar para esta semana — no debe pisar lo que el usuario esté escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, weekKey]);

  // Prioridad propuesta desde Coach ("Convertir en prioridad de la semana").
  useEffect(() => {
    if (!mounted || !prioPrefill) return;
    subirAPrioridad(prioPrefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, prioPrefill]);

  if (!mounted) {
    return <div className="loading">Cargando tu revisión…</div>;
  }

  const mon = mondayOf(now);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmtRange = (d: Date) => d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });

  const doneWeek = tasks.filter((t) => t.done && inThisWeek(t.completed_at, now));
  const pend = tasks.filter((t) => !t.done);
  const late = pend.filter((t) => t.due_date && (daysUntil(t.due_date) ?? 0) < 0);

  const wpAll = tasks.filter((t) => t.from_weekly && t.week_key === weekKey);
  const wpOpen = wpAll.filter((t) => !t.done);

  function subirAPrioridad(title: string) {
    if (!p1) {
      setP1(title);
      return;
    }
    if (!p2) {
      setP2(title);
      return;
    }
    if (!p3) {
      setP3(title);
      return;
    }
    alert("Ya tienes las tres prioridades escritas. Borra una si quieres poner esta.");
  }

  async function saveWeeklyPriorities() {
    const vals = [p1, p2, p3].map((v) => v.trim()).filter(Boolean);
    if (!vals.length) return;

    const toRemove = tasks.filter((t) => t.from_weekly && t.week_key === weekKey && !t.done);
    if (toRemove.length) {
      await supabase.from("tasks").delete().in("id", toRemove.map((t) => t.id));
    }
    const rows = vals.map((v) => ({
      title: v,
      category: "personal" as const,
      priority: "alta" as const,
      created_on: ymd(now),
      from_weekly: true,
      week_key: weekKey,
    }));
    const { data } = await supabase.from("tasks").insert(rows).select();
    const removeIds = new Set(toRemove.map((t) => t.id));
    setTasks((prev) => [...prev.filter((t) => !removeIds.has(t.id)), ...((data as Task[]) ?? [])]);
    setSavedMsg(
      `Listo. Tus ${vals.length} prioridad${vals.length > 1 ? "es" : ""} quedaron fijadas para la semana y se ven arriba en "Hoy". Cada día eliges cuál trabajar.`,
    );
  }

  async function saveReviewNote() {
    const note = noteValue.trim();
    if (!note) return;

    const doneCount = doneWeek.length;
    const pendCount = pend.length;
    const lateCount = late.length;
    const rango = `Semana del ${fmtRange(mon)} al ${fmtRange(sun)}`;
    const reviewDate = ymd(now);

    const { data } = await supabase
      .from("weekly_reviews")
      .upsert(
        {
          week_key: weekKey,
          rango,
          review_date: reviewDate,
          note,
          done_count: doneCount,
          pend_count: pendCount,
          late_count: lateCount,
        },
        { onConflict: "user_id,week_key" },
      )
      .select()
      .single();

    const previousReviews = reviews;
    if (data) {
      setReviews((prev) => {
        const rest = prev.filter((r) => r.week_key !== weekKey);
        return [...rest, data as WeeklyReview].sort((a, b) => a.week_key.localeCompare(b.week_key));
      });
    }
    setNoteValue("");
    setSavedNoteMsg(
      "Cierre guardado. Tu coach ya lo está leyendo — su lectura de la semana te espera en la pestaña Coach.",
    );

    void analizarCierre(note, previousReviews);
  }

  async function analizarCierre(nota: string, previousReviews: WeeklyReview[]) {
    const previos = previousReviews.filter((r) => r.week_key !== weekKey).slice(-8);
    const histTxt = previos.length
      ? previos
          .map(
            (r) =>
              `${r.rango || r.review_date}: "${r.note}"${
                r.done_count != null ? ` [cerró ${r.done_count}, quedaron ${r.pend_count}, atrasadas ${r.late_count}]` : ""
              }`,
          )
          .join("\n")
      : "(este es su primer cierre registrado)";

    const user =
      `Su cierre de esta semana: "${nota}"\n\nSus cierres anteriores:\n${histTxt}` +
      appendProfile(
        buildTaskContext(tasks) +
          buildAdvisorContext("coach", {
            checkins,
            habits,
            habitLogs,
            weightLog,
            examResults,
            weeklyReviews: previousReviews,
          }),
        profile,
      );

    try {
      const raw = await askClaude(analizarCierreSystemPrompt(), user, 1400);
      const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
      await supabase
        .from("weekly_reviews")
        .update({
          coach_conclusion: p.conclusion || "",
          coach_semana: p.semana || "",
          coach_accion: p.accion || "",
        })
        .eq("week_key", weekKey);
    } catch (err) {
      console.error("No se pudo generar la lectura del cierre:", err);
    }
  }

  function toggleDictado() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (recording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recog = new SR();
    recognitionRef.current = recog;
    recog.lang = "es-CL";
    recog.continuous = true;
    recog.interimResults = true;
    const base = noteValue ? noteValue + " " : "";
    recog.onstart = () => setRecording(true);
    recog.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setNoteValue(base + txt);
    };
    recog.onerror = () => setRecording(false);
    recog.onend = () => setRecording(false);
    recog.start();
  }

  return (
    <>
      <h1 className="page-title">Revisión semanal</h1>
      <div className="page-sub">
        Semana del {fmtRange(mon)} al {fmtRange(sun)} · cinco minutos para cerrar y fijar el foco de
        la próxima.
      </div>

      <div className="panel">
        <h2>1 · Estado de tus prioridades semanales</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Cómo cerraron los compromisos que fijaste. Lo que quede abierto se arrastra solo a la
          próxima semana.
        </div>
        <div style={{ marginBottom: 16 }}>
          {wpAll.length ? (
            <>
              {wpAll.map((t, i) => (
                <div className="mini-row" key={t.id}>
                  <span
                    className="m-name"
                    style={t.done ? { opacity: 0.5, textDecoration: "line-through" } : undefined}
                  >
                    0{i + 1} · {t.title}
                  </span>
                  <span
                    className="m-val"
                    style={{ color: t.done ? "var(--accent-deep)" : "var(--azul-deep)" }}
                  >
                    {t.done ? "cerrada" : "sigue abierta"}
                  </span>
                </div>
              ))}
              {wpOpen.length > 0 && (
                <div style={{ fontSize: "0.78rem", color: "var(--n700)", marginTop: 10, fontStyle: "italic" }}>
                  Las {wpOpen.length} que siguen abiertas se cargaron abajo para la próxima semana.
                </div>
              )}
            </>
          ) : (
            <div className="empty-note">No fijaste prioridades esta semana. Empieza abajo.</div>
          )}
        </div>
        <div className="score-grid">
          <div className="score-card good">
            <div className="sc-val">{doneWeek.length}</div>
            <div className="sc-lbl">Cerradas</div>
          </div>
          <div className="score-card pend">
            <div className="sc-val">{pend.length}</div>
            <div className="sc-lbl">Pendientes</div>
          </div>
          <div className="score-card late">
            <div className="sc-val">{late.length}</div>
            <div className="sc-lbl">Atrasadas</div>
          </div>
        </div>
        {late.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: ".8px",
                color: "var(--coral)",
                marginBottom: 6,
              }}
            >
              Se te pasaron — súbelas a prioridad si de verdad importan
            </div>
            {late.slice(0, 6).map((t) => (
              <div className="mini-row" key={t.id}>
                <span className="m-name">{t.title}</span>
                <span className="m-val stale">{dueText(t.due_date)}</span>
                <span className="wp-add" onClick={() => subirAPrioridad(t.title)}>
                  subir
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>2 · Tu compromiso para la próxima semana</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Tres cosas que quieres mover esta semana — no del mismo día. Quedan visibles arriba en
          &quot;Hoy&quot;, y cada mañana eliges cuál trabajas.
        </div>
        <div className="prio-input-row">
          <span className="p-num">01</span>
          <input type="text" placeholder="Prioridad 1..." value={p1} onChange={(e) => setP1(e.target.value)} />
        </div>
        <div className="prio-input-row">
          <span className="p-num">02</span>
          <input type="text" placeholder="Prioridad 2..." value={p2} onChange={(e) => setP2(e.target.value)} />
        </div>
        <div className="prio-input-row">
          <span className="p-num">03</span>
          <input type="text" placeholder="Prioridad 3..." value={p3} onChange={(e) => setP3(e.target.value)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <button onClick={() => void saveWeeklyPriorities()}>Fijar prioridades de la semana</button>
        </div>
        {wpAll.length > 0 && !savedMsg && (
          <div className="review-done">
            Ya fijaste prioridades esta semana. Puedes reescribirlas y guardar de nuevo si cambiaste
            de idea.
          </div>
        )}
        {savedMsg && <div className="review-done">{savedMsg}</div>}
      </div>

      <div className="panel">
        <h2>3 · Cierre de la semana</h2>
        <div className="page-sub" style={{ margin: "-6px 0 12px 0" }}>
          Escribe cómo te fue en una línea. Tu coach lo tomará y te devolverá su lectura en la
          pestaña Coach.
        </div>
        <div className="row">
          <div className="dilema-wrap" style={{ flex: 1, minWidth: 280 }}>
            <input
              type="text"
              placeholder="Lo mejor de la semana, o lo que ajusto... o dicta con el micrófono"
              style={{ width: "100%" }}
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveReviewNote();
              }}
            />
            <button
              className={`mic-btn dilema-mic dilema-mic-input ${recording ? "rec" : ""}`}
              onClick={toggleDictado}
              title="Dictar"
            >
              🎙
            </button>
          </div>
          <button className="ghost" onClick={() => void saveReviewNote()}>
            Guardar cierre
          </button>
        </div>
        {savedNoteMsg && <div className="review-done">{savedNoteMsg}</div>}

        <div style={{ marginTop: 16 }}>
          {reviews.length ? (
            <>
              <div
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: ".8px",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Tu registro · {reviews.length} cierre{reviews.length > 1 ? "s" : ""}
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {[...reviews].reverse().map((r) => (
                  <div className="rv-entry" key={r.id}>
                    <div className="rv-entry-head">{r.rango || r.review_date}</div>
                    <div className="rv-entry-note">{r.note}</div>
                    {r.done_count != null && (
                      <div className="rv-chips">
                        <span className="rv-chip good">{r.done_count} cerradas</span>
                        <span className="rv-chip pend">{r.pend_count} pendientes</span>
                        {!!r.late_count && <span className="rv-chip late">{r.late_count} atrasadas</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-note">
              Aún no hay cierres. El primero que guardes queda acá — con el tiempo, este registro es
              la materia prima de tu balance anual.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
