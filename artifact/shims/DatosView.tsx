/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import Papa from "papaparse";
import { escribirFila, leerTabla } from "./supabase";
import { getDb, getDownloads } from "./runtime";
import { IndicadoresBox } from "./IndicadoresBox";
import { refrescar } from "./router";

// Tablas del panel anterior que se traen a esta página.
const TABLAS = [
  "profile", "tasks", "habits", "habit_logs", "weekly_reviews", "checkins", "weight_log", "exam_results",
  "health_verdicts", "council_sessions", "learning_log", "market_briefings", "market_indicators_cache",
  "patrimonio_classes", "patrimonio_quarters", "patrimonio_class_totals", "patrimonio_line_items",
  "investments_futalemu", "investments_futalemu_positions", "investment_accounts", "investment_account_positions",
  "investment_account_snapshots", "portfolio_sources",
];

const sqlDe = (tablas: string[]) =>
  tablas.map((t, i) => `${i ? "union all " : ""}select '${t}' as t, coalesce(json_agg(x), '[]'::json) as d from ${t} x`).join("\n") + ";";
export const SQL_EXPORT = sqlDe(TABLAS);

type Fila = Record<string, any>;

function extraer(texto: string, nombre: string, permitidas: string[]): Record<string, Fila[]> {
  const out: Record<string, Fila[]> = {};
  const poner = (t: string, filas: unknown) => {
    if (permitidas.includes(t) && Array.isArray(filas)) out[t] = [...(out[t] ?? []), ...(filas as Fila[])];
  };
  if (/\.json$/i.test(nombre) || texto.trim().startsWith("{") || texto.trim().startsWith("[")) {
    const j = JSON.parse(texto);
    if (Array.isArray(j)) j.forEach((r: any) => poner(r.t, typeof r.d === "string" ? JSON.parse(r.d) : r.d));
    else Object.entries(j).forEach(([t, f]) => poner(t, f));
    return out;
  }
  const res = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: true });
  for (const r of res.data) {
    if (r.t && r.d) poner(r.t, JSON.parse(r.d));
  }
  return out;
}

async function conReintento<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i >= 4 || (e?.code !== "resource_exhausted" && e?.code !== "unavailable")) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

export default function DatosView({ tablas = TABLAS, conIndicadores = true }: { tablas?: string[]; conIndicadores?: boolean }) {
  const sql = sqlDe(tablas);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  async function importar(file: File) {
    setError(null);
    setEstado(null);
    setTrabajando(true);
    try {
      const datos = extraer(await file.text(), file.name, tablas);
      const traidas = Object.keys(datos);
      const total = traidas.reduce((s, t) => s + datos[t].length, 0);
      if (!total) throw new Error("No encontré filas de las tablas del panel en ese archivo.");
      if (total > 22000) throw new Error(`El archivo trae ${total} filas; el límite de esta página es ~25.000 documentos.`);
      let hechas = 0;
      setProgreso({ hechas, total });
      const cola: { t: string; fila: Fila }[] = traidas.flatMap((t) => datos[t].map((fila) => ({ t, fila })));
      const trabajadores = Array.from({ length: 5 }, async () => {
        while (cola.length) {
          const item = cola.shift();
          if (!item) break;
          const { user_id: _u, ...fila } = item.fila;
          void _u;
          await conReintento(() => escribirFila(item.t, fila));
          hechas++;
          if (hechas % 10 === 0 || hechas === total) setProgreso({ hechas, total });
        }
      });
      await Promise.all(trabajadores);
      setEstado(`Listo: traje ${total} filas de ${traidas.length} tablas (${traidas.join(", ")}).`);
      refrescar();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo importar.");
    }
    setTrabajando(false);
  }

  async function copiarSql() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiado(true);
    } catch {
      setCopiado(false);
      setError("No se pudo copiar solo: selecciona el texto y cópialo.");
    }
  }

  async function respaldo() {
    setError(null);
    try {
      const out: Record<string, Fila[]> = {};
      for (const t of tablas) out[t] = await leerTabla(t);
      const dl = await getDownloads();
      if (!dl) throw new Error("La descarga no está disponible en esta vista.");
      await dl.save({ filename: `la-mesa-respaldo-${new Date().toISOString().slice(0, 10)}.json`, data: JSON.stringify(out) });
      setEstado("Respaldo listo.");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo descargar el respaldo.");
    }
  }

  async function estadoDb() {
    const d = await getDb();
    setEstado(d ? "Los datos guardados están disponibles." : "Los datos guardados no están disponibles: abre esta página con tu sesión de Claude.");
  }

  return (
    <>
      <h1 className="page-title">Datos</h1>
      <div className="page-sub">Traer tus datos del panel anterior, respaldarlos y cargar la UF y el dólar.</div>

      <div className="panel">
        <h2>1. Traer los datos del panel anterior</h2>
        <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          <li>Copia el SQL de abajo y córrelo en el SQL Editor de Supabase.</li>
          <li>En los resultados toca <b>Export → Download CSV</b>.</li>
          <li>Sube aquí ese archivo.</li>
        </ol>
        <pre style={{ maxHeight: 130, overflow: "auto", background: "var(--surface)", padding: 12, borderRadius: 8, fontSize: "0.7rem", whiteSpace: "pre-wrap" }}>{sql}</pre>
        <div className="row" style={{ marginTop: 10, gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="ghost" onClick={() => void copiarSql()}>
            {copiado ? "Copiado" : "Copiar SQL"}
          </button>
          <input ref={archivoRef} type="file" accept=".csv,.json" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && void importar(e.target.files[0])} />
          <button onClick={() => archivoRef.current?.click()} disabled={trabajando}>
            {trabajando ? "Importando…" : "Subir el CSV"}
          </button>
        </div>
        {progreso && trabajando && (
          <div style={{ marginTop: 10, fontSize: "0.85rem" }}>
            {progreso.hechas} de {progreso.total} filas…
          </div>
        )}
      </div>

      {conIndicadores && (
        <div className="panel">
          <h2>2. UF y dólar</h2>
          <IndicadoresBox />
        </div>
      )}

      <div className="panel">
        <h2>{conIndicadores ? "3. Respaldo" : "2. Respaldo"}</h2>
        <div className="page-sub" style={{ margin: "-6px 0 10px 0" }}>Descarga todo lo guardado en esta página como un archivo.</div>
        <div className="row" style={{ gap: 10 }}>
          <button className="ghost" onClick={() => void respaldo()}>Descargar respaldo</button>
          <button className="ghost" onClick={() => void estadoDb()}>Probar datos guardados</button>
        </div>
      </div>

      {estado && <div className="empty-note">{estado}</div>}
      {error && <div className="empty-note" style={{ color: "var(--amarillo-deep)" }}>{error}</div>}
    </>
  );
}
