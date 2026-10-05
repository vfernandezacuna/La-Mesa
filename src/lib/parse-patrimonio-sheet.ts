import { parseCLNumber } from "./parse-cartera-sheet";
import type { PatrimonioClassCode } from "./types";

// Lee la hoja "Balance" de Patrimonio Familiar: bloques por año lado a lado
// ("AÑO 2023" + columnas "1Q 2023".."4Q 2023"). Cada bloque tiene sus propias
// filas (no están alineadas entre años), así que los subtotales se buscan por
// nombre dentro de la columna de etiquetas de cada bloque. Las filas bajo cada
// subtotal, hasta la siguiente fila conocida, son su detalle.

export interface ParsedPatrimonioQuarter {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  year: number;
  totals: Partial<Record<PatrimonioClassCode, number>>;
  lineItems: { class_code: PatrimonioClassCode; label: string; amount: number }[];
  // Activos/Pasivos TOTALES según la planilla, para verificar la suma.
  activosHoja: number;
  pasivosHoja: number;
}

const SUBTOTALES: [string, PatrimonioClassCode][] = [
  ["Activos Corrientes", "corrientes"],
  ["Activo No Corriente Retiro", "retiro"],
  ["Activo No Corriente Inversión", "inversion"],
  ["Activo No Corriente Inmueble", "inmueble"],
  ["Activo No Corriente Mueble", "mueble"],
  ["Pasivos Corrientes", "corrientes_p"],
  ["Pasivos No Corrientes", "nocorrientes_p"],
];

// Filas que cortan el detalle de un subtotal.
const CORTES = [
  ...SUBTOTALES.map(([l]) => l),
  "Activos TOTALES",
  "Activos No Corrientes",
  "Pasivos TOTALES",
  "PATRIMONIO NETO",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

const CORTES_NORM = new Set(CORTES.map(norm));

function cell(rows: string[][], r: number, c: number): string {
  return (rows[r]?.[c] ?? "").trim();
}

export function parsePatrimonioSheet(rows: string[][]): ParsedPatrimonioQuarter[] {
  const out: ParsedPatrimonioQuarter[] = [];

  for (let hr = 0; hr < rows.length; hr++) {
    for (let c = 0; c < rows[hr].length; c++) {
      if (!/^ano \d{4}$/.test(norm(cell(rows, hr, c)))) continue;

      // Columnas de trimestre del bloque: "1Q 2023" .. "4Q 2023"
      const qCols: { col: number; quarter: ParsedPatrimonioQuarter["quarter"]; year: number }[] = [];
      for (let k = 1; k <= 4; k++) {
        const m = cell(rows, hr, c + k).match(/^([1-4])Q\s*(\d{4})$/i);
        if (m) qCols.push({ col: c + k, quarter: `Q${m[1]}` as ParsedPatrimonioQuarter["quarter"], year: Number(m[2]) });
      }
      if (!qCols.length) continue;

      // Ubicar cada fila del bloque por su etiqueta (primera aparición).
      const filaDe = new Map<string, number>();
      for (let r = hr + 1; r < rows.length; r++) {
        const k = norm(cell(rows, r, c));
        if (k && !filaDe.has(k)) filaDe.set(k, r);
      }
      const valor = (label: string, col: number) => {
        const r = filaDe.get(norm(label));
        return r === undefined ? 0 : parseCLNumber(cell(rows, r, col));
      };

      for (const { col, quarter, year } of qCols) {
        const totals: ParsedPatrimonioQuarter["totals"] = {};
        const lineItems: ParsedPatrimonioQuarter["lineItems"] = [];

        for (const [label, code] of SUBTOTALES) {
          const r0 = filaDe.get(norm(label));
          if (r0 === undefined) continue;
          const v = parseCLNumber(cell(rows, r0, col));
          if (v) totals[code] = Math.abs(v);
          for (let r = r0 + 1; r < rows.length; r++) {
            const lbl = cell(rows, r, c);
            if (!lbl || CORTES_NORM.has(norm(lbl))) break;
            if (lbl === "-") continue;
            const amount = parseCLNumber(cell(rows, r, col));
            if (amount) lineItems.push({ class_code: code, label: lbl, amount: Math.abs(amount) });
          }
        }

        const activos = (["corrientes", "retiro", "inversion", "inmueble", "mueble"] as const).reduce(
          (s, k) => s + (totals[k] ?? 0),
          0,
        );
        if (!activos) continue; // trimestre futuro, aún sin datos

        out.push({
          quarter,
          year,
          totals,
          lineItems,
          activosHoja: valor("Activos TOTALES", col),
          pasivosHoja: valor("Pasivos TOTALES", col),
        });
      }
    }
  }

  return out.sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter));
}
