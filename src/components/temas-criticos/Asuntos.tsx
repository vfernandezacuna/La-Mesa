"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Sparkles } from "lucide-react";
import { fechaCorta } from "@/lib/date";
import type { CriticalTopic, CriticalTopicItem, CriticalTopicItemSummary } from "@/lib/types";

export function bySortOrder(a: CriticalTopicItem, b: CriticalTopicItem): number {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
}

function primeraFrase(texto: string): string {
  const m = texto.match(/^.*?[.!?](?:\s|$)/);
  const frase = (m ? m[0] : texto).trim();
  return frase.length > 150 ? `${frase.slice(0, 147)}…` : frase;
}

// ---------- Qué se movió (resumen de todos los temas) ----------

export function MovimientoReciente({
  topics,
  items,
  summaries,
  colorOf,
  onOpen,
}: {
  topics: CriticalTopic[];
  items: CriticalTopicItem[];
  summaries: CriticalTopicItemSummary[];
  colorOf: (topicId: string) => string;
  onOpen: (item: CriticalTopicItem) => void;
}) {
  const [verTodo, setVerTodo] = useState(false);
  const porItem = new Map(items.map((i) => [i.id, i]));
  const topicTitle = new Map(topics.map((t) => [t.id, t.title]));
  const movimientos = [...summaries]
    .filter((s) => s.cambio && porItem.has(s.item_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!movimientos.length) return null;
  const visibles = verTodo ? movimientos.slice(0, 20) : movimientos.slice(0, 5);

  return (
    <div className="topic-card compact">
      <div className="hm-head" style={{ marginBottom: 8 }}>
        <div>
          <h2>Qué se movió</h2>
          <div className="hm-sub">Lo último que cambió en cada asunto, según lo que has cargado.</div>
        </div>
      </div>
      {visibles.map((m) => {
        const item = porItem.get(m.item_id)!;
        return (
          <button className="mov-row" key={m.id} onClick={() => onOpen(item)}>
            <span className="mov-dot" style={{ background: colorOf(item.topic_id) }} aria-hidden="true" />
            <span className="mov-body">
              <span className="mov-head">
                <b>{item.name}</b>
                <span className="mov-meta">
                  {topicTitle.get(item.topic_id) ?? ""} · {fechaCorta(m.created_at)}
                </span>
              </span>
              <span className="mov-text">{m.cambio}</span>
            </span>
          </button>
        );
      })}
      {movimientos.length > 5 && (
        <button className="text-action" onClick={() => setVerTodo((v) => !v)} style={{ paddingLeft: 0 }}>
          {verTodo ? "Ver menos" : "Ver más movimientos"}
        </button>
      )}
    </div>
  );
}

// ---------- Un asunto ----------

function AsuntoRow({
  item,
  summaries,
  expanded,
  busy,
  onToggle,
  onSaveFicha,
  onCorrect,
  onSummarize,
  onDelete,
}: {
  item: CriticalTopicItem;
  summaries: CriticalTopicItemSummary[];
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onSaveFicha: (ficha: string) => Promise<void>;
  onCorrect: (texto: string) => Promise<void>;
  onSummarize: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ficha, setFicha] = useState(item.ficha ?? "");
  const [saving, setSaving] = useState(false);
  const [correccion, setCorreccion] = useState("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const orden = [...summaries].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ultimo = orden[0] ?? null;
  const anteriores = orden.slice(1);
  const Chev = expanded ? ChevronUp : ChevronDown;

  async function guardarFicha() {
    setSaving(true);
    try {
      await onSaveFicha(ficha.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function enviarCorreccion() {
    const t = correccion.trim();
    if (!t) return;
    setCorrigiendo(true);
    try {
      await onCorrect(t);
      setCorreccion("");
    } finally {
      setCorrigiendo(false);
    }
  }

  return (
    <div className="asunto" id={`asunto-${item.id}`}>
      <button className="asunto-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="asunto-main">
          <span className="asunto-name">
            {item.name}
            {item.descripcion && <span className="asunto-desc"> · {item.descripcion}</span>}
          </span>
          <span className="asunto-estado">
            {item.resumen ? primeraFrase(item.resumen) : "Sin resumen todavía."}
          </span>
        </span>
        {item.resumen_updated_at && <span className="asunto-fecha">{fechaCorta(item.resumen_updated_at)}</span>}
        <span className="asunto-chev">
          <Chev size={17} aria-hidden="true" />
        </span>
      </button>

      {expanded && (
        <div className="asunto-body">
          <div className="as-sec">
            <div className="as-lbl">Resumen</div>
            {item.resumen ? (
              <p className="as-texto">{item.resumen}</p>
            ) : (
              <div className="empty-note">Aún no hay resumen. Se arma al cargar una nota o con «Resumir este asunto».</div>
            )}
            {ultimo?.cambio && (
              <div className="as-cambio">
                <span className="as-cambio-lbl">Qué cambió</span> {ultimo.cambio}
              </div>
            )}
          </div>

          <div className="as-sec">
            <div className="as-lbl">
              Ficha del asunto
              {!editing && (
                <button
                  className="text-action as-edit"
                  onClick={() => {
                    setFicha(item.ficha ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil size={12} aria-hidden="true" /> Editar
                </button>
              )}
            </div>
            {editing ? (
              <>
                <textarea
                  rows={4}
                  value={ficha}
                  onChange={(e) => setFicha(e.target.value)}
                  placeholder="Qué es este asunto, qué NO es, y cómo se distingue de los otros. Claude la usa como verdad base."
                />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn-sm" onClick={() => void guardarFicha()} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar ficha"}
                  </button>
                  <button
                    className="ghost btn-sm"
                    onClick={() => {
                      setFicha(item.ficha ?? "");
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : item.ficha ? (
              <p className="as-texto ficha">{item.ficha}</p>
            ) : (
              <div className="empty-note">
                Sin ficha. Escribí en 2 o 3 líneas qué es este asunto y qué no es: ayuda a que Claude no lo confunda con
                otro.
              </div>
            )}
          </div>

          <div className="as-sec">
            <div className="as-lbl">¿Algo mal en el resumen?</div>
            <div className="row">
              <input
                type="text"
                style={{ flex: 1, minWidth: 200 }}
                value={correccion}
                placeholder="Corregilo en una línea — queda anotado en la ficha"
                onChange={(e) => setCorreccion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void enviarCorreccion();
                }}
              />
              <button className="ghost btn-sm" onClick={() => void enviarCorreccion()} disabled={corrigiendo || !correccion.trim()}>
                {corrigiendo ? "Anotando…" : "Anotar corrección"}
              </button>
            </div>
          </div>

          {anteriores.length > 0 && (
            <details className="historial">
              <summary>Cómo ha avanzado ({orden.length} registros)</summary>
              {orden.map((s) => (
                <details className="historial-item" key={s.id}>
                  <summary>
                    {fechaCorta(s.created_at)}
                    {s.cambio ? ` · ${primeraFrase(s.cambio)}` : ""}
                  </summary>
                  <div className="historial-body">
                    <p className="as-texto">{s.resumen}</p>
                  </div>
                </details>
              ))}
            </details>
          )}

          <div className="as-actions">
            <button className="ghost btn-icon btn-sm" onClick={onSummarize} disabled={busy}>
              <Sparkles size={14} aria-hidden="true" />
              Resumir este asunto
            </button>
            {confirmDelete ? (
              <span className="as-confirm">
                ¿Eliminar este asunto y su historial?
                <button className="text-action" onClick={onDelete}>
                  Sí, eliminar
                </button>
                <button className="text-action" onClick={() => setConfirmDelete(false)}>
                  No
                </button>
              </span>
            ) : (
              <button className="text-action" onClick={() => setConfirmDelete(true)}>
                Eliminar asunto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Tarjeta de asuntos del tema ----------

export function AsuntosCard({
  color,
  items,
  summaries,
  expandedId,
  canSummarize,
  summarizing,
  message,
  onToggle,
  onSummarizeAll,
  onSummarizeOne,
  onSaveFicha,
  onCorrect,
  onDelete,
  onCreate,
}: {
  color: string;
  items: CriticalTopicItem[];
  summaries: CriticalTopicItemSummary[];
  expandedId: string | null;
  canSummarize: boolean;
  summarizing: boolean;
  message: string | null;
  onToggle: (id: string) => void;
  onSummarizeAll: () => void;
  onSummarizeOne: (item: CriticalTopicItem) => void;
  onSaveFicha: (item: CriticalTopicItem, ficha: string) => Promise<void>;
  onCorrect: (item: CriticalTopicItem, texto: string) => Promise<void>;
  onDelete: (item: CriticalTopicItem) => void;
  onCreate: (name: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const sorted = [...items].sort(bySortOrder);

  function crear() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
  }

  return (
    <div className="topic-card" id="asuntos-card" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="hm-head" style={{ marginBottom: 14 }}>
        <div>
          <h2>Asuntos</h2>
          <div className="hm-sub">Qué dice lo que has cargado de cada asunto, y cómo ha ido avanzando.</div>
        </div>
        {items.length > 0 && (
          <button className="ghost btn-icon" onClick={onSummarizeAll} disabled={!canSummarize || summarizing}>
            <Sparkles size={14} aria-hidden="true" />
            Resumir asuntos
          </button>
        )}
      </div>

      {summarizing && (
        <div className="ai-loading" style={{ display: "block", marginBottom: 14 }}>
          <div className="ail-head">
            <span className="ail-spin"></span>
            <span>
              Resumiendo los asuntos<span className="ail-dots"></span>
            </span>
          </div>
          <div className="ail-sub">Leyendo el material con la ficha de cada asunto.</div>
        </div>
      )}
      {message && <div className="empty-note" style={{ marginBottom: 12 }}>{message}</div>}

      {sorted.length === 0 ? (
        <div className="empty-note">Este tema todavía no tiene asuntos. Agregá el primero abajo.</div>
      ) : (
        sorted.map((it) => (
          <AsuntoRow
            key={it.id}
            item={it}
            summaries={summaries.filter((s) => s.item_id === it.id)}
            expanded={expandedId === it.id}
            busy={summarizing || !canSummarize}
            onToggle={() => onToggle(it.id)}
            onSaveFicha={(ficha) => onSaveFicha(it, ficha)}
            onCorrect={(texto) => onCorrect(it, texto)}
            onSummarize={() => onSummarizeOne(it)}
            onDelete={() => onDelete(it)}
          />
        ))
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <input
          type="text"
          placeholder="Nuevo asunto — ej: Contrato KPC"
          style={{ flex: 1, minWidth: 200 }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") crear();
          }}
        />
        <button className="ghost" onClick={crear}>
          + Agregar asunto
        </button>
      </div>
    </div>
  );
}
