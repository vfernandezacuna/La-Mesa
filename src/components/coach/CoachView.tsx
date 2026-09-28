"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude, askClaudeWithPdf } from "@/lib/claude-client";
import {
  coachCheckinSystemPrompt,
  healthVerdictSystemPrompt,
  examPdfExtractionSystemPrompt,
} from "@/lib/prompts";
import { buildTaskContext, buildHealthContext, buildAdvisorContext, appendProfile } from "@/lib/context";
import { todayStr } from "@/lib/date";
import type {
  Checkin,
  ExamResult,
  Habit,
  HabitLog,
  Task,
  WeeklyReview,
  WeightLog,
  HealthVerdict,
} from "@/lib/types";

function esc(s: string) {
  return s;
}

const fechaLarga = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
const fechaCorta = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-CL", { month: "short", year: "numeric" });

// ---------- Índices clave de exámenes ----------
interface IndiceClave {
  k: string;
  n: string;
  alias: string[];
  min?: number;
  max?: number;
  excluye?: string[];
}
const INDICES_CLAVE: IndiceClave[] = [
  { k: "glicemia", n: "Glicemia en ayunas", alias: ["glicemia", "glucosa", "glucemia"], min: 70, max: 99 },
  { k: "hba1c", n: "Hemoglobina glicosilada", alias: ["glicosilada", "hba1c", "a1c"], max: 5.7 },
  { k: "trigliceridos", n: "Triglicéridos", alias: ["triglicerid"], max: 150 },
  { k: "col_total", n: "Colesterol total", alias: ["colesterol total"], max: 200 },
  { k: "ldl", n: "Colesterol LDL", alias: ["ldl"], max: 130 },
  { k: "hdl", n: "Colesterol HDL", alias: ["hdl"], excluye: ["no hdl"], min: 40 },
  { k: "presion", n: "Presión arterial", alias: ["presion arterial"] },
  { k: "gpt", n: "Transaminasas GPT-ALT", alias: ["gpt", "alt"], min: 10, max: 50 },
  { k: "ggt", n: "GGT", alias: ["ggt", "gamma"], min: 3, max: 60 },
  { k: "tfge", n: "Filtración glomerular", alias: ["glomerular", "tfge", "vfg"], min: 60 },
  { k: "urico", n: "Ácido úrico", alias: ["urico"], min: 3.4, max: 7.0 },
  { k: "blancos", n: "Glóbulos blancos", alias: ["blanco", "leucocito"], min: 3.6, max: 10.9 },
  { k: "rojos", n: "Glóbulos rojos", alias: ["rojo", "eritrocito", "hematie"], min: 4.05, max: 5.76 },
  { k: "hemoglobina", n: "Hemoglobina", alias: ["hemoglobina"], min: 12.6, max: 17.2 },
  { k: "vitd", n: "Vitamina D", alias: ["vitamina d", "25-oh"], min: 30 },
  { k: "testosterona", n: "Testosterona", alias: ["testosterona"] },
  { k: "eco", n: "Ecografía abdominal", alias: ["ecograf", "ecotomograf"] },
  { k: "ecg", n: "Electrocardiograma", alias: ["electrocardio", "ecg"] },
];
function numDe(v: string | null | undefined): number | null {
  if (v == null) return null;
  const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function estadoIndice(idx: IndiceClave | undefined, valor: string): "alto" | "bajo" | null {
  if (!idx || (idx.min == null && idx.max == null)) return null;
  if (String(valor).includes(">") && idx.min != null) return null;
  const n = numDe(valor);
  if (n === null) return null;
  if (idx.max != null && n > idx.max) return "alto";
  if (idx.min != null && n < idx.min) return "bajo";
  return null;
}
function claveDeIndice(nombre: string): string | null {
  const n = (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  const candidatos: { k: string; largo: number }[] = [];
  INDICES_CLAVE.forEach((i) => {
    if (i.excluye && i.excluye.some((x) => n.includes(x))) return;
    i.alias.forEach((a) => {
      if (n.includes(a)) candidatos.push({ k: i.k, largo: a.length });
    });
  });
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => b.largo - a.largo);
  return candidatos[0].k;
}

function firmaSalud(weightLog: WeightLog[], examResults: ExamResult[]): string {
  const sortedW = [...weightLog].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const p = sortedW.length ? `${sortedW[sortedW.length - 1].recorded_on}:${sortedW[sortedW.length - 1].kg}` : "sin-peso";
  const fechas = [...new Set(examResults.map((e) => e.taken_on).filter(Boolean))].sort() as string[];
  const e = fechas.length ? `${fechas[fechas.length - 1]}:${examResults.length}` : "sin-exam";
  return `${p}|${e}`;
}

function PesoChart({ data }: { data: WeightLog[] }) {
  if (data.length < 2) return null;
  const sorted = [...data].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const W = 780,
    H = 210,
    ml = 40,
    mr = 12,
    mt = 16,
    mb = 28;
  const vals = sorted.map((p) => p.kg);
  const min = Math.floor(Math.min(...vals) - 1);
  const max = Math.ceil(Math.max(...vals) + 1);
  const t0 = new Date(sorted[0].recorded_on + "T00:00:00").getTime();
  const t1 = new Date(sorted[sorted.length - 1].recorded_on + "T00:00:00").getTime();
  const X = (d: string) => ml + ((new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0 || 1)) * (W - ml - mr);
  const Y = (v: number) => mt + (1 - (v - min) / (max - min || 1)) * (H - mt - mb);
  const pts = sorted.map((p) => `${X(p.recorded_on).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(" ");
  const area = `${ml},${Y(min)} ${pts} ${X(sorted[sorted.length - 1].recorded_on).toFixed(1)},${Y(min)}`;
  const años = [...new Set(sorted.map((p) => p.recorded_on.slice(0, 4)))];
  const guias: number[] = [];
  for (let v = min; v <= max; v += 2) guias.push(v);
  const ult = sorted[sorted.length - 1];
  return (
    <div className="peso-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {guias.map((v) => (
          <g key={v}>
            <line x1={ml} y1={Y(v)} x2={W - mr} y2={Y(v)} stroke="var(--hairline)" strokeWidth={1} strokeDasharray="2,3" />
            <text x={ml - 7} y={Y(v) + 3} className="sp-ax" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {años.map((a) => {
          const primero = sorted.find((p) => p.recorded_on.slice(0, 4) === a)!;
          const x = X(primero.recorded_on);
          return (
            <g key={a}>
              <line x1={x} y1={mt} x2={x} y2={H - mb} stroke="var(--hairline)" strokeWidth={1} />
              <text x={x + 4} y={H - mb + 16} className="sp-ax">
                {a}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill="var(--azul-tint)" opacity={0.55} />
        <polyline points={pts} fill="none" stroke="var(--azul)" strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={X(ult.recorded_on)} cy={Y(ult.kg)} r={4} fill="var(--azul-deep)" />
      </svg>
      <div className="peso-chart-note">
        Kilos · {sorted.length} mediciones desde {fechaCorta(sorted[0].recorded_on)}
      </div>
    </div>
  );
}

export default function CoachView({
  initialCheckins,
  initialWeightLog,
  initialExamResults,
  initialVerdict,
  habits,
  habitLogs,
  tasks,
  profile,
  weeklyInsight,
  weeklyReviews,
}: {
  initialCheckins: Checkin[];
  initialWeightLog: WeightLog[];
  initialExamResults: ExamResult[];
  initialVerdict: HealthVerdict | null;
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  profile: string;
  weeklyReviews: WeeklyReview[];
  weeklyInsight: {
    review_date: string | null;
    coach_conclusion: string | null;
    coach_semana: string | null;
    coach_accion: string | null;
  } | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const today = todayStr();

  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins);
  const [weightLog, setWeightLog] = useState<WeightLog[]>(initialWeightLog);
  const [examResults, setExamResults] = useState<ExamResult[]>(initialExamResults);
  const [verdict, setVerdict] = useState<HealthVerdict | null>(initialVerdict);

  const healthCtx = () => appendProfile(buildTaskContext(tasks) + buildHealthContext(habits, habitLogs, weightLog, examResults), profile);

  // ---------- Check-in semanal ----------
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinResult, setCheckinResult] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  async function checkinCoach() {
    setCheckingIn(true);
    setCheckinError(null);
    setCheckinResult(null);
    try {
      const user =
        `Cierre de semana. Ánimo: ${mood ?? "no indicado"}/5. Su nota: ${note || "(sin nota)"}.` +
        appendProfile(
          buildTaskContext(tasks) +
            buildAdvisorContext("coach", { checkins, habits, habitLogs, weightLog, examResults, weeklyReviews }),
          profile,
        );
      const raw = await askClaude(coachCheckinSystemPrompt(), user, 1600);
      setCheckinResult(raw.trim());
      const { data } = await supabase
        .from("checkins")
        .insert({ mood, note: note || null })
        .select()
        .single();
      if (data) setCheckins((c) => [...c, data as Checkin]);
      setNote("");
    } catch {
      setCheckinError("No se pudo generar la respuesta.");
    }
    setCheckingIn(false);
  }

  // ---------- Sentencia de salud ----------
  const [verdictLoading, setVerdictLoading] = useState(false);
  const currentSignature = firmaSalud(weightLog, examResults);
  const obsoleto = !!verdict && verdict.signature !== currentSignature;

  async function generarVeredicto() {
    if (!weightLog.length && !examResults.length) return;
    setVerdictLoading(true);
    try {
      const raw = await askClaude(healthVerdictSystemPrompt(), healthCtx(), 1800);
      const signature = firmaSalud(weightLog, examResults);
      const { data } = await supabase
        .from("health_verdicts")
        .insert({ verdict_text: raw.trim(), signature })
        .select()
        .single();
      if (data) setVerdict(data as HealthVerdict);
    } catch {
      // deja el veredicto anterior visible si falla
    }
    setVerdictLoading(false);
  }

  // ---------- Peso ----------
  const [pesoVal, setPesoVal] = useState("");
  const [pesoBulk, setPesoBulk] = useState("");
  const [pesoBulkStatus, setPesoBulkStatus] = useState("");

  const sortedWeight = [...weightLog].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const lastPeso = sortedWeight[sortedWeight.length - 1];
  const prevPeso = sortedWeight.length > 1 ? sortedWeight[sortedWeight.length - 2] : null;
  const minPeso = sortedWeight.length ? sortedWeight.reduce((a, b) => (b.kg < a.kg ? b : a)) : null;
  function calcHace12(): WeightLog | null {
    if (!lastPeso) return null;
    const objetivo = new Date(lastPeso.recorded_on + "T00:00:00");
    objetivo.setFullYear(objetivo.getFullYear() - 1);
    const os = objetivo.toISOString().slice(0, 10);
    let best: WeightLog | null = null;
    sortedWeight.forEach((p) => {
      if (p.recorded_on <= os && (!best || p.recorded_on > best.recorded_on)) best = p;
    });
    return best;
  }
  const hace12 = calcHace12();
  const dPrev = prevPeso && lastPeso ? lastPeso.kg - prevPeso.kg : null;
  const dAno = hace12 && lastPeso ? lastPeso.kg - hace12.kg : null;

  async function addPeso() {
    const v = parseFloat(pesoVal);
    if (isNaN(v) || v <= 0) return;
    const { data } = await supabase
      .from("weight_log")
      .upsert({ recorded_on: today, kg: v }, { onConflict: "user_id,recorded_on" })
      .select()
      .single();
    if (data) {
      setWeightLog((w) => [...w.filter((x) => x.recorded_on !== today), data as WeightLog]);
    }
    setPesoVal("");
  }
  async function delPeso(id: string) {
    setWeightLog((w) => w.filter((p) => p.id !== id));
    await supabase.from("weight_log").delete().eq("id", id);
  }
  async function cargarPesoMasivo() {
    const txt = pesoBulk.trim();
    if (!txt) {
      setPesoBulkStatus("Pega tu historial primero.");
      return;
    }
    const MESES: Record<string, number> = {
      enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
      septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    };
    const rows: { recorded_on: string; kg: number }[] = [];
    let ok = 0,
      fail = 0;
    txt.split("\n").forEach((linea) => {
      const l = linea.trim();
      if (!l) return;
      let fecha: string | null = null;
      let valor: number | null = null;
      let m = l.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\D+(\d{2,3}[.,]?\d*)/);
      if (m) {
        fecha = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
        valor = parseFloat(m[4].replace(",", "."));
      }
      if (!fecha) {
        m = l.match(/([a-záéíóú]+)\s+(\d{4})\D+(\d{2,3}[.,]?\d*)/i);
        if (m && MESES[m[1].toLowerCase()]) {
          fecha = `${m[2]}-${String(MESES[m[1].toLowerCase()]).padStart(2, "0")}-15`;
          valor = parseFloat(m[3].replace(",", "."));
        }
      }
      if (!fecha) {
        m = l.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})\D+(\d{2,3}[.,]?\d*)/);
        if (m) {
          fecha = `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
          valor = parseFloat(m[4].replace(",", "."));
        }
      }
      if (fecha && valor && valor > 20 && valor < 300) {
        rows.push({ recorded_on: fecha, kg: valor });
        ok++;
      } else fail++;
    });
    if (rows.length) {
      const { data } = await supabase.from("weight_log").upsert(rows, { onConflict: "user_id,recorded_on" }).select();
      if (data) {
        const porFecha: Record<string, WeightLog> = {};
        [...weightLog, ...(data as WeightLog[])].forEach((p) => {
          porFecha[p.recorded_on] = p;
        });
        setWeightLog(Object.values(porFecha).sort((a, b) => a.recorded_on.localeCompare(b.recorded_on)));
      }
    }
    setPesoBulk("");
    setPesoBulkStatus(`${ok} registro${ok === 1 ? "" : "s"} cargado${ok === 1 ? "" : "s"}${fail ? ` · ${fail} línea${fail === 1 ? "" : "s"} no se pudo interpretar` : ""}.`);
  }

  // ---------- Exámenes ----------
  const [examName, setExamName] = useState("");
  const [examVal, setExamVal] = useState("");
  const [examDate, setExamDate] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfPending, setPdfPending] = useState<{ fecha: string; indices: { name: string; val: string }[] } | null>(null);

  async function addExam() {
    if (!examName.trim() || !examVal.trim()) return;
    const { data } = await supabase
      .from("exam_results")
      .insert({ test_name: examName.trim(), value: examVal.trim(), taken_on: examDate || today })
      .select()
      .single();
    if (data) setExamResults((e) => [data as ExamResult, ...e]);
    setExamName("");
    setExamVal("");
    setExamDate("");
  }
  async function delExam(id: string) {
    setExamResults((e) => e.filter((x) => x.id !== id));
    await supabase.from("exam_results").delete().eq("id", id);
  }

  async function procesarPdfExamenes(file: File) {
    setPdfStatus(file.name);
    setPdfError(null);
    setPdfPending(null);
    setPdfLoading(true);
    try {
      const b64: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("No se pudo leer el archivo"));
        r.readAsDataURL(file);
      });
      const txt = await askClaudeWithPdf(examPdfExtractionSystemPrompt(), b64, "Extrae los índices de este examen.", 2000);
      const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      if (!parsed.indices || !parsed.indices.length) {
        setPdfError("No encontré índices en ese documento. Puedes agregarlos a mano abajo.");
      } else {
        setPdfPending({ fecha: parsed.fecha || today, indices: parsed.indices });
      }
    } catch {
      setPdfError("No se pudo leer el PDF. Verifica que sea un archivo válido, o agrega los índices a mano.");
    }
    setPdfLoading(false);
  }

  async function confirmarPdfExamenes() {
    if (!pdfPending) return;
    const rows = pdfPending.indices.map((i) => ({ test_name: i.name, value: i.val, taken_on: pdfPending.fecha }));
    const { data } = await supabase.from("exam_results").insert(rows).select();
    if (data) setExamResults((e) => [...(data as ExamResult[]), ...e]);
    setPdfPending(null);
    setPdfStatus("");
  }

  // tabla de índices clave
  const fechasDesc = [...new Set(examResults.map((e) => e.taken_on).filter(Boolean))].sort((a, b) => (b as string).localeCompare(a as string)).slice(0, 6) as string[];
  const fechasAsc = [...fechasDesc].reverse();
  const mapaIdx: Record<string, Record<string, string>> = {};
  const sueltos: Record<string, Record<string, string>> = {};
  examResults.forEach((e) => {
    if (!e.taken_on) return;
    const k = claveDeIndice(e.test_name);
    if (k) {
      (mapaIdx[k] ??= {})[e.taken_on] = e.value;
    } else {
      (sueltos[e.test_name] ??= {})[e.taken_on] = e.value;
    }
  });
  const filasIdx = INDICES_CLAVE.filter((i) => mapaIdx[i.k]);
  const nOtros = Object.keys(sueltos).length;

  return (
    <div>
      <h1 className="page-title">Coach</h1>
      <div className="page-sub">Tu lectura de la semana y un check-in breve. Un mentor que te conoce, no un supervisor.</div>

      {weeklyInsight?.coach_conclusion && (
        <div className="close-insight" style={{ marginBottom: 22 }}>
          <div className="ci-lbl">Tu lectura de la semana</div>
          <div className="ci-body">{weeklyInsight.coach_conclusion}</div>
          {weeklyInsight.coach_semana && (
            <div className="ci-action">
              <div className="ci-action-lbl">Cómo encarar la que viene</div>
              <div className="ci-body">{weeklyInsight.coach_semana}</div>
              {weeklyInsight.coach_accion && (
                <div className="ci-body" style={{ fontWeight: 600, marginTop: 10 }}>
                  → {weeklyInsight.coach_accion}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h2>¿Cómo termina tu semana?</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Tu coach cruza esto con tus hábitos, tu deporte, tu peso y tus exámenes para darte la lectura de la semana y preparar la que viene.
        </div>
        <div className="mood-scale">
          {["1", "2", "3", "4", "5"].map((l) => (
            <div
              key={l}
              className={`mood-opt ${mood === Number(l) ? "selected" : ""}`}
              onClick={() => setMood(Number(l))}
            >
              {l}
            </div>
          ))}
        </div>
        <textarea
          placeholder="¿Cómo te sentiste esta semana? ¿Qué te costó, qué funcionó? (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <button onClick={() => void checkinCoach()} disabled={checkingIn}>
            Cerrar la semana con tu coach
          </button>
        </div>
        {checkingIn && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Tu coach está analizando tu semana<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Revisando hábitos, deporte, salud y tu carga de trabajo.</div>
          </div>
        )}
        {checkinError && <div className="empty-note">{checkinError}</div>}
        {checkinResult && (
          <div className="response-box">
            {checkinResult.split(/\n/).map((line, i) => {
              const m = line.match(/^(CÓMO CERRÓ TU SEMANA:|LO QUE VEO:|PARA LA SEMANA QUE VIENE:)(.*)$/);
              if (m) {
                return (
                  <div key={i}>
                    <strong style={{ color: "var(--accent-deep)", display: "block", marginTop: 15, marginBottom: 5, letterSpacing: 1, fontSize: "0.72rem", textTransform: "uppercase" }}>
                      {m[1]}
                    </strong>
                    {m[2]}
                  </div>
                );
              }
              return <div key={i}>{line}</div>;
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Cierres anteriores</h2>
        <div>
          {checkins.length === 0 ? (
            <span className="loading">Sin registros aún.</span>
          ) : (
            [...checkins].reverse().map((c) => (
              <div className="log-entry" key={c.id}>
                <div className="meta">
                  {new Date(c.created_at).toLocaleString("es-CL")} · energía {c.mood ?? "-"}/5
                </div>
                {c.note ?? ""}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Tu salud física · la sentencia de tu coach</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Su lectura de tu cuerpo: peso, exámenes y marcadores. Queda fija hasta que cargues datos nuevos.
        </div>
        {!verdict || !verdict.verdict_text ? (
          <div className="empty-note">
            Aún no hay una lectura.{" "}
            <span className="ver-link" onClick={() => void generarVeredicto()}>
              Pedirle a tu coach que revise tus datos →
            </span>
          </div>
        ) : (
          <div className={`veredicto ${obsoleto ? "obsoleto" : ""}`}>
            {obsoleto && (
              <div className="ver-alerta">
                Cargaste datos nuevos desde esta lectura.{" "}
                <span className="ver-link" onClick={() => void generarVeredicto()}>
                  Actualizarla →
                </span>
              </div>
            )}
            <div className="ver-body">
              {verdict.verdict_text.split("\n").map((l, i) => (
                <span key={i}>
                  {l}
                  <br />
                </span>
              ))}
            </div>
            <div className="ver-pie">
              <span>Lectura del {fechaLarga(verdict.created_at.slice(0, 10))}</span>
              {!obsoleto && (
                <span className="ver-link" onClick={() => void generarVeredicto()}>
                  Volver a pedirla
                </span>
              )}
            </div>
          </div>
        )}
        {verdictLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Tu coach está revisando tu salud<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Cruzando peso, exámenes, hábitos y tratamiento.</div>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Peso</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Tu trayectoria completa. Lo que importa es la curva, no el número de hoy.
        </div>
        {!lastPeso ? (
          <div className="empty-note">Sin registros de peso aún.</div>
        ) : (
          <>
            <div className="peso-hero">
              <div>
                <div className="ph-lbl">Peso actual · {fechaLarga(lastPeso.recorded_on)}</div>
                <div className="peso-val">
                  {lastPeso.kg.toFixed(1)}
                  <span className="pv-u">kg</span>
                </div>
              </div>
              <div className="peso-refs">
                {dPrev !== null && (
                  <div className="pr-item">
                    <span className="pr-l">vs. medición anterior</span>
                    <span className={`pr-v ${dPrev <= 0 ? "down" : "up"}`}>
                      {dPrev > 0 ? "+" : ""}
                      {dPrev.toFixed(2)} kg
                    </span>
                  </div>
                )}
                {dAno !== null && (
                  <div className="pr-item">
                    <span className="pr-l">vs. hace un año</span>
                    <span className={`pr-v ${dAno <= 0 ? "down" : "up"}`}>
                      {dAno > 0 ? "+" : ""}
                      {dAno.toFixed(1)} kg
                    </span>
                  </div>
                )}
                {minPeso && (
                  <div className="pr-item">
                    <span className="pr-l">mínimo registrado</span>
                    <span className="pr-v neutral">
                      {minPeso.kg.toFixed(1)} kg · {fechaCorta(minPeso.recorded_on)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <PesoChart data={sortedWeight} />
          </>
        )}
        {sortedWeight.length > 0 && (
          <div className="peso-hist">
            <details>
              <summary>Ver las {sortedWeight.length} mediciones</summary>
              <table className="pat-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Peso</th>
                    <th>Δ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...sortedWeight].reverse().map((p, i, arr) => {
                    const ant = arr[i + 1];
                    const d = ant ? p.kg - ant.kg : null;
                    return (
                      <tr key={p.id}>
                        <td className="pt-per">{fechaLarga(p.recorded_on)}</td>
                        <td className="pt-net">{p.kg.toFixed(2)}</td>
                        <td style={{ color: d === null ? "var(--n500)" : d <= 0 ? "var(--accent-deep)" : "var(--azul-deep)" }}>
                          {d === null ? "—" : (d > 0 ? "+" : "") + d.toFixed(2)}
                        </td>
                        <td>
                          <span className="pt-del" onClick={() => void delPeso(p.id)}>
                            ✕
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Exámenes de salud</h2>
        <div className="page-sub" style={{ margin: "-6px 0 16px 0" }}>
          Tus índices anuales, control a control.
        </div>
        {!examResults.length ? (
          <div className="empty-note">Sin exámenes registrados. Sube el PDF de tu último control y extraigo los índices solos.</div>
        ) : (
          <>
            <div className="exam-wrap">
              <table className="exam-table">
                <thead>
                  <tr>
                    <th className="ex-idx">Índice</th>
                    {fechasAsc.map((f) => {
                      const d = new Date(f + "T00:00:00");
                      return (
                        <th key={f}>
                          {d.toLocaleDateString("es-CL", { month: "short" })}
                          <br />
                          <span className="ex-y">{d.getFullYear()}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filasIdx.map((i) => (
                    <tr key={i.k}>
                      <td className="ex-idx">{i.n}</td>
                      {fechasAsc.map((f) => {
                        const v = mapaIdx[i.k][f];
                        if (!v) return (
                          <td key={f}>
                            <span className="ex-na">·</span>
                          </td>
                        );
                        const est = estadoIndice(i, v);
                        const limpio = String(v).replace(/[↑↓]/g, "").trim();
                        return (
                          <td key={f} className={est ? "ex-fuera" : ""}>
                            {esc(limpio)}
                            {est === "alto" && <span className="ex-arr up">▲</span>}
                            {est === "bajo" && <span className="ex-arr down">▼</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filasIdx.length && (
              <div className="empty-note" style={{ marginTop: 10 }}>
                Aún no reconozco índices clave en lo registrado.
              </div>
            )}
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: "0.76rem", color: "var(--n600)", cursor: "pointer" }}>
                Ver todos los registros{nOtros ? ` · ${nOtros} índice${nOtros > 1 ? "s" : ""} adicional${nOtros > 1 ? "es" : ""}` : ""}
              </summary>
              <div style={{ marginTop: 10 }}>
                {[...examResults]
                  .sort((a, b) => (b.taken_on ?? "").localeCompare(a.taken_on ?? ""))
                  .map((e) => (
                    <div className="exam-row" key={e.id}>
                      <span className="ex-date">{e.taken_on}</span>
                      <span className="ex-name">{e.test_name}</span>
                      <span className="ex-val">{e.value}</span>
                      <span className="ex-del" onClick={() => void delExam(e.id)}>
                        ✕
                      </span>
                    </div>
                  ))}
              </div>
            </details>
          </>
        )}
      </div>

      <div className="panel registro-panel">
        <h2>Registrar datos nuevos</h2>
        <div className="page-sub" style={{ margin: "-6px 0 16px 0" }}>
          Aquí actualizas tu peso y cargas los exámenes de un control nuevo.
        </div>

        <div className="reg-bloque">
          <div className="reg-lbl">Peso</div>
          <div className="row">
            <input
              type="number"
              placeholder="Ej: 89.5"
              step="0.1"
              style={{ maxWidth: 130 }}
              value={pesoVal}
              onChange={(e) => setPesoVal(e.target.value)}
            />
            <span style={{ color: "var(--n600)", fontSize: "0.9rem" }}>kg</span>
            <button className="ghost" onClick={() => void addPeso()}>
              Registrar
            </button>
          </div>
          <details className="peso-bulk">
            <summary>Cargar un historial completo de una vez</summary>
            <div style={{ marginTop: 10 }}>
              <textarea
                placeholder={"Una línea por medición. Ej:\n2024-03-15 95\n2024-08-01 93.5\nmayo 2025 91\n2025-12-20 90.2"}
                style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: "0.82rem" }}
                value={pesoBulk}
                onChange={(e) => setPesoBulk(e.target.value)}
              />
              <div style={{ marginTop: 9 }}>
                <button className="ghost" onClick={() => void cargarPesoMasivo()}>
                  Cargar historial
                </button>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--n600)", marginTop: 8 }}>{pesoBulkStatus}</div>
            </div>
          </details>
        </div>

        <div className="reg-bloque">
          <div className="reg-lbl">Exámenes</div>
          <div className="pdf-drop">
            <div className="pdf-drop-lbl">Sube el PDF de tus exámenes y extraigo los índices solo</div>
            <input
              type="file"
              accept="application/pdf"
              id="coach-exam-pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void procesarPdfExamenes(f);
                e.target.value = "";
              }}
            />
            <button className="ghost" onClick={() => document.getElementById("coach-exam-pdf")?.click()}>
              Elegir PDF
            </button>
            <span className="pdf-status">{pdfStatus}</span>
          </div>
          {pdfLoading && (
            <div className="ai-loading" style={{ display: "block" }}>
              <div className="ail-head">
                <span className="ail-spin"></span>
                <span>
                  Leyendo tus exámenes<span className="ail-dots"></span>
                </span>
              </div>
              <div className="ail-sub">Extrayendo los índices principales del documento.</div>
            </div>
          )}
          {pdfError && <div className="empty-note">{pdfError}</div>}
          {pdfPending && (
            <div className="pdf-preview-box">
              <div className="pdf-prev-head">
                Encontré {pdfPending.indices.length} índice{pdfPending.indices.length === 1 ? "" : "s"} · examen del {fechaLarga(pdfPending.fecha)}
              </div>
              {pdfPending.indices.map((i, idx) => (
                <div className="exam-row" key={idx}>
                  <span className="ex-name">{i.name}</span>
                  <span className="ex-val">{i.val}</span>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <button onClick={() => void confirmarPdfExamenes()}>Guardar estos índices</button>{" "}
                <button className="text-action" onClick={() => setPdfPending(null)}>
                  Descartar
                </button>
              </div>
            </div>
          )}
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: "0.78rem", color: "var(--n600)", cursor: "pointer" }}>O agregar un índice a mano</summary>
            <div style={{ marginTop: 12 }}>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Índice (ej: Colesterol LDL)"
                  style={{ flex: 1, minWidth: 180 }}
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Valor (ej: 110 mg/dL)"
                  style={{ maxWidth: 170 }}
                  value={examVal}
                  onChange={(e) => setExamVal(e.target.value)}
                />
                <input type="date" style={{ maxWidth: 160 }} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="ghost" onClick={() => void addExam()}>
                  Agregar índice
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
