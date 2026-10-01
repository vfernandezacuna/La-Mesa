import type { CriticalTopicItem, Criticidad, Tendencia } from "./types";

export interface ItemPatch {
  criticidad: Criticidad;
  avance: number;
  tendencia: Tendencia;
  estado: string | null;
  proximo_hito: string | null;
  proximo_hito_fecha: string | null;
}

export interface ItemProposal extends ItemPatch {
  item_id: string;
  motivo: string | null;
}

function cleanText(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// Lo que devuelve la IA se valida antes de mostrarlo: solo ids de asuntos
// del tema, criticidad 1-4, avance 0-100, y un cambio por asunto.
export function sanitizeProposals(raw: unknown, items: CriticalTopicItem[]): ItemProposal[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const out: ItemProposal[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r.item_id !== "string" || !ids.has(r.item_id) || seen.has(r.item_id)) continue;
    const c = Math.round(Number(r.criticidad));
    if (!(c >= 1 && c <= 4)) continue;
    seen.add(r.item_id);
    const fecha = r.proximo_hito_fecha;
    out.push({
      item_id: r.item_id,
      criticidad: c as Criticidad,
      avance: Math.max(0, Math.min(100, Math.round(Number(r.avance) || 0))),
      tendencia: r.tendencia === "mejora" || r.tendencia === "empeora" ? r.tendencia : "estable",
      estado: cleanText(r.estado, 140),
      proximo_hito: cleanText(r.proximo_hito, 100),
      proximo_hito_fecha: typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
      motivo: cleanText(r.motivo, 220),
    });
  }
  return out;
}

// Escala de estado fija (bueno → crítico), siempre acompañada de ícono y
// etiqueta: el color nunca carga el significado solo.
export const CRITICIDAD: Record<Criticidad, { label: string; plural: string; color: string; tint: number }> = {
  1: { label: "Baja", plural: "bajas", color: "#0ca30c", tint: 11 },
  2: { label: "Media", plural: "medias", color: "#fab219", tint: 17 },
  3: { label: "Alta", plural: "altas", color: "#ec835a", tint: 20 },
  4: { label: "Crítica", plural: "críticas", color: "#d03b3b", tint: 20 },
};

export const CRITICIDAD_DESC: Criticidad[] = [4, 3, 2, 1];

export const TENDENCIA_LABEL: Record<Tendencia, string> = {
  mejora: "Mejora",
  estable: "Estable",
  empeora: "Empeora",
};

export function criticidadTint(c: Criticidad | null): string {
  if (!c) return "var(--paper)";
  return `color-mix(in srgb, ${CRITICIDAD[c].color} ${CRITICIDAD[c].tint}%, var(--paper))`;
}
