"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude, askClaudeWithFile } from "@/lib/claude-client";
import {
  criticalTopicFileExtractionSystemPrompt,
  criticalTopicStatusSystemPrompt,
  criticalTopicTasksSystemPrompt,
} from "@/lib/prompts";
import { appendProfile, buildCriticalTopicContext } from "@/lib/context";
import { ymd } from "@/lib/date";
import type { CriticalTopic, CriticalTopicEntry, TaskPriority } from "@/lib/types";

interface ProposedTask {
  title: string;
  date: string | null;
  time: string | null;
  isDeadline: boolean;
  priority: TaskPriority;
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
  profile,
}: {
  initialTopics: CriticalTopic[];
  profile: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [topics, setTopics] = useState<CriticalTopic[]>(initialTopics);
  const [selectedId, setSelectedId] = useState<string | null>(initialTopics[0]?.id ?? null);
  const [newTitle, setNewTitle] = useState("");

  const [entries, setEntries] = useState<CriticalTopicEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const topic = topics.find((t) => t.id === selectedId) ?? null;

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
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, supabase]);

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
      const user = buildCriticalTopicContext(t.title, allEntries) + appendProfile("", profile);
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

  // ---------- tareas propuestas ----------
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[] | null>(null);
  const [proposedChecked, setProposedChecked] = useState<boolean[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksSavedMsg, setTasksSavedMsg] = useState<string | null>(null);

  async function proponerTareas(text: string) {
    setTasksLoading(true);
    setTasksSavedMsg(null);
    try {
      const today = ymd(new Date());
      const weekday = new Date().toLocaleDateString("es-CL", { weekday: "long" });
      const raw = await askClaude(criticalTopicTasksSystemPrompt(today, weekday), text, 1000);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as ProposedTask[];
      if (parsed.length) {
        setProposedTasks(parsed);
        setProposedChecked(parsed.map(() => true));
      } else {
        setProposedTasks(null);
      }
    } catch {
      // si falla la extracción, simplemente no se proponen tareas
    }
    setTasksLoading(false);
  }

  async function confirmarTareas() {
    if (!proposedTasks) return;
    const rows = proposedTasks
      .filter((_, i) => proposedChecked[i])
      .map((t) => ({
        title: t.title,
        category: "trabajo" as const,
        due_date: t.date,
        due_time: t.time,
        is_deadline: t.isDeadline,
        priority: t.priority,
        created_on: ymd(new Date()),
      }));
    if (rows.length) {
      await supabase.from("tasks").insert(rows);
      setTasksSavedMsg(
        `${rows.length} tarea${rows.length > 1 ? "s" : ""} agregada${rows.length > 1 ? "s" : ""} a Hoy.`,
      );
    }
    setProposedTasks(null);
  }

  async function agregar() {
    if (!topic) return;
    const text = noteText.trim();
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!text && !file) return;
    setComposing(true);
    setComposeError(null);
    setProposedTasks(null);
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
      void proponerTareas(contentText);
    } catch {
      setComposeError("No se pudo agregar. Intenta nuevamente, o revisa que el archivo no sea demasiado pesado.");
    }
    setComposing(false);
  }

  return (
    <>
      <h1 className="page-title">Temas críticos</h1>
      <div className="page-sub">
        Los temas de trabajo que estás siguiendo de cerca. Mandale notas o material y te mantiene la lectura de
        estado al día.
      </div>

      <div className="topic-pills">
        {topics.map((t) => (
          <button
            key={t.id}
            className={`topic-pill ${t.id === selectedId ? "active" : ""}`}
            onClick={() => setSelectedId(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="panel">
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
          <div className="panel">
            <h2>Lectura de estado</h2>
            <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
              Se actualiza sola cada vez que agregás algo nuevo abajo.
            </div>
            {!topic.status_summary ? (
              <div className="empty-note">Aún no hay una lectura — agregá una nota o material para generarla.</div>
            ) : (
              <div className="response-box">
                {topic.status_summary.split(/\n/).map((line, i) => {
                  const m = line.match(/^(SITUACIÓN ACTUAL:|RIESGOS Y PENDIENTES:|PRÓXIMOS PASOS:)(.*)$/);
                  if (m) {
                    return (
                      <div key={i}>
                        <strong
                          style={{
                            color: "var(--accent-deep)",
                            display: "block",
                            marginTop: 15,
                            marginBottom: 5,
                            letterSpacing: 1,
                            fontSize: "0.72rem",
                            textTransform: "uppercase",
                          }}
                        >
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
            {topic.status_updated_at && (
              <div style={{ fontSize: "0.72rem", color: "var(--n600)", marginTop: 10 }}>
                Actualizado el {new Date(topic.status_updated_at).toLocaleString("es-CL")}
              </div>
            )}
            {statusLoading && (
              <div className="ai-loading" style={{ display: "block" }}>
                <div className="ail-head">
                  <span className="ail-spin"></span>
                  <span>
                    Actualizando la lectura<span className="ail-dots"></span>
                  </span>
                </div>
                <div className="ail-sub">Releyendo todo el historial del tema.</div>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Agregar nota o material</h2>
            <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
              Pegá el texto de un correo o una nota, o adjuntá un archivo — PDF, foto (incluye HEIC del iPad) o
              texto plano.
            </div>
            <textarea
              placeholder="Pegá una nota, el cuerpo de un correo, o agregá contexto junto con el archivo…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt,.md,image/*,.heic,.heif"
                style={{ display: "none" }}
                onChange={(e) => setFileLabel(e.target.files?.[0]?.name ?? "")}
              />
              <button className="ghost" onClick={() => fileInputRef.current?.click()}>
                Adjuntar archivo
              </button>
              {fileLabel && <span className="pdf-status">{fileLabel}</span>}
              <button onClick={() => void agregar()} disabled={composing} style={{ marginLeft: "auto" }}>
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

          {(tasksLoading || proposedTasks) && (
            <div className="panel">
              <h2>Tareas propuestas</h2>
              {tasksLoading && (
                <div className="ai-loading" style={{ display: "block" }}>
                  <div className="ail-head">
                    <span className="ail-spin"></span>
                    <span>
                      Buscando pendientes accionables<span className="ail-dots"></span>
                    </span>
                  </div>
                </div>
              )}
              {proposedTasks && (
                <>
                  {proposedTasks.map((t, i) => (
                    <div className="mini-row" key={i} style={{ cursor: "pointer" }} onClick={() => setProposedChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}>
                      <input
                        type="checkbox"
                        checked={proposedChecked[i] ?? false}
                        onChange={() => setProposedChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                        style={{ marginRight: 10 }}
                      />
                      <span className="m-name">{t.title}</span>
                      {t.date && <span className="m-val">{t.date}</span>}
                    </div>
                  ))}
                  <div style={{ marginTop: 14 }}>
                    <button onClick={() => void confirmarTareas()}>Agregar tareas seleccionadas</button>{" "}
                    <button className="text-action" onClick={() => setProposedTasks(null)}>
                      Descartar
                    </button>
                  </div>
                </>
              )}
              {tasksSavedMsg && <div className="review-done" style={{ marginTop: 10 }}>{tasksSavedMsg}</div>}
            </div>
          )}

          <div className="panel">
            <h2>Historial del tema</h2>
            {entriesLoading ? (
              <span className="loading">Cargando…</span>
            ) : entries.length === 0 ? (
              <span className="loading">Sin registros aún.</span>
            ) : (
              [...entries].reverse().map((e) => (
                <div className="log-entry" key={e.id}>
                  <div className="meta">
                    {new Date(e.created_at).toLocaleString("es-CL")}
                    {e.kind === "material" ? ` · material${e.file_name ? ` (${e.file_name})` : ""}` : " · nota"}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{e.content_text}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
