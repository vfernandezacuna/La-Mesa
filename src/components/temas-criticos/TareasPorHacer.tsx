"use client";

import { useState } from "react";
import Link from "next/link";
import { ListChecks, Sparkles, X } from "lucide-react";
import { ymd } from "@/lib/date";
import type { CriticalTopicTaskProposal, TaskPriority } from "@/lib/types";

export interface TaskChoice {
  title: string;
  due_date: string | null;
  priority: TaskPriority;
}

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

const PRIORIDADES: TaskPriority[] = ["alta", "media", "baja"];

function PropuestaRow({
  p,
  onAdd,
  onDismiss,
}: {
  p: CriticalTopicTaskProposal;
  onAdd: (choice: TaskChoice) => Promise<void>;
  onDismiss: () => void;
}) {
  const hoy = plusDays(0);
  const manana = plusDays(1);
  const [title, setTitle] = useState(p.title);
  const [fecha, setFecha] = useState<string | null>(p.due_date ?? hoy);
  const [prio, setPrio] = useState<TaskPriority>(p.priority);
  const [saving, setSaving] = useState(false);
  const otraFecha = fecha !== null && fecha !== hoy && fecha !== manana;

  return (
    <div className="tp-row">
      <div className="tp-top">
        <textarea
          className="tp-title"
          value={title}
          rows={title.length > 44 ? 2 : 1}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          aria-label="Texto de la tarea"
        />
        <button className="tp-dismiss" onClick={onDismiss} title="Descartar propuesta" aria-label="Descartar propuesta">
          <X size={16} />
        </button>
      </div>
      <div className="tp-controls">
        <div className="seg-row">
          <button className={`seg ${fecha === hoy ? "on" : ""}`} onClick={() => setFecha(hoy)}>
            Hoy
          </button>
          <button className={`seg ${fecha === manana ? "on" : ""}`} onClick={() => setFecha(manana)}>
            Mañana
          </button>
          <input
            type="date"
            className={`tp-date ${otraFecha ? "on" : ""}`}
            value={otraFecha ? fecha : ""}
            onChange={(e) => setFecha(e.target.value || hoy)}
            aria-label="Otra fecha"
          />
          <button className={`seg ${fecha === null ? "on" : ""}`} onClick={() => setFecha(null)}>
            Sin fecha
          </button>
        </div>
        <select
          className="tp-prio"
          value={prio}
          onChange={(e) => setPrio(e.target.value as TaskPriority)}
          aria-label="Prioridad"
        >
          {PRIORIDADES.map((x) => (
            <option key={x} value={x}>
              Prioridad {x}
            </option>
          ))}
        </select>
        <button
          className="tp-add"
          disabled={saving || !title.trim()}
          onClick={() => {
            setSaving(true);
            void onAdd({ title: title.trim(), due_date: fecha, priority: prio }).finally(() => setSaving(false));
          }}
        >
          {saving ? "Agregando…" : "Agregar a La Mesa"}
        </button>
      </div>
    </div>
  );
}

export function TareasPorHacer({
  proposals,
  loading,
  canPropose,
  message,
  addedMsg,
  onPropose,
  onAdd,
  onDismiss,
}: {
  proposals: CriticalTopicTaskProposal[];
  loading: boolean;
  canPropose: boolean;
  message: string | null;
  addedMsg: string | null;
  onPropose: () => void;
  onAdd: (p: CriticalTopicTaskProposal, choice: TaskChoice) => Promise<void>;
  onDismiss: (p: CriticalTopicTaskProposal) => void;
}) {
  return (
    <div className="topic-card" id="tareas-card">
      <div className="hm-head" style={{ marginBottom: 14 }}>
        <div>
          <h2>Tareas por hacer</h2>
          <div className="hm-sub">Propuestas de Claude. Ajustalas y mandalas a La Mesa para hoy o el día que quieras.</div>
        </div>
        <button className="ghost btn-icon" onClick={onPropose} disabled={!canPropose || loading}>
          <Sparkles size={14} aria-hidden="true" />
          Proponer tareas
        </button>
      </div>

      {loading && (
        <div className="ai-loading" style={{ display: "block", marginBottom: 14 }}>
          <div className="ail-head">
            <span className="ail-spin"></span>
            <span>
              Buscando pendientes accionables<span className="ail-dots"></span>
            </span>
          </div>
        </div>
      )}
      {addedMsg && (
        <div className="tp-added">
          <ListChecks size={15} aria-hidden="true" />
          <span>{addedMsg}</span>
          <Link prefetch={false} href="/">Ver en Hoy</Link>
        </div>
      )}
      {message && <div className="empty-note" style={{ marginBottom: 10 }}>{message}</div>}

      {proposals.length === 0 && !loading ? (
        <div className="empty-note">
          No hay tareas pendientes de revisar. Se proponen solas al agregar una nota, o pedilas con &quot;Proponer
          tareas&quot;.
        </div>
      ) : (
        proposals.map((p) => (
          <PropuestaRow key={p.id} p={p} onAdd={(choice) => onAdd(p, choice)} onDismiss={() => onDismiss(p)} />
        ))
      )}
    </div>
  );
}
