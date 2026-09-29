// Parsea la pestaña "snapshot" de una cartera (mismo formato para Cartera
// Personal y para la pestaña "Actual" de Futalemu):
//   Capital / Caja / (Capital + Dividendos) Invertido / Valor Mercado
//   Portafolio / Rentabilidad Portafolio / Rentabilidad <año>
//   tabla Acción | Inversión | Valor Mercado | Upside/Downside
//   tabla Acción | Cantidad | Precio Compra | Precio Mercado

export interface ParsedCarteraPosition {
  ticker: string;
  invertido: number;
  valor_mercado: number;
  cantidad: number;
  precio_costo: number;
  precio_mercado: number;
}

export interface ParsedCarteraSnapshot {
  fecha: string;
  capital: number;
  caja: number;
  invertido: number;
  valor_mercado: number;
  rent_anio: number;
  rent_acum: number;
  positions: ParsedCarteraPosition[];
}

function cell(rows: string[][], r: number, c: number): string {
  return (rows[r]?.[c] ?? "").trim();
}

function parseCLNumber(raw: string): number {
  const s = raw.trim();
  if (!s || s === "-") return 0;
  const isPercent = s.endsWith("%");
  const cleaned = s.replace(/[$%\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : isPercent ? n / 100 : n;
}

function parseCLDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function findScalar(rows: string[][], label: string, exact = true): number | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const v = cell(rows, r, c);
      const matches = exact ? v === label : v.startsWith(label);
      if (!matches) continue;
      for (let c2 = c + 1; c2 < row.length; c2++) {
        const val = cell(rows, r, c2);
        if (val) return parseCLNumber(val);
      }
    }
  }
  return null;
}

function findRentAnio(rows: string[][]): number | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (/^Rentabilidad \d{4}$/.test(cell(rows, r, c))) {
        const val = cell(rows, r + 1, c);
        if (val) return parseCLNumber(val);
      }
    }
  }
  return null;
}

function findFecha(rows: string[][]): string | null {
  for (const row of rows) {
    for (const raw of row) {
      const d = parseCLDate(raw ?? "");
      if (d) return d;
    }
  }
  return null;
}

function findTableStart(rows: string[][], headers: string[]): { row: number; col: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const matches = headers.every((h, i) => cell(rows, r, c + i).toLowerCase() === h.toLowerCase());
      if (matches) return { row: r, col: c };
    }
  }
  return null;
}

export function parseCarteraSheet(rows: string[][]): ParsedCarteraSnapshot {
  const fecha = findFecha(rows);
  if (!fecha) {
    throw new Error("No se encontró una fecha (formato dd/mm/aaaa) en la hoja.");
  }

  const capital = findScalar(rows, "Capital");
  const caja = findScalar(rows, "Caja");
  const invertido = findScalar(rows, "(Capital", false);
  const valor_mercado = findScalar(rows, "Valor Mercado Portafolio");
  const rent_acum = findScalar(rows, "Rentabilidad Portafolio");
  const rent_anio = findRentAnio(rows);

  if (capital == null || caja == null || invertido == null || valor_mercado == null || rent_acum == null || rent_anio == null) {
    throw new Error(
      "No se pudieron leer todos los campos esperados (Capital, Caja, Invertido, Valor Mercado Portafolio, Rentabilidad Portafolio, Rentabilidad <año>).",
    );
  }

  const t1 = findTableStart(rows, ["Acción", "Inversión", "Valor Mercado", "Upside/Downside"]);
  const t2 = findTableStart(rows, ["Acción", "Cantidad", "Precio Compra", "Precio Mercado"]);
  if (!t1 || !t2) {
    throw new Error(
      'No se encontraron las tablas de posiciones ("Acción/Inversión/Valor Mercado/Upside-Downside" y "Acción/Cantidad/Precio Compra/Precio Mercado").',
    );
  }

  const inversionPorTicker = new Map<string, { invertido: number; valor_mercado: number }>();
  for (let r = t1.row + 1; r < rows.length; r++) {
    const ticker = cell(rows, r, t1.col);
    if (!ticker || ticker === "-" || ticker.toUpperCase() === "TOTAL") break;
    inversionPorTicker.set(ticker, {
      invertido: parseCLNumber(cell(rows, r, t1.col + 1)),
      valor_mercado: parseCLNumber(cell(rows, r, t1.col + 2)),
    });
  }

  const positions: ParsedCarteraPosition[] = [];
  for (let r = t2.row + 1; r < rows.length; r++) {
    const ticker = cell(rows, r, t2.col);
    if (!ticker || ticker === "-" || ticker.toUpperCase() === "TOTAL") break;
    const base = inversionPorTicker.get(ticker);
    if (!base) continue;
    positions.push({
      ticker,
      invertido: base.invertido,
      valor_mercado: base.valor_mercado,
      cantidad: parseCLNumber(cell(rows, r, t2.col + 1)),
      precio_costo: parseCLNumber(cell(rows, r, t2.col + 2)),
      precio_mercado: parseCLNumber(cell(rows, r, t2.col + 3)),
    });
  }

  if (positions.length === 0) {
    throw new Error("No se encontraron posiciones con datos (todas vacías o en blanco).");
  }

  return { fecha, capital, caja, invertido, valor_mercado, rent_anio, rent_acum, positions };
}
