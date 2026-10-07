import type { CriticalTopicEntry, PmoCritico, PmoHito, PmoKpi, PmoReport } from "./types";

function txt(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function fechaIso(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// Lo que devuelve la IA se valida antes de guardarlo: listas acotadas, textos
// con largo máximo y nada que no tenga la forma esperada.
export function sanitizePmoReport(raw: unknown): PmoReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const kpis: PmoKpi[] = [];
  for (const k of Array.isArray(r.kpis) ? (r.kpis as Record<string, unknown>[]) : []) {
    const nombre = txt(k?.nombre, 80);
    const valor = txt(k?.valor, 60);
    if (!nombre || !valor) continue;
    const n = typeof k.numero === "number" && Number.isFinite(k.numero) ? k.numero : null;
    kpis.push({ grupo: txt(k.grupo, 60) ?? "General", nombre, valor, numero: n, unidad: txt(k.unidad, 20) });
    if (kpis.length >= 14) break;
  }

  const highlights = (Array.isArray(r.highlights) ? r.highlights : [])
    .map((h) => txt(h, 220))
    .filter((h): h is string => !!h)
    .slice(0, 5);

  const criticos: PmoCritico[] = [];
  for (const c of Array.isArray(r.criticos) ? (r.criticos as Record<string, unknown>[]) : []) {
    const texto = txt(typeof c === "string" ? c : c?.texto, 240);
    if (texto) criticos.push({ texto, origen: typeof c === "string" ? null : txt(c.origen, 60) });
    if (criticos.length >= 5) break;
  }

  const hitos: PmoHito[] = [];
  for (const h of Array.isArray(r.hitos) ? (r.hitos as Record<string, unknown>[]) : []) {
    const texto = txt(h?.texto, 200);
    if (texto) hitos.push({ texto, fecha: fechaIso(h.fecha), responsable: txt(h.responsable, 60) });
    if (hitos.length >= 6) break;
  }

  if (!kpis.length && !highlights.length && !criticos.length && !hitos.length) return null;
  return { fecha_reporte: fechaIso(r.fecha_reporte), titular: txt(r.titular, 200), kpis, highlights, criticos, hitos };
}

// Texto legible del reporte: es lo que queda en el historial del tema y lo que
// leen después la lectura de estado y los demás análisis.
export function formatPmoReport(r: PmoReport): string {
  const partes: string[] = [];
  partes.push(`REPORTE PMO${r.fecha_reporte ? ` del ${r.fecha_reporte}` : ""}${r.titular ? ` — ${r.titular}` : ""}`);
  if (r.kpis.length) {
    partes.push("CIFRAS CLAVE:\n" + r.kpis.map((k) => `- ${k.grupo} · ${k.nombre}: ${k.valor}`).join("\n"));
  }
  if (r.highlights.length) partes.push("HIGHLIGHTS:\n" + r.highlights.map((h) => `- ${h}`).join("\n"));
  if (r.criticos.length) {
    partes.push(
      "CRÍTICO SEGÚN EL REPORTE:\n" +
        r.criticos.map((c) => `- ${c.texto}${c.origen ? ` (${c.origen})` : ""}`).join("\n"),
    );
  }
  if (r.hitos.length) {
    partes.push(
      "HITOS:\n" +
        r.hitos
          .map((h) => `- ${h.fecha ? `${h.fecha}: ` : ""}${h.texto}${h.responsable ? ` (${h.responsable})` : ""}`)
          .join("\n"),
    );
  }
  return partes.join("\n\n");
}

const clave = (k: PmoKpi) => `${k.grupo}|${k.nombre}`.toLowerCase().replace(/\s+/g, " ").trim();

export interface KpiComparado {
  kpi: PmoKpi;
  /** Diferencia numérica contra el reporte anterior; null si no se puede comparar. */
  delta: number | null;
  /** Valor anterior tal como venía, si el indicador existía. */
  anterior: string | null;
  sinVariacion: boolean;
}

// La comparación semana a semana la hace el código con las cifras guardadas,
// no la IA: así los deltas nunca son una opinión.
export function compararKpis(actual: PmoReport, previo: PmoReport | null): KpiComparado[] {
  const anteriores = new Map((previo?.kpis ?? []).map((k) => [clave(k), k]));
  return actual.kpis.map((kpi) => {
    const ant = anteriores.get(clave(kpi));
    if (!ant) return { kpi, delta: null, anterior: null, sinVariacion: false };
    const delta = kpi.numero != null && ant.numero != null ? kpi.numero - ant.numero : null;
    const sinVariacion = delta != null ? delta === 0 : kpi.valor === ant.valor;
    return { kpi, delta, anterior: ant.valor, sinVariacion };
  });
}

/** Entradas con reporte estructurado, de la más reciente a la más antigua. */
export function reportesPmo(entries: CriticalTopicEntry[]): { entry: CriticalTopicEntry; report: PmoReport }[] {
  return [...entries]
    .filter((e) => e.report)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((e) => ({ entry: e, report: e.report as PmoReport }));
}

export function formatDelta(delta: number, unidad: string | null): string {
  const n = Math.abs(delta) < 1 && delta !== 0 ? delta.toFixed(2) : String(Math.round(delta * 100) / 100);
  return `${delta > 0 ? "+" : ""}${n}${unidad === "%" ? " pp" : unidad ? ` ${unidad}` : ""}`;
}
