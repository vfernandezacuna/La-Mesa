"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StickyNote, Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { askClaude, askClaudeWithFile } from "@/lib/claude-client";
import {
  criticalTopicFileExtractionSystemPrompt,
  criticalTopicReportExtractionSystemPrompt,
  criticalTopicStatusSystemPrompt,
  habilitacionPmoStatusSystemPrompt,
  criticalTopicTasksSystemPrompt,
} from "@/lib/prompts";
import { appendProfile, buildCriticalTopicContext } from "@/lib/context";
import { fechaCorta, ymd } from "@/lib/date";
import {
  EXTENSIONES_CORREO,
  EXTENSIONES_PLANILLA,
  leerArchivoDeReporte,
  type AdjuntoBinario,
} from "@/lib/material-files";
import type { CriticalTopic, CriticalTopicEntry, CriticalTopicTaskProposal, TaskPriority } from "@/lib/types";
import { LecturaEstado } from "./LecturaEstado";
import { TareasPorHacer, type TaskChoice } from "./TareasPorHacer";

interface ProposedTask {
  title: string;
  date: string | null;
  isDeadline: boolean;
  priority: TaskPriority;
}

const HISTORIAL_VISIBLE = 3;

function normTitle(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function destinoTexto(fecha: string | null): string {
  if (!fecha) return "sin fecha (en Trabajo)";
  if (fecha === ymd(new Date())) return "para hoy";
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  if (fecha === ymd(manana)) return "para mañana";
  return `para el ${fechaCorta(fecha)}`;
}

// Paleta fija para distinguir temas a simple vista — se asigna por orden de
// creación (no por posición en pantalla), así un tema no cambia de color
// cuando se crea uno nuevo.
const TOPIC_COLORS = ["#3D8F63", "#33517F", "#B8720E", "#A23E48", "#6B4C9A", "#1F7A72"];

function topicColor(allTopics: CriticalTopic[], id: string): string {
  const sorted = [...allTopics].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const idx = sorted.findIndex((t) => t.id === id);
  return TOPIC_COLORS[(idx < 0 ? 0 : idx) % TOPIC_COLORS.length];
}

async function prepareFileForClaude(file: File): Promise<{ base64: string; mediaType: string }> {
  let blob: Blob = file;
  let mediaType = file.type || "";
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(converted) ? converted[0] : converted;
    mediaType = "image/jpeg";
  }
  if ((!mediaType || mediaType === "application/octet-stream") && /\.pdf$/i.test(file.name)) {
    mediaType = "application/pdf";
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
  return { base64, mediaType };
}

function isTextFile(file: File): boolean {
  return /\.(txt|md)$/i.test(file.name) || file.type === "text/plain" || file.type === "text/markdown";
}

export default function CriticalTopicsView({
  initialTopics,
  initialTaskProposals,
  profile,
}: {
  initialTopics: CriticalTopic[];
  initialTaskProposals: CriticalTopicTaskProposal[];
  profile: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [topics, setTopics] = useState<CriticalTopic[]>(initialTopics);
  const [selectedId, setSelectedId] = useState<string | null>(initialTopics[0]?.id ?? null);
  const [newTitle, setNewTitle] = useState("");

  const [entries, setEntries] = useState<CriticalTopicEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showAllEntries, setShowAllEntries] = useState(false);

  const topic = topics.find((t) => t.id === selectedId) ?? null;
  const color = topic ? topicColor(topics, topic.id) : TOPIC_COLORS[0];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!selectedId) {
        setEntries([]);
        return;
      }
      setEntriesLoading(true);
      const { data } = await supabase
        .from("critical_topic_entries")
        .select("*")
        .eq("topic_id", selectedId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setEntries((data as CriticalTopicEntry[]) ?? []);
        setEntriesLoading(false);
        setExpandedEntries(new Set());
        setShowAllEntries(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, supabase]);

  function toggleExpand(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function crearTema() {
    const title = newTitle.trim();
    if (!title) return;
    const { data } = await supabase.from("critical_topics").insert({ title }).select().single();
    if (data) {
      setTopics((prev) => [data as CriticalTopic, ...prev]);
      setSelectedId((data as CriticalTopic).id);
    }
    setNewTitle("");
  }

  async function guardarFrentes(t: CriticalTopic, frentes: string[]) {
    const { data, error } = await supabase
      .from("critical_topics")
      .update({ frentes })
      .eq("id", t.id)
      .select()
      .single();
    if (error || !data) {
      setComposeError("No se pudieron guardar los frentes. ¿Corriste la migración 0012?");
      throw new Error("frentes");
    }
    setTopics((prev) => prev.map((x) => (x.id === t.id ? (data as CriticalTopic) : x)));
  }

  // ---------- composer ----------
  const [noteText, setNoteText] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [lecturaNotas, setLecturaNotas] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);

  async function actualizarLectura(t: CriticalTopic, allEntries: CriticalTopicEntry[]) {
    if (!allEntries.length) return;
    setStatusLoading(true);
    try {
      const user = buildCriticalTopicContext(t.title, allEntries, t.status_summary, t.frentes) + appendProfile("", profile);
      const sistema = /pmo/i.test(t.title) ? habilitacionPmoStatusSystemPrompt() : criticalTopicStatusSystemPrompt();
      const raw = await askClaude(sistema, user, 2000);
      const { data } = await supabase
        .from("critical_topics")
        .update({ status_summary: raw.trim(), status_updated_at: new Date().toISOString() })
        .eq("id", t.id)
        .select()
        .single();
      if (data) setTopics((prev) => prev.map((x) => (x.id === t.id ? (data as CriticalTopic) : x)));
    } catch {
      // deja la lectura anterior visible si falla
    }
    setStatusLoading(false);
  }

  // ---------- tareas por hacer ----------
  const [taskProposals, setTaskProposals] = useState<CriticalTopicTaskProposal[]>(initialTaskProposals);
  const [tasksLoadingTopic, setTasksLoadingTopic] = useState<string | null>(null);
  const [tasksMsg, setTasksMsg] = useState<string | null>(null);
  const [tasksAddedMsg, setTasksAddedMsg] = useState<string | null>(null);
  const topicTaskProposals = taskProposals.filter((p) => p.topic_id === selectedId);

  async function proponerTareas(t: CriticalTopic, text: string, sourceEntryId: string | null) {
    setTasksLoadingTopic(t.id);
    setTasksMsg(null);
    try {
      const today = ymd(new Date());
      const weekday = new Date().toLocaleDateString("es-CL", { weekday: "long" });
      const pendientes = taskProposals.filter((p) => p.topic_id === t.id);
      const yaPropuestas = pendientes.length
        ? `\n\nTareas ya propuestas (no las repitas):\n${pendientes.map((p) => `- ${p.title}`).join("\n")}`
        : "";
      const raw = await askClaude(criticalTopicTasksSystemPrompt(today, weekday), text + yaPropuestas, 1200, "low");
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as ProposedTask[];
      const vistos = new Set(pendientes.map((p) => normTitle(p.title)));
      const rows = (Array.isArray(parsed) ? parsed : [])
        .filter((x) => typeof x?.title === "string" && x.title.trim())
        .filter((x) => {
          const k = normTitle(x.title);
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        })
        .slice(0, 5)
        .map((x) => ({
          topic_id: t.id,
          title: x.title.trim().slice(0, 200),
          due_date: typeof x.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null,
          priority: (["alta", "media", "baja"] as const).includes(x.priority) ? x.priority : "media",
          is_deadline: !!x.isDeadline,
          source_entry_id: sourceEntryId,
        }));
      if (rows.length) {
        const { data, error } = await supabase.from("critical_topic_task_proposals").insert(rows).select();
        if (error) throw new Error(error.message);
        setTaskProposals((prev) => [...prev, ...((data as CriticalTopicTaskProposal[]) ?? [])]);
      } else if (!sourceEntryId) {
        setTasksMsg("No encontré tareas nuevas que valga la pena proponer.");
      }
    } catch {
      setTasksMsg("No se pudieron proponer tareas. ¿Corriste la migración 0009?");
    }
    setTasksLoadingTopic(null);
  }

  async function agregarTareaALaMesa(p: CriticalTopicTaskProposal, choice: TaskChoice) {
    setTasksMsg(null);
    setTasksAddedMsg(null);
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: choice.title,
        category: "trabajo",
        due_date: choice.due_date,
        is_deadline: p.is_deadline,
        priority: choice.priority,
        created_on: ymd(new Date()),
      })
      .select()
      .single();
    if (error || !task) {
      setTasksMsg("No se pudo agregar la tarea a La Mesa. Intentá de nuevo.");
      return;
    }
    await supabase
      .from("critical_topic_task_proposals")
      .update({ status: "agregada", title: choice.title, task_id: (task as { id: string }).id })
      .eq("id", p.id);
    setTaskProposals((prev) => prev.filter((x) => x.id !== p.id));
    setTasksAddedMsg(`«${choice.title}» quedó en La Mesa ${destinoTexto(choice.due_date)}.`);
  }

  async function descartarTarea(p: CriticalTopicTaskProposal) {
    setTaskProposals((prev) => prev.filter((x) => x.id !== p.id));
    await supabase.from("critical_topic_task_proposals").update({ status: "descartada" }).eq("id", p.id);
  }

  // Los archivos se van sumando a la lista (varios clics o arrastrando varios a la vez).
  function sumarArchivos(nuevos: File[]) {
    setArchivos((prev) => {
      const claves = new Set(prev.map((f) => `${f.name}|${f.size}`));
      return [...prev, ...nuevos.filter((f) => !claves.has(`${f.name}|${f.size}`))];
    });
  }

  async function agregar() {
    if (!topic) return;
    const text = noteText.trim();
    const files = archivos;
    if (!text && !files.length) return;
    setComposing(true);
    setComposeError(null);
    setLecturaNotas([]);
    setTasksAddedMsg(null);
    try {
      const kind: "note" | "material" = files.length ? "material" : "note";
      const fileName = files.length ? files.map((f) => f.name).join(", ").slice(0, 300) : null;
      const bloques: string[] = text ? [text] : [];
      const reporte: string[] = [];
      const avisos: string[] = [];
      const notas: string[] = [];
      let planillasLeidas = 0;
      const binarios: AdjuntoBinario[] = [];

      for (const f of files) {
        if (EXTENSIONES_CORREO.test(f.name) || EXTENSIONES_PLANILLA.test(f.name)) {
          // correo (con su Excel adjunto, si trae) o planilla suelta
          const leido = await leerArchivoDeReporte(f);
          reporte.push(...leido.textos);
          avisos.push(...(leido.avisos ?? []));
          notas.push(...leido.notas);
          planillasLeidas += leido.planillasLeidas;
          binarios.push(...leido.binarios);
        } else if (isTextFile(f)) {
          bloques.push(await f.text());
        } else {
          const { base64, mediaType } = await prepareFileForClaude(f);
          binarios.push({ name: f.name, base64, mediaType });
        }
      }

      if (reporte.length) {
        const crudo = reporte.join("\n\n").slice(0, 60000) + (text ? `\n\nNota de quien lo adjunta: ${text}` : "");
        const extraido = await askClaude(criticalTopicReportExtractionSystemPrompt(/pmo/i.test(topic.title)), crudo, 3500, "low");
        bloques.push(`[Reporte extraído de ${files.map((f) => f.name).join(", ")}]\n${extraido.trim()}`);
      }
      for (const b of binarios) {
        const extraido = await askClaudeWithFile(
          criticalTopicFileExtractionSystemPrompt(),
          b.base64,
          b.mediaType,
          text || "Extrae y transcribe el contenido relevante de este archivo.",
          2000,
        );
        bloques.push(`[Extraído de ${b.name}]\n${extraido.trim()}`);
      }
      const contentText = bloques.join("\n\n");
      if (!contentText.trim()) {
        setLecturaNotas(notas);
        throw new Error("sin contenido");
      }
      const { data: entryData } = await supabase
        .from("critical_topic_entries")
        .insert({ topic_id: topic.id, kind, content_text: contentText, file_name: fileName })
        .select()
        .single();
      const newEntry = entryData as CriticalTopicEntry | null;
      const allEntries = newEntry ? [...entries, newEntry] : entries;
      if (newEntry) setEntries(allEntries);
      setNoteText("");
      setArchivos([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // el aviso del enlace solo vale si ninguna planilla se leyó en esta tanda
      setLecturaNotas([...notas, ...(planillasLeidas === 0 ? avisos : [])]);
      void actualizarLectura(topic, allEntries);
    } catch (err) {
      setComposeError(
        err instanceof Error && err.message === "sin contenido"
          ? "No pude leer lo que adjuntaste; mira abajo el detalle de cada archivo."
          : "No se pudo agregar. Intenta nuevamente, o revisa que el archivo no sea demasiado pesado.",
      );
    }
    setComposing(false);
  }

  const notesCount = entries.filter((e) => e.kind === "note").length;
  const materialCount = entries.filter((e) => e.kind === "material").length;

  return (
    <>
      <h1 className="page-title">CNX Tracker</h1>
      <div className="page-sub">
        Los temas estratégicos de Conexión Energía que seguís de cerca. Mandale notas o material y te mantiene la
        lectura de estado al día, con lo que dice el material y cómo cambió.
      </div>

      <div className="topic-pills">
        {topics.map((t) => {
          const c = topicColor(topics, t.id);
          const active = t.id === selectedId;
          return (
            <button
              key={t.id}
              className="topic-pill"
              style={
                active
                  ? { borderColor: c, color: c, background: `color-mix(in srgb, ${c} 12%, var(--paper))` }
                  : { borderColor: `color-mix(in srgb, ${c} 45%, var(--hairline-strong))` }
              }
              onClick={() => setSelectedId(t.id)}
            >
              <span className="topic-pill-dot" style={{ background: c }} />
              {t.title}
            </button>
          );
        })}
      </div>

      <div className="topic-card compact">
        <div className="row">
          <input
            type="text"
            placeholder="Nombre del tema — ej: Concesión Línea Kimal-Lo Aguirre"
            style={{ flex: 1, minWidth: 240 }}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void crearTema();
            }}
          />
          <button className="ghost" onClick={() => void crearTema()}>
            + Nuevo tema
          </button>
        </div>
      </div>

      {!topic ? (
        <div className="empty-note">Creá tu primer tema arriba para empezar a seguirle la pista.</div>
      ) : (
        <>
          <LecturaEstado
            text={topic.status_summary}
            color={color}
            updatedAt={topic.status_updated_at}
            canRefresh={entries.length > 0}
            loading={statusLoading}
            onRefresh={() => void actualizarLectura(topic, entries)}
            frentes={topic.frentes ?? []}
            onSaveFrentes={(f) => guardarFrentes(topic, f)}
          />

          <TareasPorHacer
            proposals={topicTaskProposals}
            loading={tasksLoadingTopic === topic.id}
            canPropose={entries.length > 0 && !tasksLoadingTopic}
            message={tasksMsg}
            addedMsg={tasksAddedMsg}
            onPropose={() =>
              void proponerTareas(
                topic,
                `${topic.status_summary ? `LECTURA DE ESTADO ACTUAL:\n${topic.status_summary}\n\n` : ""}${buildCriticalTopicContext(topic.title, entries)}`,
                null,
              )
            }
            onAdd={agregarTareaALaMesa}
            onDismiss={(p) => void descartarTarea(p)}
          />

          <div className="topic-card compact">
            <h2>Agregar nota o material</h2>
            <textarea
              placeholder="Pegá una nota o el cuerpo de un correo, o adjuntá archivos: correo (.eml o .msg, con su Excel), planilla (.xlsx), PDF, foto (incluye HEIC del iPad) o texto…"
              value={noteText}
              rows={3}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div
              className={`adj-zona ${arrastrando ? "on" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                sumarArchivos(Array.from(e.dataTransfer.files));
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt,.md,image/*,.heic,.heif,.eml,.msg,.xlsx,.csv"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  sumarArchivos(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <button className="ghost btn-icon btn-sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={14} aria-hidden="true" />
                Adjuntar archivos
              </button>
              <span className="adj-hint">
                {archivos.length
                  ? "Puedes seguir sumando (correo + Excel, por ejemplo)."
                  : "o arrástralos aquí, varios a la vez: correo, Excel, PDF…"}
              </span>
            </div>
            {archivos.length > 0 && (
              <div className="adj-lista">
                {archivos.map((f) => (
                  <span className="adj-chip" key={`${f.name}|${f.size}`}>
                    <Paperclip size={12} aria-hidden="true" />
                    {f.name}
                    <span className="adj-peso">{f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}</span>
                    <button
                      className="adj-x"
                      aria-label={`Quitar ${f.name}`}
                      onClick={() => setArchivos((prev) => prev.filter((x) => x !== f))}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="row" style={{ marginTop: 8, alignItems: "center", justifyContent: "flex-end" }}>
              <button className="btn-sm" onClick={() => void agregar()} disabled={composing}>
                Agregar
              </button>
            </div>
            {composing && (
              <div className="ai-loading" style={{ display: "block" }}>
                <div className="ail-head">
                  <span className="ail-spin"></span>
                  <span>
                    Archivando<span className="ail-dots"></span>
                  </span>
                </div>
                <div className="ail-sub">Leyendo el material y actualizando el tema.</div>
              </div>
            )}
            {composeError && <div className="empty-note">{composeError}</div>}
            {lecturaNotas.length > 0 && (
              <div className="adj-notas">
                <b>Qué leí:</b>
                {lecturaNotas.map((n, i) => (
                  <div key={i}>{n}</div>
                ))}
              </div>
            )}
          </div>

          <div className="topic-card compact">
            <div className="hm-head" style={{ marginBottom: 6 }}>
              <h2>Historial del tema</h2>
              {entries.length > 0 && (
                <div className="hm-sub">
                  {notesCount} nota{notesCount === 1 ? "" : "s"} · {materialCount} archivo
                  {materialCount === 1 ? "" : "s"} · última {fechaCorta(entries[entries.length - 1].created_at)}
                </div>
              )}
            </div>
            {entriesLoading ? (
              <span className="loading">Cargando…</span>
            ) : entries.length === 0 ? (
              <span className="loading">Sin registros aún.</span>
            ) : (
              <>
                {[...entries]
                  .reverse()
                  .slice(0, showAllEntries ? undefined : HISTORIAL_VISIBLE)
                  .map((e) => {
                    const expanded = expandedEntries.has(e.id);
                    const isLong = e.content_text.length > 160;
                    const isMaterial = e.kind === "material";
                    return (
                      <div
                        className="topic-entry"
                        key={e.id}
                        onClick={() => isLong && toggleExpand(e.id)}
                        style={{ cursor: isLong ? "pointer" : "default" }}
                      >
                        <div className="te-icon" style={{ color: isMaterial ? "var(--azul-deep)" : "var(--accent-deep)" }}>
                          {isMaterial ? <Paperclip size={14} /> : <StickyNote size={14} />}
                        </div>
                        <div className="te-body">
                          <div className="te-meta">
                            {fechaCorta(e.created_at)}
                            {e.file_name ? ` · ${e.file_name}` : ""}
                          </div>
                          <div className={`te-text ${!expanded && isLong ? "clamped" : ""}`}>{e.content_text}</div>
                          {isLong && <span className="te-toggle">{expanded ? "Ver menos" : "Ver más"}</span>}
                        </div>
                      </div>
                    );
                  })}
                {entries.length > HISTORIAL_VISIBLE && (
                  <button className="text-action" onClick={() => setShowAllEntries((v) => !v)} style={{ paddingLeft: 0 }}>
                    {showAllEntries ? "Mostrar solo lo último" : `Ver todo el historial (${entries.length})`}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
