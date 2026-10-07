// Lectura incremental de las hojas largas de un Excel (p. ej. "PAS - Torres" o
// "Fechas Lib. Predial", que arrastran datos desde el inicio del proyecto): la
// primera vez se lee todo; las siguientes solo lo nuevo o modificado respecto de
// la lectura anterior, mostrando "antes → ahora" en las celdas que cambiaron.

export interface HojaGuardada {
  filas: string[][];
  claveCol: number;
  guardadoEn: string;
  /** Entrada del historial que recogió esta lectura; si se borra, la hoja se vuelve a leer completa. */
  entryId: string;
}

const MAX_CARACTERES = 45000;
const MAX_LINEAS_POR_GRUPO = 250;

const vacia = (fila: string[]) => fila.every((c) => !c);

function limpiar(filas: string[][]): string[][] {
  return filas
    .map((f) => {
      const copia = [...f];
      while (copia.length && !copia[copia.length - 1]) copia.pop();
      return copia;
    })
    .filter((f) => f.length > 0);
}

/** Índice de la fila de encabezados: la primera con al menos 3 celdas con texto. */
function filaEncabezado(filas: string[][]): number {
  const i = filas.slice(0, 8).findIndex((f) => f.filter(Boolean).length >= 3);
  return i < 0 ? 0 : i;
}

// Columna que identifica cada fila: la primera de las 4 primeras casi sin repetidos.
function elegirClave(datos: string[][]): number {
  for (let c = 0; c < 4; c++) {
    const valores = datos.map((f) => f[c] ?? "").filter(Boolean);
    if (valores.length < datos.length * 0.9) continue;
    if (new Set(valores).size >= valores.length * 0.98) return c;
  }
  return -1;
}

function claveDe(fila: string[], claveCol: number, vistos: Map<string, number>): string {
  const base = claveCol >= 0 ? (fila[claveCol] ?? "") : fila.slice(0, 3).join("|");
  const n = (vistos.get(base) ?? 0) + 1;
  vistos.set(base, n);
  return n > 1 ? `${base}#${n}` : base;
}

function indexar(datos: string[][], claveCol: number): Map<string, string[]> {
  const vistos = new Map<string, number>();
  const m = new Map<string, string[]>();
  for (const f of datos) m.set(claveDe(f, claveCol, vistos), f);
  return m;
}

export interface ResultadoHoja {
  texto: string;
  /** Lo que se guardará para comparar la próxima vez. */
  guardar: Omit<HojaGuardada, "entryId">;
  nota: string;
}

export function leerHojaIncremental(nombre: string, bruto: string[][], previa: HojaGuardada | null): ResultadoHoja {
  const filas = limpiar(bruto);
  const h = filaEncabezado(filas);
  const encabezado = filas[h] ?? [];
  const datos = filas.slice(h + 1).filter((f) => !vacia(f));
  const claveCol = previa ? previa.claveCol : elegirClave(datos);
  const guardar = { filas, claveCol, guardadoEn: new Date().toISOString() };
  const encTexto = `Encabezados: ${encabezado.join(" | ")}`;

  // Primera lectura: se lee todo (hasta un tope). Si no cabe, se prefieren las filas del final.
  if (!previa) {
    const lineas: string[] = [];
    let largo = 0;
    for (let i = datos.length - 1; i >= 0; i--) {
      const l = datos[i].join(" | ");
      if (largo + l.length + 1 > MAX_CARACTERES) break;
      largo += l.length + 1;
      lineas.unshift(l);
    }
    const omitidas = datos.length - lineas.length;
    const aviso = omitidas > 0 ? ` (por tamaño, solo las últimas ${lineas.length}; se omiten las ${omitidas} primeras)` : "";
    return {
      texto: `[Hoja "${nombre}" — PRIMERA LECTURA: ${datos.length} filas${aviso}]\n${encTexto}\n${lineas.join("\n")}`,
      guardar,
      nota: `Hoja ${nombre}: primera lectura, ${datos.length} filas${omitidas > 0 ? ` (leí las últimas ${lineas.length})` : ""}.`,
    };
  }

  // Lecturas siguientes: solo lo nuevo o modificado.
  const hPrev = filaEncabezado(previa.filas);
  const prev = indexar(previa.filas.slice(hPrev + 1).filter((f) => !vacia(f)), claveCol);
  const actual = indexar(datos, claveCol);

  const nuevas: string[] = [];
  const modificadas: string[] = [];
  let sinCambios = 0;
  for (const [clave, fila] of actual) {
    const antes = prev.get(clave);
    if (!antes) {
      nuevas.push(fila.join(" | "));
      continue;
    }
    const cambios: string[] = [];
    const n = Math.max(fila.length, antes.length);
    for (let c = 0; c < n; c++) {
      const a = antes[c] ?? "";
      const d = fila[c] ?? "";
      if (a !== d) cambios.push(`${encabezado[c] || `col ${c + 1}`}: ${a || "(vacío)"} → ${d || "(vacío)"}`);
    }
    if (cambios.length) modificadas.push(`${clave.replace(/#\d+$/, "")} — ${cambios.join("; ")}`);
    else sinCambios++;
  }
  const eliminadas = [...prev.keys()].filter((k) => !actual.has(k)).map((k) => k.replace(/#\d+$/, ""));

  const recorte = (l: string[]) =>
    l.length > MAX_LINEAS_POR_GRUPO ? [...l.slice(0, MAX_LINEAS_POR_GRUPO), `[…y ${l.length - MAX_LINEAS_POR_GRUPO} más]`] : l;
  const desde = new Date(previa.guardadoEn).toLocaleDateString("es-CL");
  const partes = [
    `[Hoja "${nombre}" — CAMBIOS desde la lectura del ${desde}: ${nuevas.length} filas nuevas, ${modificadas.length} modificadas, ${eliminadas.length} eliminadas; ${sinCambios} sin cambios (no se incluyen)]`,
    encTexto,
  ];
  if (nuevas.length) partes.push(`FILAS NUEVAS (${nuevas.length}):\n${recorte(nuevas).join("\n")}`);
  if (modificadas.length) partes.push(`FILAS MODIFICADAS (${modificadas.length}) — antes → ahora:\n${recorte(modificadas).join("\n")}`);
  if (eliminadas.length) partes.push(`FILAS ELIMINADAS (${eliminadas.length}): ${eliminadas.slice(0, 40).join(", ")}${eliminadas.length > 40 ? "…" : ""}`);
  if (!nuevas.length && !modificadas.length && !eliminadas.length) partes.push("Sin cambios en esta hoja desde la lectura anterior.");

  return {
    texto: partes.join("\n"),
    guardar,
    nota: `Hoja ${nombre}: ${nuevas.length} nuevas, ${modificadas.length} modificadas, ${eliminadas.length} eliminadas (${sinCambios} sin cambios, no las leí de nuevo).`,
  };
}
