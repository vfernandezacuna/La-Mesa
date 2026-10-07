import type { CriticalTopicItem } from "./types";

export interface ResumenAsunto {
  item_id: string;
  resumen: string;
  cambio: string | null;
}

function limpio(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

// Lo que devuelve la IA se valida antes de guardarlo: solo ids de asuntos del
// tema, un resumen por asunto y con texto.
export function sanitizeResumenes(raw: unknown, items: CriticalTopicItem[]): ResumenAsunto[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(items.map((i) => i.id));
  const vistos = new Set<string>();
  const out: ResumenAsunto[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r.item_id !== "string" || !ids.has(r.item_id) || vistos.has(r.item_id)) continue;
    const resumen = limpio(r.resumen, 1200);
    if (!resumen) continue;
    vistos.add(r.item_id);
    out.push({ item_id: r.item_id, resumen, cambio: limpio(r.cambio, 500) });
  }
  return out;
}
