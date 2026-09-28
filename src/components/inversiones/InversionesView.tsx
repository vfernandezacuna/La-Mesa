"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude, askClaudeWeb } from "@/lib/claude-client";
import {
  carteraAnalysisSystemPrompt,
  briefingMercadoSystemPrompt,
  resumenNoticiasSystemPrompt,
  ideasInvestigarSystemPrompt,
  indicadoresDelDiaSystemPrompt,
} from "@/lib/prompts";
import { appendProfile, buildAdvisorContext, buildTaskContext, carteraTexto, type PatrimonioQuarterTotals } from "@/lib/context";
import { todayStr } from "@/lib/date";
import type {
  InvestmentsFutalemu,
  InvestmentsFutalemuPosition,
  MarketBriefing,
  MarketIndicatorsCache,
  Task,
  WeeklyReview,
} from "@/lib/types";

interface Idea {
  titulo?: string;
  porque?: string;
  tarea?: string;
  riesgo?: string;
  origen?: string;
}

function num(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function mm(n: number): string {
  return "$" + (n / 1e6).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MM";
}

const HEADER_RE_BRIEF = /^(MACRO GLOBAL:|MACRO CHILE:|OPORTUNIDADES RENTA VARIABLE:|OPORTUNIDADES RENTA FIJA:|TUS POSICIONES:|ALERTA CIO:)(.*)$/;
const HEADER_RE_NEWS = /^(LO ESENCIAL:|QUÉ SIGNIFICA:|TOCA TU PORTAFOLIO:|A QUÉ ESTAR ATENTO:)(.*)$/;

function FormattedResponse({ text, headerRe }: { text: string; headerRe: RegExp }) {
  return (
    <div className="response-box">
      {text.split(/\n/).map((line, i) => {
        const m = line.match(headerRe);
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
  );
}

export default function InversionesView({
  cartera,
  tasks,
  profile,
  weeklyReviews,
  patrimonioQuarters,
  lastBrief,
  lastNews,
  initialIndicators,
}: {
  cartera: { meta: InvestmentsFutalemu; positions: InvestmentsFutalemuPosition[] } | null;
  tasks: Task[];
  profile: string;
  weeklyReviews: WeeklyReview[];
  patrimonioQuarters: PatrimonioQuarterTotals[];
  lastBrief: MarketBriefing | null;
  lastNews: MarketBriefing | null;
  initialIndicators: MarketIndicatorsCache | null;
}) {
  const supabase = useMemo(() => createClient(), []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advisorContext = () =>
    appendProfile(
      buildTaskContext(tasks) + buildAdvisorContext("cio", { weeklyReviews, cartera, patrimonioQuarters }),
      profile,
    );

  // ---------- Análisis del CIO sobre la cartera ----------
  const [cioLoading, setCioLoading] = useState(false);
  const [cioResult, setCioResult] = useState<string | null>(null);
  const [cioError, setCioError] = useState<string | null>(null);

  async function analizarCartera() {
    if (!cartera) return;
    setCioLoading(true);
    setCioError(null);
    setCioResult(null);
    try {
      const raw = await askClaude(carteraAnalysisSystemPrompt(), carteraTexto(cartera.meta, cartera.positions, true) + advisorContext());
      setCioResult(raw.trim());
    } catch {
      setCioError("No se pudo generar el análisis.");
    }
    setCioLoading(false);
  }

  // ---------- Briefing de mercado ----------
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<MarketBriefing | null>(lastBrief);
  const [briefError, setBriefError] = useState<string | null>(null);

  async function briefingMercado() {
    if (!cartera) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const user =
        `Fecha: ${todayStr()}. Portafolio del inversionista: ${carteraTexto(cartera.meta, cartera.positions, false)}. Genera el briefing de mercado de hoy con foco global y Chile.` +
        advisorContext();
      const raw = await askClaudeWeb(briefingMercadoSystemPrompt(), user, 2500);
      const { data } = await supabase
        .from("market_briefings")
        .insert({ kind: "brief", output_text: raw.trim() })
        .select()
        .single();
      if (data) setBrief(data as MarketBriefing);
    } catch {
      setBriefError("No se pudo generar el briefing. Intenta nuevamente en unos momentos.");
    }
    setBriefLoading(false);
  }

  // ---------- Resumen de noticias pegadas ----------
  const [newsInput, setNewsInput] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);
  const [news, setNews] = useState<MarketBriefing | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);

  async function resumirNoticias() {
    const txt = newsInput.trim();
    if (!txt || !cartera) {
      setNewsError("Pega primero una o más noticias.");
      return;
    }
    setNewsLoading(true);
    setNewsError(null);
    try {
      const posiciones = carteraTexto(cartera.meta, cartera.positions, false);
      const user = `Mi portafolio: ${posiciones}.\n\nNoticias que junté:\n\n${txt}` + advisorContext();
      const raw = await askClaude(resumenNoticiasSystemPrompt(), user, 2000);
      const { data } = await supabase
        .from("market_briefings")
        .insert({ kind: "news", input_text: txt, output_text: raw.trim() })
        .select()
        .single();
      if (data) setNews(data as MarketBriefing);
    } catch {
      setNewsError("No se pudo generar el resumen. Intenta nuevamente.");
    }
    setNewsLoading(false);
  }

  function limpiarNoticias() {
    setNewsInput("");
    setNews(null);
    setNewsError(null);
  }

  // ---------- Ideas para investigar ----------
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const briefForIdeas = brief ?? lastBrief;
  const newsForIdeas = news ?? lastNews;

  async function generarIdeas() {
    if (!cartera) return;
    setIdeasLoading(true);
    setIdeasError(null);
    setIdeas(null);
    try {
      const posiciones = carteraTexto(cartera.meta, cartera.positions, true);
      let user = `Fecha: ${todayStr()}.\n\nCONTEXTO — lo que YA tengo en cartera (úsalo solo para NO repetirme esto y para no concentrarme más el riesgo; no es la fuente de las ideas): ${posiciones}.`;
      if (briefForIdeas?.output_text) user += `\n\nMI BRIEFING MÁS RECIENTE:\n${briefForIdeas.output_text}`;
      if (newsForIdeas?.output_text) user += `\n\nRESUMEN DE MIS NOTICIAS:\n${newsForIdeas.output_text}`;
      user += `\n\nPropón ideas nuevas para investigar, con alcance global.` + advisorContext();
      const raw = await askClaudeWeb(ideasInvestigarSystemPrompt(), user, 2800);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as Idea[];
      setIdeas(parsed);
    } catch {
      setIdeasError("No se pudieron generar las ideas. Intenta nuevamente.");
    }
    setIdeasLoading(false);
  }

  // ---------- render ----------
  if (!cartera) {
    return (
      <>
        <h1 className="page-title">Inversiones</h1>
        <div className="page-sub">Tu cartera personal, en un solo lugar.</div>
        <div className="empty-note">Aún no hay una cartera registrada.</div>
      </>
    );
  }

  const { meta, positions } = cartera;
  const totInv = positions.reduce((s, p) => s + p.invertido, 0);
  const totVM = positions.reduce((s, p) => s + p.valor_mercado, 0);
  const retTotal = (totVM / totInv - 1) * 100;
  const fecha = new Date(meta.fecha + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const sortedPositions = [...positions].sort((a, b) => b.valor_mercado - a.valor_mercado);

  const equivMonto = meta.valor_mercado + meta.caja;
  const equivalencia = indicators
    ? `≈ ${(equivMonto / indicators.uf).toLocaleString("es-CL", { maximumFractionDigits: 0 })} UF · ≈ US$${(equivMonto / indicators.dolar).toLocaleString("es-CL", { maximumFractionDigits: 0 })} (UF ${indicators.uf.toLocaleString("es-CL")} · USD ${indicators.dolar.toLocaleString("es-CL")} del ${indicators.as_of === todayStr() ? "día" : indicators.as_of})`
    : null;

  return (
    <>
      <h1 className="page-title">Inversiones</h1>
      <div className="page-sub">Tu cartera personal, en un solo lugar.</div>

      <div className="panel">
        <h2>Cartera Inversiones Futalemu</h2>
        <div className="page-sub" style={{ margin: "-6px 0 4px 0" }}>
          Portafolio accionario chileno de la sociedad de inversión. No incluye fondos mutuos, APV ni otros activos —
          esos viven en Patrimonio.
        </div>

        <div className="fut-head">
          <div>
            <div className="fh-lbl">Valor de mercado · {fecha}</div>
            <div className="fut-val">{mm(meta.valor_mercado + meta.caja)}</div>
            <div className="fut-sub">
              Portafolio {mm(meta.valor_mercado)} + caja {mm(meta.caja)}
            </div>
          </div>
          <div className="fut-stats">
            <div className="fs-item">
              <span className="fs-l">Capital aportado</span>
              <span className="fs-v">{mm(meta.capital)}</span>
            </div>
            <div className="fs-item">
              <span className="fs-l">Capital + dividendos invertido</span>
              <span className="fs-v">{mm(meta.invertido)}</span>
            </div>
            <div className="fs-item">
              <span className="fs-l">Retorno acumulado</span>
              <span className="fs-v pos">+{Math.round(meta.rent_acum * 100)}%</span>
            </div>
            <div className="fs-item">
              <span className="fs-l">Retorno {meta.fecha.slice(0, 4)}</span>
              <span className="fs-v pos">+{Math.round(meta.rent_anio * 100)}%</span>
            </div>
          </div>
        </div>
        {equivalencia && <div className="pat-equiv">{equivalencia}</div>}

        <table className="data">
          <thead>
            <tr>
              <th>Posición</th>
              <th>Cantidad</th>
              <th>P. compra</th>
              <th>P. mercado</th>
              <th>Invertido</th>
              <th>Valor</th>
              <th>Retorno</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((p) => {
              const ret = (p.valor_mercado / p.invertido - 1) * 100;
              const pct = Math.round((p.valor_mercado / totVM) * 100);
              return (
                <tr key={p.id}>
                  <td className="pos-name">{p.ticker}</td>
                  <td className="num">{p.cantidad.toLocaleString("es-CL")}</td>
                  <td className="num">{p.precio_costo.toLocaleString("es-CL")}</td>
                  <td className="num">{p.precio_mercado.toLocaleString("es-CL")}</td>
                  <td className="num">{num(p.invertido)}</td>
                  <td className="num">{num(p.valor_mercado)}</td>
                  <td className={`num ${ret >= 0 ? "pos" : "neg"}`}>
                    {ret >= 0 ? "+" : ""}
                    {ret.toFixed(0)}%
                  </td>
                  <td className="num">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="alloc-bar">
          {sortedPositions.map((p) => (
            <div
              key={p.id}
              className="alloc-seg"
              style={{ width: `${(p.valor_mercado / totVM) * 100}%` }}
              title={`${p.ticker}: ${Math.round((p.valor_mercado / totVM) * 100)}%`}
            />
          ))}
        </div>
        <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: "0.85rem", color: "var(--muted)" }}>
          Invertido {num(totInv)} → valor {num(totVM)} ·{" "}
          <span style={{ color: "var(--accent-deep)", fontWeight: 600 }}>
            {retTotal >= 0 ? "+" : ""}
            {retTotal.toFixed(1)}% ({num(totVM - totInv)})
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={() => void analizarCartera()} disabled={cioLoading}>
            Análisis del CIO
          </button>
        </div>
        {cioLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                El CIO está revisando tu cartera<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Evaluando exposición, riesgo y oportunidades.</div>
          </div>
        )}
        {cioError && <div className="loading">{cioError}</div>}
        {cioResult && <div className="response-box">{cioResult}</div>}
      </div>

      <div className="panel">
        <h2>Briefing de mercado</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Lectura nivel CIO con datos actuales de fuentes públicas: macro global y Chile, oportunidades en renta
          variable y fija, y novedades de tus posiciones.
        </div>
        <button onClick={() => void briefingMercado()} disabled={briefLoading}>
          Generar briefing de hoy
        </button>
        {briefLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Preparando el briefing de hoy<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Buscando en fuentes públicas — puede tardar ~30s. Vale la pena.</div>
          </div>
        )}
        {brief && (
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 10 }}>
            {brief === lastBrief ? "Último briefing: " : "Generado el "}
            {new Date(brief.created_at).toLocaleString("es-CL")}
            {brief !== lastBrief && " · fuentes públicas vía búsqueda web"}
          </div>
        )}
        {briefError && <div className="loading">{briefError}</div>}
        {brief?.output_text && <FormattedResponse text={brief.output_text} headerRe={HEADER_RE_BRIEF} />}
      </div>

      <div className="panel">
        <h2>Resumen de tus noticias</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Pega una o varias noticias de tus diarios de finanzas y el CIO te las resume y analiza — solo ese material.
        </div>
        <textarea
          placeholder="Pega aquí una o varias noticias. Puedes juntar varias de distintos días o medios; te las resumo todas en una sola lectura."
          style={{ minHeight: 130 }}
          value={newsInput}
          onChange={(e) => setNewsInput(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <button onClick={() => void resumirNoticias()} disabled={newsLoading}>
            Resumir y analizar
          </button>{" "}
          <button className="text-action" onClick={limpiarNoticias}>
            Limpiar
          </button>
        </div>
        {newsLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Leyendo y sintetizando tus noticias<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Cruzando con tus posiciones.</div>
          </div>
        )}
        {newsError && <div className="empty-note">{newsError}</div>}
        {news?.output_text && <FormattedResponse text={news.output_text} headerRe={HEADER_RE_NEWS} />}
      </div>

      <div className="panel">
        <h2>Ideas para investigar</h2>
        <div className="page-sub" style={{ margin: "-6px 0 14px 0" }}>
          Puntos de partida para tu propia investigación — no recomendaciones. Ideas nuevas con alcance global, fuera
          de lo que ya tienes en cartera.
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 12 }}>
          Insumos que usaré:{" "}
          <span className={`src-chip ${briefForIdeas ? "on" : "off"}`}>{briefForIdeas ? "✓" : "○"} briefing</span>
          <span className={`src-chip ${newsForIdeas ? "on" : "off"}`}>{newsForIdeas ? "✓" : "○"} tus noticias</span>
          <span className="src-chip on">✓ tu cartera (como contexto)</span>
          <span className="src-chip on">✓ research global en vivo</span>
        </div>
        <button onClick={() => void generarIdeas()} disabled={ideasLoading}>
          Proponer ideas para investigar
        </button>
        {ideasLoading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Cruzando tus insumos y buscando ángulos<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Buscando ideas para investigar.</div>
          </div>
        )}
        {ideasError && <div className="loading">{ideasError}</div>}
        {ideas && (
          <>
            {ideas.map((idea, i) => (
              <div className="idea-card" key={i}>
                <div className="i-head">
                  <span className="i-num">0{i + 1}</span>
                  <span className="i-title">{idea.titulo ?? ""}</span>
                </div>
                <div className="i-field">
                  <span className="i-lbl">Por qué ahora</span>
                  {idea.porque ?? ""}
                </div>
                <div className="i-field task">
                  <span className="i-lbl">Tu tarea</span>
                  {idea.tarea ?? ""}
                </div>
                <div className="i-field risk">
                  <span className="i-lbl">El riesgo</span>
                  {idea.riesgo ?? ""}
                </div>
                {idea.origen && (
                  <div style={{ marginTop: 9 }}>
                    <span className="src-chip off">de: {idea.origen}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="ideas-disclaimer">
              Estas son ideas para investigar, no recomendaciones de inversión — cada una viene con la tarea que
              tendrías que hacer antes de decidir. No soy asesor financiero.
            </div>
          </>
        )}
      </div>
    </>
  );
}
