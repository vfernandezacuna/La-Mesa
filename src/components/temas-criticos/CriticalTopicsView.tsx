"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StickyNote, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { askClaude, askClaudeWithFile } from "@/lib/claude-client";
import {
  criticalTopicFileExtractionSystemPrompt,
  criticalTopicItemsSystemPrompt,
  criticalTopicStatusSystemPrompt,
  criticalTopicTasksSystemPrompt,
} from "@/lib/prompts";
import { appendProfile, buildCriticalTopicContext, buildCriticalTopicItemsContext } from "@/lib/context";
import { fechaCorta, ymd } from "@/lib/date";
import { sanitizeResumenes, type ResumenAsunto } from "@/lib/asuntos";
import type {
  CriticalTopic,
  CriticalTopicEntry,
  CriticalTopicItem,
  CriticalTopicItemSummary,
  CriticalTopicTaskProposal,
  TaskPriority,
} from "@/lib/types";
import { AsuntosCard, MovimientoReciente } from "./Asuntos";
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
  initialItems,
  initialSummaries,
  initialTaskProposals,
  profile,
}: {
  initialTopics: CriticalTopic[];
  initialItems: CriticalTopicItem[];
  initialSummaries: CriticalTopicItemSummary[];
  initialTaskProposals: CriticalTopicTaskProposal[];
  profile: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [topics, setTopics] = useState<CriticalTopic[]>(initialTopics);
  const [selectedId, setSelectedId] = useState<string | null>(initialTopics[0]?.id ?? null);
  const [newTitle, setNewTitle] = useState("");

  const [items, setItems] = useState<CriticalTopicItem[]>(initialItems);
  const [summaries, setSummaries] = useState<CriticalTopicItemSummary[]>(initialSummaries);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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

  // ---------- asuntos ----------
  const topicItems = items.filter((i) => i.topic_id === selectedId);
  const [summarizing, setSummarizing] = useState(false);
  const [itemsMsg, setItemsMsg] = useState<string | null>(null);

  function selectTopic(id: string) {
    setSelectedId(id);
    setExpandedItemId(null);
    setItemsMsg(null);
  }

  function abrirAsunto(item: CriticalTopicItem) {
    if (item.topic_id !== selectedId) selectTopic(item.topic_id);
    setExpandedItemId(item.id);
    setTimeout(() => {
      document.getElementById(`asunto-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  async function guardarResumen(item: CriticalTopicItem, r: ResumenAsunto, sourceEntryId: string | null) {
    const ahora = new Date().toISOString();
    const { data, error } = await supabase
      .from("critical_topic_items")
      .update({ resumen: r.resumen, resumen_updated_at: ahora, updated_at: ahora })
      .eq("id", item.id)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "update failed");
    setItems((prev) => prev.map((x) => (x.id === item.id ? (data as CriticalTopicItem) : x)));
    const { data: reg } = await supabase
      .from("critical_topic_item_summaries")
      .insert({ item_id: item.id, resumen: r.resumen, cambio: r.cambio, source_entry_id: sourceEntryId })
      .select()
      .single();
    if (reg) setSummaries((prev) => [...prev, reg as CriticalTopicItemSummary]);
  }

  // material: la nota nueva (solo toca los asuntos que menciona) o el historial
  // completo del tema. Resume sin evaluar nada; cada resumen queda en el registro.
  async function resumirAsuntos(
    t: CriticalTopic,
    material: string,
    sourceEntryId: string | null,
    completo: boolean,
    soloItem?: CriticalTopicItem,
  ) {
    const tItems = items.filter((i) => i.topic_id === t.id);
    if (!tItems.length) return;
    setSummarizing(true);
    setItemsMsg(null);
    try {
      const asuntos = buildCriticalTopicItemsContext(tItems, true);
      const foco = soloItem ? `\n\nResume SOLO el asunto «${soloItem.name}» (id=${soloItem.id}).` : "";
      const user = completo
        ? `${asuntos}${foco}\n\nResume los asuntos usando el historial del tema:\n\n${material}`
        : `Tema: ${t.title}\n\n${asuntos}\n\n--- NOTA O MATERIAL NUEVO ---\n${material}`;
      const raw = await askClaude(criticalTopicItemsSystemPrompt(ymd(new Date())), user, 3000, "low");
      let validos = sanitizeResumenes(JSON.parse(raw.replace(/```json|```/g, "").trim()), tItems);
      if (soloItem) validos = validos.filter((v) => v.item_id === soloItem.id);
      if (!validos.length) {
        if (completo) setItemsMsg("No encontré información suficiente en el historial para resumir.");
      } else {
        for (const v of validos) {
          const item = tItems.find((x) => x.id === v.item_id);
          if (item) await guardarResumen(item, v, sourceEntryId);
        }
      }
    } catch {
      setItemsMsg("No se pudo resumir los asuntos. ¿Corriste la migración 0012? Si ya la corriste, intentá de nuevo.");
    }
    setSummarizing(false);
  }

  async function guardarFicha(item: CriticalTopicItem, ficha: string) {
    const { data, error } = await supabase
      .from("critical_topic_items")
      .update({ ficha: ficha || null })
      .eq("id", item.id)
      .select()
      .single();
    if (error || !data) {
      setItemsMsg("No se pudo guardar la ficha. ¿Corriste la migración 0012?");
      throw new Error("ficha");
    }
    setItems((prev) => prev.map((x) => (x.id === item.id ? (data as CriticalTopicItem) : x)));
  }

  // Una corrección se anota en la ficha, que Claude lee como verdad base.
  async function anotarCorreccion(item: CriticalTopicItem, texto: string) {
    const nota = `Corrección (${fechaCorta(ymd(new Date()))}): ${texto}`;
    await guardarFicha(item, item.ficha ? `${item.ficha}\n${nota}` : nota);
  }

  async function crearAsunto(name: string) {
    if (!selectedId) return;
    const maxOrder = topicItems.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { data } = await supabase
      .from("critical_topic_items")
      .insert({ topic_id: selectedId, name, sort_order: maxOrder + 1 })
      .select()
      .single();
    if (data) setItems((prev) => [...prev, data as CriticalTopicItem]);
    else setItemsMsg("No se pudo crear el asunto.");
  }

  async function eliminarAsunto(item: CriticalTopicItem) {
    const { error } = await supabase.from("critical_topic_items").delete().eq("id", item.id);
    if (error) {
      setItemsMsg("No se pudo eliminar el asunto.");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setSummaries((prev) => prev.filter((s) => s.item_id !== item.id));
    setExpandedItemId(null);
  }

  // ---------- composer ----------
  const [noteText, setNoteText] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);

  async function actualizarLectura(t: CriticalTopic, allEntries: CriticalTopicEntry[]) {
    if (!allEntries.length) return;
    setStatusLoading(true);
    try {
      const tItems = items.filter((i) => i.topic_id === t.id);
      const user = buildCriticalTopicContext(t.title, allEntries, tItems, t.status_summary) + appendProfile("", profile);
      const raw = await askClaude(criticalTopicStatusSystemPrompt(), user, 1400);
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

  async function agregar() {
    if (!topic) return;
    const text = noteText.trim();
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!text && !file) return;
    setComposing(true);
    setComposeError(null);
    setTasksAddedMsg(null);
    try {
      let contentText: string;
      let kind: "note" | "material" = "note";
      let fileName: string | null = null;
      if (file) {
        kind = "material";
        fileName = file.name;
        if (isTextFile(file)) {
          const raw = await file.text();
          contentText = text ? `${text}\n\n${raw}` : raw;
        } else {
          const { base64, mediaType } = await prepareFileForClaude(file);
          const extracted = await askClaudeWithFile(
            criticalTopicFileExtractionSystemPrompt(),
            base64,
            mediaType,
            text || "Extrae y transcribe el contenido relevante de este archivo.",
            2000,
          );
          contentText = text ? `${text}\n\n[Extraído de ${file.name}]\n${extracted.trim()}` : extracted.trim();
        }
      } else {
        contentText = text;
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
      setFileLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      void actualizarLectura(topic, allEntries);
      void resumirAsuntos(topic, contentText, newEntry?.id ?? null, false);
    } catch {
      setComposeError("No se pudo agregar. Intenta nuevamente, o revisa que el archivo no sea demasiado pesado.");
    }
    setComposing(false);
  }

  const notesCount = entries.filter((e) => e.kind === "note").length;
  const materialCount = entries.filter((e) => e.kind === "material").length;

  return (
    <>
      <h1 className="page-title">CNX Tracker</h1>
      <div className="page-sub">
        Los temas estratégicos de Conexión Energía que seguís de cerca. Mandale notas o material y te resume cada
        asunto y cómo va avanzando, sin evaluar nada por vos.
      </div>

      <MovimientoReciente
        topics={topics}
        items={items}
        summaries={summaries}
        colorOf={(id) => topicColor(topics, id)}
        onOpen={abrirAsunto}
      />

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
              onClick={() => selectTopic(t.id)}
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
          <AsuntosCard
            color={color}
            items={topicItems}
            summaries={summaries}
            expandedId={expandedItemId}
            canSummarize={entries.length > 0}
            summarizing={summarizing}
            message={itemsMsg}
            onToggle={(id) => setExpandedItemId((prev) => (prev === id ? null : id))}
            onSummarizeAll={() =>
              void resumirAsuntos(topic, buildCriticalTopicContext(topic.title, entries, [], topic.status_summary), null, true)
            }
            onSummarizeOne={(it) =>
              void resumirAsuntos(topic, buildCriticalTopicContext(topic.title, entries, [], topic.status_summary), null, true, it)
            }
            onSaveFicha={guardarFicha}
            onCorrect={anotarCorreccion}
            onDelete={(it) => void eliminarAsunto(it)}
            onCreate={(name) => void crearAsunto(name)}
          />

          <LecturaEstado
            text={topic.status_summary}
            color={color}
            updatedAt={topic.status_updated_at}
            canRefresh={entries.length > 0}
            loading={statusLoading}
            onRefresh={() => void actualizarLectura(topic, entries)}
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
                `${topic.status_summary ? `LECTURA DE ESTADO ACTUAL:\n${topic.status_summary}\n\n` : ""}${buildCriticalTopicContext(topic.title, entries, topicItems)}`,
                null,
              )
            }
            onAdd={agregarTareaALaMesa}
            onDismiss={(p) => void descartarTarea(p)}
          />

          <div className="topic-card compact">
            <h2>Agregar nota o material</h2>
            <textarea
              placeholder="Pegá una nota o el cuerpo de un correo, o adjuntá un PDF, foto (incluye HEIC del iPad) o texto…"
              value={noteText}
              rows={3}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="row" style={{ marginTop: 8, alignItems: "center" }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt,.md,image/*,.heic,.heif"
                style={{ display: "none" }}
                onChange={(e) => setFileLabel(e.target.files?.[0]?.name ?? "")}
              />
              <button className="ghost btn-icon btn-sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={14} aria-hidden="true" />
                Adjuntar
              </button>
              {fileLabel && <span className="pdf-status" style={{ marginTop: 0 }}>{fileLabel}</span>}
              <button className="btn-sm" onClick={() => void agregar()} disabled={composing} style={{ marginLeft: "auto" }}>
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
