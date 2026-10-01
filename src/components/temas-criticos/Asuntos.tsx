"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Flag,
  OctagonAlert,
  Pencil,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  CRITICIDAD,
  CRITICIDAD_DESC,
  TENDENCIA_LABEL,
  criticidadTint,
  type ItemPatch,
  type ItemProposal,
} from "@/lib/criticidad";
import { fechaCorta } from "@/lib/date";
import type {
  CriticalTopic,
  CriticalTopicItem,
  CriticalTopicItemSnapshot,
  Criticidad,
  Tendencia,
} from "@/lib/types";

const CRIT_ICON = { 1: CircleCheck, 2: CircleAlert, 3: TriangleAlert, 4: OctagonAlert } as const;
const TEND_ICON = { mejora: ArrowUpRight, estable: ArrowRight, empeora: ArrowDownRight } as const;
const TEND_COLOR: Record<Tendencia, string> = { mejora: "#20603A", estable: "var(--n700)", empeora: "#b02f2f" };

export function bySortOrder(a: CriticalTopicItem, b: CriticalTopicItem): number {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
}

function critColor(c: Criticidad | null): string {
  return c ? CRITICIDAD[c].color : "var(--hairline-strong)";
}

export function CritChip({ c }: { c: Criticidad | null }) {
  if (!c) {
    return (
      <span className="crit-chip muted">
        <CircleDashed size={13} aria-hidden="true" /> Sin evaluar
      </span>
    );
  }
  const Icon = CRIT_ICON[c];
  return (
    <span className="crit-chip">
      <Icon size={14} strokeWidth={2.4} color={CRITICIDAD[c].color} aria-hidden="true" /> {CRITICIDAD[c].label}
    </span>
  );
}

function TrendTag({ t, iconOnly = false }: { t: Tendencia | null; iconOnly?: boolean }) {
  if (!t) return null;
  const Icon = TEND_ICON[t];
  return (
    <span className="trend-tag" style={{ color: TEND_COLOR[t] }} aria-label={`Tendencia: ${TENDENCIA_LABEL[t]}`}>
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
      {!iconOnly && TENDENCIA_LABEL[t]}
    </span>
  );
}

function AvanceBar({ value }: { value: number | null }) {
  return (
    <span className="avance" aria-label={value == null ? "Avance sin evaluar" : `Avance ${value}%`}>
      <span className="avance-track">
        <span className="avance-fill" style={{ width: `${value ?? 0}%` }} />
      </span>
      <span className="avance-num">{value == null ? "—" : `${value}%`}</span>
    </span>
  );
}

function Legend() {
  return (
    <div className="hm-legend">
      {CRITICIDAD_DESC.map((c) => (
        <span className="hm-leg" key={c}>
          <span className="hm-swatch" style={{ background: criticidadTint(c), borderLeftColor: CRITICIDAD[c].color }} />
          {CRITICIDAD[c].label}
        </span>
      ))}
      <span className="hm-leg">
        <span className="hm-swatch" style={{ background: "var(--paper)", borderLeftColor: "var(--hairline-strong)" }} />
        Sin evaluar
      </span>
    </div>
  );
}

// ---------- Mapa de criticidad (todos los temas) ----------
export function CriticidadMap({
  topics,
  items,
  colorOf,
  onOpen,
}: {
  topics: CriticalTopic[];
  items: CriticalTopicItem[];
  colorOf: (topicId: string) => string;
  onOpen: (item: CriticalTopicItem) => void;
}) {
  const groups = topics
    .map((t) => ({ topic: t, items: items.filter((i) => i.topic_id === t.id).sort(bySortOrder) }))
    .filter((g) => g.items.length);
  if (!groups.length) return null;

  const visible = groups.flatMap((g) => g.items);
  const counts = CRITICIDAD_DESC.map((c) => ({ c, n: visible.filter((i) => i.criticidad === c).length })).filter(
    (x) => x.n,
  );
  const lastEval = visible
    .map((i) => i.updated_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  return (
    <div className="topic-card">
      <div className="hm-head">
        <div>
          <h2>Mapa de criticidad</h2>
          <div className="hm-sub">
            {visible.length} asuntos en {groups.length} temas
            {lastEval ? ` · última evaluación ${fechaCorta(lastEval)}` : ""}
          </div>
        </div>
        {counts.length > 0 && (
          <div className="hm-counts">
            {counts.map(({ c, n }) => (
              <span className="hm-count" key={c}>
                <CritChip c={c} />
                <b>{n}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {groups.map((g) => (
        <div className="hm-group" key={g.topic.id}>
          <div className="hm-group-title">
            <span className="topic-pill-dot" style={{ background: colorOf(g.topic.id) }} />
            {g.topic.title}
          </div>
          <div className="hm-grid">
            {g.items.map((it) => (
              <button
                key={it.id}
                className={`hm-tile ${it.estado ? "has-tip" : ""}`}
                style={{ background: criticidadTint(it.criticidad), borderLeftColor: critColor(it.criticidad) }}
                data-tip={it.estado ?? undefined}
                onClick={() => onOpen(it)}
              >
                <span className="hm-name">{it.name}</span>
                <span className="hm-meta">
                  <CritChip c={it.criticidad} />
                  <TrendTag t={it.tendencia} iconOnly />
                </span>
                <AvanceBar value={it.avance} />
              </button>
            ))}
          </div>
        </div>
      ))}

      <Legend />
    </div>
  );
}

// ---------- Gráficos de evolución de un asunto ----------
function HeatStrip({ snaps }: { snaps: CriticalTopicItemSnapshot[] }) {
  if (!snaps.length) return <div className="chart-empty">Se arma con cada actualización.</div>;
  const last = snaps.slice(-16);
  return (
    <>
      <div className="heat-strip">
        {last.map((s) => (
          <span
            key={s.id}
            className="heat-cell has-tip"
            style={{ background: CRITICIDAD[s.criticidad].color }}
            data-tip={`${fechaCorta(s.created_at)} · ${CRITICIDAD[s.criticidad].label} · avance ${s.avance}%`}
          />
        ))}
      </div>
      <div className="heat-axis">
        {last.length > 1 ? `${fechaCorta(last[0].created_at)} → ${fechaCorta(last[last.length - 1].created_at)}` : fechaCorta(last[0].created_at)}
      </div>
    </>
  );
}

function AvanceSpark({ snaps }: { snaps: CriticalTopicItemSnapshot[] }) {
  if (!snaps.length) return <div className="chart-empty">Sin datos aún.</div>;
  const pts = snaps.slice(-16);
  const W = 240;
  const H = 60;
  const P = 6;
  const x = (i: number) => (pts.length === 1 ? W / 2 : P + (i / (pts.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const line = pts.map((s, i) => `${x(i)},${y(s.avance)}`).join(" ");
  const area = `${x(0)},${H - P} ${line} ${x(pts.length - 1)},${H - P}`;
  const first = pts[0];
  const last = pts[pts.length - 1];
  return (
    <div className="spark-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="spark"
        role="img"
        aria-label={`Avance: de ${first.avance}% a ${last.avance}% en ${pts.length} actualizaciones`}
      >
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="spark-base" />
        {pts.length > 1 && <polygon points={area} className="spark-area" />}
        {pts.length > 1 && <polyline points={line} className="spark-line" />}
        {pts.map((s, i) => (
          <circle key={s.id} cx={x(i)} cy={y(s.avance)} r={i === pts.length - 1 ? 4.5 : 3} className="spark-dot">
            <title>{`${fechaCorta(s.created_at)}: ${s.avance}%`}</title>
          </circle>
        ))}
      </svg>
      <span className="spark-end">{last.avance}%</span>
    </div>
  );
}

// ---------- Editor manual ----------
function AsuntoEditor({
  item,
  onSave,
  onCancel,
  onDelete,
}: {
  item: CriticalTopicItem;
  onSave: (patch: ItemPatch) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [crit, setCrit] = useState<Criticidad>(item.criticidad ?? 2);
  const [avance, setAvance] = useState<number>(item.avance ?? 0);
  const [tend, setTend] = useState<Tendencia>(item.tendencia ?? "estable");
  const [estado, setEstado] = useState(item.estado ?? "");
  const [hito, setHito] = useState(item.proximo_hito ?? "");
  const [hitoFecha, setHitoFecha] = useState(item.proximo_hito_fecha ?? "");

  return (
    <div className="asunto-edit">
      <div>
        <div className="edit-lbl">Criticidad</div>
        <div className="seg-row">
          {([1, 2, 3, 4] as Criticidad[]).map((c) => (
            <button key={c} className={`seg ${crit === c ? "on" : ""}`} onClick={() => setCrit(c)}>
              <CritChip c={c} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="edit-lbl">Avance · {avance}%</div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={avance}
          onChange={(e) => setAvance(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 360 }}
        />
      </div>
      <div>
        <div className="edit-lbl">Tendencia</div>
        <div className="seg-row">
          {(["mejora", "estable", "empeora"] as Tendencia[]).map((t) => (
            <button key={t} className={`seg ${tend === t ? "on" : ""}`} onClick={() => setTend(t)}>
              <TrendTag t={t} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="edit-lbl">Estado en una línea</div>
        <input type="text" value={estado} maxLength={140} onChange={(e) => setEstado(e.target.value)} style={{ width: "100%" }} />
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="edit-lbl">Próximo hito</div>
          <input type="text" value={hito} maxLength={100} onChange={(e) => setHito(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <div className="edit-lbl">Fecha</div>
          <input type="date" value={hitoFecha} onChange={(e) => setHitoFecha(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        <button
          onClick={() =>
            onSave({
              criticidad: crit,
              avance,
              tendencia: tend,
              estado: estado.trim() || null,
              proximo_hito: hito.trim() || null,
              proximo_hito_fecha: hitoFecha || null,
            })
          }
        >
          Guardar
        </button>
        <button className="text-action" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="text-action"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            if (window.confirm(`¿Eliminar el asunto "${item.name}" y su historial?`)) onDelete();
          }}
        >
          Eliminar asunto
        </button>
      </div>
    </div>
  );
}

// ---------- Fila de un asunto ----------
function AsuntoRow({
  item,
  snaps,
  expanded,
  onToggle,
  onSave,
  onDelete,
}: {
  item: CriticalTopicItem;
  snaps: CriticalTopicItemSnapshot[];
  expanded: boolean;
  onToggle: () => void;
  onSave: (patch: ItemPatch) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="asunto" id={`asunto-${item.id}`} style={{ borderLeftColor: critColor(item.criticidad) }}>
      <button className="asunto-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="asunto-main">
          <span className="asunto-name">
            {item.name}
            {item.descripcion && <span className="asunto-desc"> · {item.descripcion}</span>}
          </span>
          {item.estado && <span className="asunto-estado">{item.estado}</span>}
        </span>
        <span className="asunto-side">
          <CritChip c={item.criticidad} />
          <TrendTag t={item.tendencia} />
          <AvanceBar value={item.avance} />
        </span>
        <span className="asunto-chev">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
      </button>
      {expanded && (
        <div className="asunto-body">
          {item.proximo_hito && (
            <div className="asunto-hito">
              <Flag size={14} aria-hidden="true" />
              <span>
                Próximo hito: {item.proximo_hito}
                {item.proximo_hito_fecha ? ` · ${fechaCorta(item.proximo_hito_fecha)}` : ""}
              </span>
            </div>
          )}
          <div className="asunto-charts">
            <div>
              <div className="chart-lbl">Criticidad en el tiempo</div>
              <HeatStrip snaps={snaps} />
            </div>
            <div>
              <div className="chart-lbl">Avance por actualización</div>
              <AvanceSpark snaps={snaps} />
            </div>
          </div>
          {editing ? (
            <AsuntoEditor
              item={item}
              onCancel={() => setEditing(false)}
              onDelete={onDelete}
              onSave={(patch) => {
                void onSave(patch).then(() => setEditing(false));
              }}
            />
          ) : (
            <button className="ghost btn-icon" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden="true" />
              Ajustar a mano
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Propuestas de Claude ----------
export function PropuestasBox({
  items,
  proposals,
  checked,
  applying,
  onToggle,
  onApply,
  onDiscard,
}: {
  items: CriticalTopicItem[];
  proposals: ItemProposal[];
  checked: boolean[];
  applying: boolean;
  onToggle: (i: number) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="prop-box">
      <div className="prop-head">
        <Sparkles size={14} aria-hidden="true" />
        Claude propone cambios en {proposals.length} asunto{proposals.length === 1 ? "" : "s"}
      </div>
      {proposals.map((p, i) => {
        const item = items.find((x) => x.id === p.item_id);
        if (!item) return null;
        return (
          <label className="prop-row" key={p.item_id}>
            <input type="checkbox" checked={checked[i] ?? false} onChange={() => onToggle(i)} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="prop-name">{item.name}</span>
              <span className="prop-change">
                <CritChip c={item.criticidad} />
                <ArrowRight size={13} aria-hidden="true" />
                <CritChip c={p.criticidad} />
                <span>
                  · avance {item.avance == null ? "—" : `${item.avance}%`} → {p.avance}%
                </span>
                <TrendTag t={p.tendencia} />
              </span>
              {p.estado && <span className="prop-estado">{p.estado}</span>}
              {p.motivo && <span className="prop-motivo">{p.motivo}</span>}
            </span>
          </label>
        );
      })}
      <div style={{ marginTop: 12 }}>
        <button onClick={onApply} disabled={applying || !checked.some(Boolean)}>
          {applying ? "Aplicando…" : "Aplicar seleccionados"}
        </button>{" "}
        <button className="text-action" onClick={onDiscard} disabled={applying}>
          Descartar
        </button>
      </div>
    </div>
  );
}

// ---------- Tarjeta de asuntos del tema seleccionado ----------
export function AsuntosCard({
  color,
  items,
  snapshots,
  expandedId,
  canEvaluate,
  evaluating,
  message,
  children,
  onToggle,
  onEvaluate,
  onSave,
  onDelete,
  onCreate,
}: {
  color: string;
  items: CriticalTopicItem[];
  snapshots: CriticalTopicItemSnapshot[];
  expandedId: string | null;
  canEvaluate: boolean;
  evaluating: boolean;
  message: string | null;
  children?: ReactNode;
  onToggle: (id: string) => void;
  onEvaluate: () => void;
  onSave: (item: CriticalTopicItem, patch: ItemPatch) => Promise<void>;
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
          <div className="hm-sub">Criticidad, avance y evolución de cada asunto del tema.</div>
        </div>
        {items.length > 0 && (
          <button className="ghost btn-icon" onClick={onEvaluate} disabled={!canEvaluate || evaluating}>
            <Sparkles size={14} aria-hidden="true" />
            Evaluar con Claude
          </button>
        )}
      </div>

      {evaluating && (
        <div className="ai-loading" style={{ display: "block", marginBottom: 14 }}>
          <div className="ail-head">
            <span className="ail-spin"></span>
            <span>
              Evaluando los asuntos<span className="ail-dots"></span>
            </span>
          </div>
          <div className="ail-sub">Cruzando el material con la evaluación actual de cada asunto.</div>
        </div>
      )}
      {children}
      {message && <div className="empty-note" style={{ marginBottom: 12 }}>{message}</div>}

      {sorted.length === 0 ? (
        <div className="empty-note">Este tema todavía no tiene asuntos. Agregá el primero abajo.</div>
      ) : (
        sorted.map((it) => (
          <AsuntoRow
            key={it.id}
            item={it}
            snaps={snapshots.filter((s) => s.item_id === it.id)}
            expanded={expandedId === it.id}
            onToggle={() => onToggle(it.id)}
            onSave={(patch) => onSave(it, patch)}
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
