"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude, askClaudeWeb } from "@/lib/claude-client";
import {
  patrimonioAnalysisSystemPrompt,
  patrimonioImportSystemPrompt,
  indicadoresDelDiaSystemPrompt,
} from "@/lib/prompts";
import { appendProfile, buildAdvisorContext, buildTaskContext, type CarteraContextEntry } from "@/lib/context";
import { todayStr } from "@/lib/date";
import type { PatrimonioQuarterFull } from "@/app/(app)/patrimonio/page";
import type { MarketIndicatorsCache, PatrimonioClassCode, PatrimonioLineItem, Task, WeeklyReview } from "@/lib/types";
import { ActivosPasivosChart, type ChartRow } from "./ActivosPasivosChart";

declare global {
  interface Window {
    XLSX?: {
      read: (data: ArrayBuffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_csv: (sheet: unknown) => string };
    };
  }
}

const CLASES_ACTIVO: { id: PatrimonioClassCode; name: string; sub: string }[] = [
  { id: "corrientes", name: "Caja y equivalentes", sub: "Cuentas, efectivo" },
  { id: "inversion", name: "Inversiones financieras", sub: "Futalemu, fondos, acciones" },
  { id: "inmueble", name: "Inmuebles", sub: "Propiedades" },
  { id: "retiro", name: "Fondos de retiro", sub: "AFP, APV, AFC" },
  { id: "mueble", name: "Bienes muebles", sub: "Vehículos, mobiliario" },
];
const CLASES_DEUDA: { id: PatrimonioClassCode; name: string; sub: string }[] = [
  { id: "nocorrientes_p", name: "Créditos hipotecarios", sub: "Largo plazo" },
  { id: "corrientes_p", name: "Pasivos corrientes", sub: "Corto plazo" },
];
const ACTIVO_IDS = CLASES_ACTIVO.map((c) => c.id);
const DEUDA_IDS = CLASES_DEUDA.map((c) => c.id);

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
  if (a >= 1e3) return "$" + (n / 1e3).toLocaleString("es-CL", { maximumFractionDigits: 0 }) + " M";
  return "$" + Math.round(n).toLocaleString("es-CL");
}
const fmtFull = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

function totalesDe(q: PatrimonioQuarterFull): { activos: number; deudas: number; neto: number } {
  const activos = ACTIVO_IDS.reduce((s, c) => s + (q.totals[c] ?? 0), 0);
  const deudas = DEUDA_IDS.reduce((s, c) => s + (q.totals[c] ?? 0), 0);
  return { activos, deudas, neto: activos - deudas };
}

function qOrden(q: { year: number; quarter: string }): number {
  return q.year * 10 + parseInt(q.quarter.replace("Q", ""), 10);
}

interface PendingRegistro {
  q: string;
  year: number;
  activos: Partial<Record<PatrimonioClassCode, number>>;
  deudas: Partial<Record<PatrimonioClassCode, number>>;
}

export default function PatrimonioView({
  quarters: initialQuarters,
  tasks,
  profile,
  weeklyReviews,
  carteras,
  initialIndicators,
}: {
  quarters: PatrimonioQuarterFull[];
  tasks: Task[];
  profile: string;
  weeklyReviews: WeeklyReview[];
  carteras: CarteraContextEntry[];
  initialIndicators: MarketIndicatorsCache | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [quarters, setQuarters] = useState<PatrimonioQuarterFull[]>(initialQuarters);
  const [indicators, setIndicators] = useState<MarketIndicatorsCache | null>(initialIndicators);

  useEffect(() => {
    const load = async () => {
      if (indicators) return;
      try {
        const raw = await askClaudeWeb(
          indicadoresDelDiaSystemPrompt(),
          `Fecha de hoy: ${todayStr()}. Dame el valor de la UF y del dólar observado de hoy en Chile.`,
          400,
        );
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { uf?: number; usd?: number };
        if (parsed.uf && parsed.usd) {
          const row = { as_of: todayStr(), uf: parsed.uf, dolar: parsed.usd, fetched_at: new Date().toISOString() };
          await supabase.from("market_indicators_cache").upsert(row, { onConflict: "user_id,as_of" });
          setIndicators(row as MarketIndicatorsCache);
        }
      } catch {
        // sin indicadores hoy, se omite la equivalencia UF/USD
      }
    };
    void load();
    // Solo al montar — se cachea por día en market_indicators_cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- resumen, trayectoria, composición ----------
  const sorted = useMemo(() => [...quarters].sort((a, b) => qOrden(a) - qOrden(b)), [quarters]);
  const last = sorted[sorted.length - 1] ?? null;
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const tl = last ? totalesDe(last) : null;
  const tp = prev ? totalesDe(prev) : null;
  const dNeto = tl && tp ? tl.neto - tp.neto : null;
  const pctD = tl && tp && tp.neto ? (tl.neto / tp.neto - 1) * 100 : null;

  function renderEquivalencia(montoCLP: number): string | null {
    if (!indicators) return null;
    const uf = montoCLP / indicators.uf;
    const usd = montoCLP / indicators.dolar;
    const fecha = indicators.as_of === todayStr() ? "día" : indicators.as_of;
    return `≈ ${uf.toLocaleString("es-CL", { maximumFractionDigits: 0 })} UF · ≈ US$${usd.toLocaleString("es-CL", { maximumFractionDigits: 0 })} (UF ${indicators.uf.toLocaleString("es-CL")} · USD ${indicators.dolar.toLocaleString("es-CL")} del ${fecha})`;
  }

  // ---------- CIO ----------
  const [cioLoading, setCioLoading] = useState(false);
  const [cioResult, setCioResult] = useState<string | null>(null);
  const [cioError, setCioError] = useState<string | null>(null);

  async function analizarPatrimonio() {
    if (!quarters.length) return;
    setCioLoading(true);
    setCioError(null);
    setCioResult(null);
    const serie = sorted
      .slice(-10)
      .map((r) => {
        const t = totalesDe(r);
        const desglose = CLASES_ACTIVO.filter((c) => r.totals[c.id]).map((c) => `${c.name} ${fmtM(r.totals[c.id]!)}`).join(", ");
        const dd = CLASES_DEUDA.filter((c) => r.totals[c.id]).map((c) => `${c.name} ${fmtM(r.totals[c.id]!)}`).join(", ");
        const ratio = t.neto > 0 ? (t.deudas / t.neto).toFixed(2) : "-";
        const solv = t.deudas > 0 ? (t.activos / t.deudas).toFixed(1) : "-";
        return `${r.quarter} ${r.year}: neto ${fmtM(t.neto)} | activos ${fmtM(t.activos)} (${desglose}) | pasivos ${fmtM(t.deudas)} (${dd}) | deuda/patrimonio ${ratio} | solvencia ${solv}`;
      })
      .join("\n");
    try {
      const user =
        `Mi patrimonio por trimestre:\n${serie}` +
        appendProfile(
          buildTaskContext(tasks) +
            buildAdvisorContext("cio", { weeklyReviews, carteras, patrimonioQuarters: sorted }),
          profile,
        );
      const raw = await askClaude(patrimonioAnalysisSystemPrompt(), user, 1800);
      setCioResult(raw.trim());
    } catch {
      setCioError("No se pudo generar el análisis.");
    }
    setCioLoading(false);
  }

  // ---------- guardar / borrar trimestre ----------
  async function upsertQuarter(
    q: string,
    year: number,
    activos: Partial<Record<PatrimonioClassCode, number>>,
    deudas: Partial<Record<PatrimonioClassCode, number>>,
  ) {
    const existing = quarters.find((x) => x.quarter === q && x.year === year);
    let quarterId = existing?.id;
    if (!quarterId) {
      const { data: inserted } = await supabase
        .from("patrimonio_quarters")
        .insert({ year, quarter: q })
        .select()
        .single();
      quarterId = inserted?.id;
    }
    if (!quarterId) return;
    await supabase.from("patrimonio_class_totals").delete().eq("quarter_id", quarterId);
    const rows = [
      ...Object.entries(activos).filter(([, v]) => v),
      ...Object.entries(deudas).filter(([, v]) => v),
    ].map(([class_code, amount]) => ({ quarter_id: quarterId, class_code, amount }));
    if (rows.length) await supabase.from("patrimonio_class_totals").insert(rows);

    const totals: Partial<Record<PatrimonioClassCode, number>> = { ...activos, ...deudas };
    const lineItems = existing?.lineItems ?? [];
    setQuarters((prev) => [
      ...prev.filter((x) => !(x.quarter === q && x.year === year)),
      { id: quarterId as string, year, quarter: q, totals, lineItems },
    ]);
  }

  async function delTrimestre(id: string) {
    setQuarters((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("patrimonio_quarters").delete().eq("id", id);
  }

  // ---------- formulario manual ----------
  const [formQ, setFormQ] = useState("Q1");
  const [formYear, setFormYear] = useState("");
  const [formActivos, setFormActivos] = useState<Record<string, string>>({});
  const [formDeudas, setFormDeudas] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function guardarTrimestre() {
    const year = parseInt(formYear, 10);
    if (!year) return;
    const activos: Partial<Record<PatrimonioClassCode, number>> = {};
    let algo = false;
    CLASES_ACTIVO.forEach((c) => {
      const v = parseFloat(formActivos[c.id]);
      if (!isNaN(v) && v !== 0) {
        activos[c.id] = v;
        algo = true;
      }
    });
    if (!algo) {
      setSavedMsg("Ingresa al menos un activo.");
      return;
    }
    const deudas: Partial<Record<PatrimonioClassCode, number>> = {};
    CLASES_DEUDA.forEach((c) => {
      const v = parseFloat(formDeudas[c.id]);
      if (!isNaN(v) && v !== 0) deudas[c.id] = v;
    });
    await upsertQuarter(formQ, year, activos, deudas);
    setSavedMsg(`${formQ} ${year} guardado.`);
  }

  function cargarUltimo() {
    if (!last) return;
    setFormQ(last.quarter);
    setFormYear(String(last.year));
    const a: Record<string, string> = {};
    CLASES_ACTIVO.forEach((c) => {
      a[c.id] = last.totals[c.id] ? String(last.totals[c.id]) : "";
    });
    setFormActivos(a);
    const d: Record<string, string> = {};
    CLASES_DEUDA.forEach((c) => {
      d[c.id] = last.totals[c.id] ? String(last.totals[c.id]) : "";
    });
    setFormDeudas(d);
    setSavedMsg(`Cargado ${last.quarter} ${last.year}. Edita y guarda para actualizarlo, o cambia el trimestre para crear uno nuevo.`);
  }

  // ---------- importar planilla ----------
  const [fileStatus, setFileStatus] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRegistro[] | null>(null);
  const [importDone, setImportDone] = useState<string | null>(null);

  async function interpretarPatrimonio(texto: string) {
    setImportLoading(true);
    setImportError(null);
    setPending(null);
    setImportDone(null);
    const recorte = texto.length > 28000 ? texto.slice(0, 28000) + "\n[...truncado]" : texto;
    try {
      const raw = await askClaude(patrimonioImportSystemPrompt(), `Esta es mi planilla de patrimonio:\n\n${recorte}`, 4000);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { registros?: PendingRegistro[] };
      const regs = (parsed.registros ?? []).filter((r) => r.q && r.year);
      if (!regs.length) {
        setImportError("No pude identificar períodos en esa planilla. Prueba pegando solo la tabla con sus encabezados, o cárgalos a mano abajo.");
      } else {
        setPending(regs);
      }
    } catch {
      setImportError("No se pudo interpretar la planilla. Intenta con un rango más acotado.");
    }
    setImportLoading(false);
  }

  async function procesarArchivo(file: File) {
    setFileStatus(file.name);
    let texto = "";
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        if (!window.XLSX) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
            s.onload = () => res();
            s.onerror = () => rej(new Error("No se pudo cargar el lector de Excel"));
            document.head.appendChild(s);
          });
        }
        const buf = await file.arrayBuffer();
        const wb = window.XLSX!.read(buf, { type: "array" });
        texto = wb.SheetNames.map((n) => `--- HOJA: ${n} ---\n` + window.XLSX!.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n");
      } else {
        texto = await file.text();
      }
    } catch {
      setImportError("No se pudo leer el archivo. Prueba exportándolo como CSV.");
      return;
    }
    void interpretarPatrimonio(texto);
  }

  async function confirmarImport() {
    if (!pending) return;
    for (const r of pending) {
      const activos: Partial<Record<PatrimonioClassCode, number>> = {};
      Object.entries(r.activos ?? {}).forEach(([k, v]) => {
        const n = Number(v);
        if (n) activos[k as PatrimonioClassCode] = n;
      });
      const deudas: Partial<Record<PatrimonioClassCode, number>> = {};
      Object.entries(r.deudas ?? {}).forEach(([k, v]) => {
        const n = Math.abs(Number(v));
        if (n) deudas[k as PatrimonioClassCode] = n;
      });
      await upsertQuarter(r.q, r.year, activos, deudas);
    }
    setPending(null);
    setImportDone("Patrimonio cargado. Tu CIO ya tiene la trayectoria completa.");
    setFileStatus("");
    setPasteValue("");
  }

  function descartarImport() {
    setPending(null);
    setFileStatus("");
  }

  // ---------- render ----------
  const chartSerie = sorted.slice(-14);
  const chartNetos = chartSerie.map((r) => totalesDe(r).neto);
  const chartMax = Math.max(...chartNetos, 1);
  const lineRows: ChartRow[] = sorted.map((r) => {
    const t = totalesDe(r);
    return {
      id: r.id,
      label: `${r.quarter} '${String(r.year).slice(2)}`,
      values: {
        activos: t.activos,
        pasivos: t.deudas,
        inmobiliaria: r.totals.inmueble ?? 0,
        financiera: (r.totals.inversion ?? 0) + (r.totals.retiro ?? 0),
      },
    };
  });

  const acts = last
    ? CLASES_ACTIVO.map((c) => ({ ...c, val: last.totals[c.id] ?? 0 })).filter((e) => e.val > 0).sort((a, b) => b.val - a.val)
    : [];
  const pass = last
    ? CLASES_DEUDA.map((c) => ({ ...c, val: last.totals[c.id] ?? 0 })).filter((e) => e.val > 0).sort((a, b) => b.val - a.val)
    : [];
  const lineItemsByClass = (classId: PatrimonioClassCode): PatrimonioLineItem[] =>
    last ? last.lineItems.filter((li) => li.class_code === classId) : [];

  return (
    <>
      <h1 className="page-title">Patrimonio</h1>
      <div className="page-sub">Tu balance familiar trimestral, en pesos chilenos. La trayectoria de tu capital hacia la independencia.</div>

      {last && tl && (
        <div className="pat-hero">
          <div className="ph-lbl">
            Patrimonio neto · {last.quarter} {last.year}
          </div>
          <div className="ph-val" title={fmtFull(tl.neto)}>
            {fmtM(tl.neto)}
          </div>
          {dNeto !== null && pctD !== null && prev && (
            <div className={`ph-delta ${dNeto >= 0 ? "up" : "down"}`}>
              {dNeto >= 0 ? "▲" : "▼"} {fmtM(Math.abs(dNeto))} ({pctD >= 0 ? "+" : ""}
              {pctD.toFixed(1)}%) vs. {prev.quarter} {prev.year}
            </div>
          )}
          <div className="ph-eq">
            <span className="eq-item act">
              <span className="eq-l">Activos</span>
              <span className="eq-v" title={fmtFull(tl.activos)}>
                {fmtM(tl.activos)}
              </span>
            </span>
            <span className="eq-op">−</span>
            <span className="eq-item pas">
              <span className="eq-l">Pasivos</span>
              <span className="eq-v" title={fmtFull(tl.deudas)}>
                {fmtM(tl.deudas)}
              </span>
            </span>
            <span className="eq-op">=</span>
            <span className="eq-item net">
              <span className="eq-l">Patrimonio</span>
              <span className="eq-v">{fmtM(tl.neto)}</span>
            </span>
          </div>
          <div className="ph-ratios">
            <span>
              Deuda / patrimonio <b>{tl.neto > 0 ? (tl.deudas / tl.neto).toFixed(2) : "—"}</b>
            </span>
            <span>
              Solvencia <b>{tl.deudas > 0 ? (tl.activos / tl.deudas).toFixed(1) : "—"}</b>
            </span>
            <span>
              Líquido{" "}
              <b>
                {tl.activos > 0
                  ? Math.round((((last.totals.corrientes ?? 0) + (last.totals.inversion ?? 0)) / tl.activos) * 100)
                  : 0}
                %
              </b>
            </span>
          </div>
        </div>
      )}
      {last && tl && renderEquivalencia(tl.neto) && <div className="pat-equiv">{renderEquivalencia(tl.neto)}</div>}

      <div className="panel">
        <h2>Trayectoria</h2>
        {!quarters.length ? (
          <div className="empty-note">Aún no has cargado tu planilla. Súbela abajo y aparece todo.</div>
        ) : (
          <>
            <div className="pat-bars">
              {chartSerie.map((r, i) => {
                const n = chartNetos[i];
                const h = Math.max(8, (n / chartMax) * 160);
                return (
                  <div className="pat-bar-wrap" key={r.id} title={`${r.quarter} ${r.year}: ${fmtFull(n)}`}>
                    <span className="pat-bar-val">{(n / 1e6).toFixed(0)}</span>
                    <div className={`pat-bar ${i === chartSerie.length - 1 ? "last" : ""}`} style={{ height: h }} />
                    <span className="pat-bar-lbl">
                      {r.quarter}
                      <span className="pb-y">&apos;{String(r.year).slice(2)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="pat-chart-note">Patrimonio neto en millones de pesos</div>
            <div className="pat-hist" style={{ marginTop: 18 }}>
              <details>
                <summary>Ver los {quarters.length} trimestres en detalle</summary>
                <table className="pat-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Activos</th>
                      <th>Pasivos</th>
                      <th>Neto</th>
                      <th>D/P</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sorted].reverse().map((r) => {
                      const t = totalesDe(r);
                      return (
                        <tr key={r.id}>
                          <td className="pt-per">
                            {r.quarter} {r.year}
                          </td>
                          <td>{fmtM(t.activos)}</td>
                          <td>{fmtM(t.deudas)}</td>
                          <td className="pt-net">{fmtM(t.neto)}</td>
                          <td>{t.neto > 0 ? (t.deudas / t.neto).toFixed(2) : "—"}</td>
                          <td>
                            <span className="pt-del" onClick={() => void delTrimestre(r.id)}>
                              ✕
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </div>
          </>
        )}
      </div>

      {quarters.length > 0 && (
        <div className="panel">
          <h2>Activos vs. pasivos</h2>
          <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
            Activos totales frente a pasivos totales — la brecha entre ambos es tu patrimonio neto —, y de fondo
            cómo se reparte la inversión entre inmobiliaria y financiera (inversiones + retiro).
          </div>
          <ActivosPasivosChart rows={lineRows} />
        </div>
      )}

      <div className="panel">
        <h2>Composición actual</h2>
        {!last ? (
          <div className="empty-note">Sin datos todavía.</div>
        ) : (
          <>
            <div className="mix-block">
              <div className="mix-head act">
                Activos <span className="mh-tot">{fmtM(tl!.activos)}</span>
              </div>
              {acts.length ? (
                acts.map((e) => {
                  const pct = tl!.activos > 0 ? Math.round((e.val / tl!.activos) * 100) : 0;
                  const detalle = lineItemsByClass(e.id);
                  return (
                    <div className="mix-row" key={e.id}>
                      <div className="mix-top">
                        <span>{e.name}</span>
                        <span className="mix-pct">
                          {pct}% · {fmtM(e.val)}
                        </span>
                      </div>
                      <div className="mix-track">
                        <div className="mix-fill act" style={{ width: `${pct}%` }} />
                      </div>
                      {detalle.length > 0 && (
                        <div className="mix-sub">
                          {detalle.map((x) => (
                            <div className="mix-sub-row" key={x.id}>
                              <span>{x.label}</span>
                              <span className="msr-v">{fmtM(x.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-note">Sin activos registrados.</div>
              )}
            </div>
            <div className="mix-block">
              <div className="mix-head pas">
                Pasivos <span className="mh-tot">{fmtM(tl!.deudas)}</span>
              </div>
              {pass.length ? (
                pass.map((e) => {
                  const pct = tl!.activos > 0 ? Math.round((e.val / tl!.activos) * 100) : 0;
                  const detalle = lineItemsByClass(e.id);
                  return (
                    <div className="mix-row" key={e.id}>
                      <div className="mix-top">
                        <span>{e.name}</span>
                        <span className="mix-pct">
                          {pct}% · {fmtM(e.val)}
                        </span>
                      </div>
                      <div className="mix-track">
                        <div className="mix-fill pas" style={{ width: `${pct}%` }} />
                      </div>
                      {detalle.length > 0 && (
                        <div className="mix-sub">
                          {detalle.map((x) => (
                            <div className="mix-sub-row" key={x.id}>
                              <span>{x.label}</span>
                              <span className="msr-v">{fmtM(x.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-note">Sin pasivos registrados.</div>
              )}
              <div className="mix-note">Los porcentajes de pasivos se muestran sobre el total de activos.</div>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Lectura del CIO</h2>
        <div className="page-sub" style={{ margin: "-6px 0 12px 0" }}>
          Una mirada a tu estructura patrimonial: concentración, liquidez, apalancamiento y ritmo de acumulación.
        </div>
        <button className="ghost" onClick={() => void analizarPatrimonio()} disabled={cioLoading}>
          Pedir lectura del CIO
        </button>
        {cioLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                El CIO está revisando tu patrimonio<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Analizando composición, deuda y trayectoria.</div>
          </div>
        )}
        {cioError && <div className="loading">{cioError}</div>}
        {cioResult && (
          <div className="response-box">
            {cioResult.split(/\n/).map((line, i) => {
              const m = line.match(/^(ESTRUCTURA:|APALANCAMIENTO:|TRAYECTORIA:|LO QUE MIRARÍA:|LO QUE MIRARIA:)(.*)$/);
              if (m) {
                return (
                  <div key={i}>
                    <strong
                      style={{
                        color: "var(--accent-deep)",
                        display: "block",
                        marginTop: 15,
                        marginBottom: 5,
                        letterSpacing: 1,
                        fontSize: "0.72rem",
                        textTransform: "uppercase",
                      }}
                    >
                      {m[1]}
                    </strong>
                    {m[2]}
                  </div>
                );
              }
              return <div key={i}>{line}</div>;
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Cargar desde tu planilla</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Sube tu <em>Patrimonio_Familiar.xlsx</em> tal cual — leo la hoja Balance completa, todos los años y trimestres.
          Súbelo de nuevo cada cierre y se actualiza solo.
        </div>
        <div className="pdf-drop">
          <div className="pdf-drop-lbl">Arrastra o elige tu planilla de patrimonio (.xlsx o .csv)</div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            id="pat-file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void procesarArchivo(f);
              e.target.value = "";
            }}
          />
          <button className="ghost" onClick={() => document.getElementById("pat-file")?.click()}>
            Elegir archivo
          </button>
          <span className="pdf-status">{fileStatus}</span>
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ fontSize: "0.78rem", color: "var(--n700)", cursor: "pointer" }}>O pega el rango directamente</summary>
          <div style={{ marginTop: 10 }}>
            <textarea
              placeholder="Copia las celdas desde tu Google Sheet y pégalas aquí — con encabezados si los tienes."
              style={{ minHeight: 130, fontFamily: "var(--mono)", fontSize: "0.8rem" }}
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
            />
            <div style={{ marginTop: 9 }}>
              <button
                className="ghost"
                onClick={() => {
                  const txt = pasteValue.trim();
                  if (!txt) {
                    setImportError("Pega el rango primero.");
                    return;
                  }
                  void interpretarPatrimonio(txt);
                }}
              >
                Interpretar lo pegado
              </button>
            </div>
          </div>
        </details>

        {importLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Leyendo tu planilla<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Identificando períodos, clases de activo y deudas.</div>
          </div>
        )}
        {importError && <div className="empty-note">{importError}</div>}
        {importDone && <div className="review-done">{importDone}</div>}
        {pending && (
          <div className="pdf-preview-box">
            <div className="pdf-prev-head">
              Encontré {pending.length} período{pending.length === 1 ? "" : "s"}
            </div>
            {[...pending]
              .sort((a, b) => qOrden({ year: b.year, quarter: b.q }) - qOrden({ year: a.year, quarter: a.q }))
              .map((r, i) => {
                const a = Object.values(r.activos ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
                const d = Object.values(r.deudas ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
                return (
                  <div className="mini-row" key={i}>
                    <span className="m-name">
                      {r.q} {r.year}
                    </span>
                    <span className="m-val" style={{ color: "var(--n600)" }}>
                      act. {fmtM(a)} · deuda {fmtM(d)}
                    </span>
                    <span className="m-val" style={{ fontWeight: 600 }}>
                      {fmtM(a - d)}
                    </span>
                  </div>
                );
              })}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => void confirmarImport()}>Guardar todo</button>{" "}
              <button className="text-action" onClick={descartarImport}>
                Descartar
              </button>
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--n600)", marginTop: 9 }}>
              Revisa los totales antes de guardar. Los períodos que ya tengas se reemplazan.
            </div>
          </div>
        )}
      </div>

      <details className="pat-manual">
        <summary>Corregir o agregar un trimestre a mano</summary>
        <div style={{ marginTop: 16 }}>
          <div className="page-sub" style={{ margin: "0 0 14px 0" }}>
            Normalmente no lo necesitas: la planilla trae todo. Úsalo solo para ajustar un dato puntual.
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <div>
              <label className="mini-lbl">Trimestre</label>
              <select value={formQ} onChange={(e) => setFormQ(e.target.value)} style={{ width: 130 }}>
                <option value="Q1">Q1 · ene-mar</option>
                <option value="Q2">Q2 · abr-jun</option>
                <option value="Q3">Q3 · jul-sep</option>
                <option value="Q4">Q4 · oct-dic</option>
              </select>
            </div>
            <div>
              <label className="mini-lbl">Año</label>
              <input
                type="number"
                min={2015}
                max={2100}
                style={{ width: 100 }}
                value={formYear}
                onChange={(e) => setFormYear(e.target.value)}
              />
            </div>
          </div>

          <div className="pat-grid">
            <div className="pat-col">
              <div className="pat-col-lbl activos">Activos</div>
              {CLASES_ACTIVO.map((c) => (
                <div className="pat-field" key={c.id}>
                  <label>
                    {c.name}
                    <span className="pf-sub">{c.sub}</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formActivos[c.id] ?? ""}
                    onChange={(e) => setFormActivos((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="pat-col">
              <div className="pat-col-lbl deudas">Pasivos</div>
              {CLASES_DEUDA.map((c) => (
                <div className="pat-field" key={c.id}>
                  <label>
                    {c.name}
                    <span className="pf-sub">{c.sub}</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formDeudas[c.id] ?? ""}
                    onChange={(e) => setFormDeudas((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={() => void guardarTrimestre()}>Guardar trimestre</button>
            <button className="ghost" style={{ marginLeft: 6 }} onClick={cargarUltimo}>
              Cargar el último
            </button>
          </div>
          {savedMsg && <div className="review-done" style={{ marginTop: 10 }}>{savedMsg}</div>}
        </div>
      </details>
    </>
  );
}
