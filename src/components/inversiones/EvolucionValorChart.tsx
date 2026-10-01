"use client";

import { useEffect, useRef, useState } from "react";
import { fechaCorta } from "@/lib/date";
import type { PortfolioHistoryPoint } from "./InversionesView";

const H = 230;
const TOP = 12;
const BOTTOM = 26;
const LEFT = 66;
const DAY = 86400000;
const VALOR_COLOR = "#2a78d6";
const CAPITAL_COLOR = "#6b6a67";

function mm(n: number): string {
  return "$" + (n / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " MM";
}
function pct(n: number, dec = 1): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
}
function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = [1, 2, 2.5, 5, 10].find((c) => c * p >= raw) ?? 10;
  return m * p;
}
function ts(fecha: string): number {
  return new Date(fecha + "T00:00:00").getTime();
}
function fechaLarga(fecha: string): string {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", { month: "short", year: "numeric" });
}

// Rentabilidad encadenada por período, descontando aportes de capital (el
// aporte de cada período se resta del valor final), igual que la planilla.
function rendimiento(h: PortfolioHistoryPoint[]) {
  let indice = 1;
  const porPeriodo: (number | null)[] = [null];
  for (let i = 1; i < h.length; i++) {
    const aporte = h[i].capital - h[i - 1].capital;
    const r = h[i - 1].valor > 0 ? (h[i].valor - aporte) / h[i - 1].valor - 1 : null;
    if (r !== null) indice *= 1 + r;
    porPeriodo.push(r);
  }
  const anios = (ts(h[h.length - 1].fecha) - ts(h[0].fecha)) / (365.25 * DAY);
  const total = indice - 1;
  const cagr = anios >= 0.75 ? Math.pow(indice, 1 / anios) - 1 : null;
  return { total, cagr, anios, porPeriodo };
}

export function EvolucionValorChart({ history }: { history: PortfolioHistoryPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(680);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = history.filter((p) => p.valor > 0);
  if (h.length < 2) {
    return (
      <div className="ev-empty">
        La evolución y la CAGR aparecen cuando haya al menos dos fechas registradas — se guarda una cada vez que
        apretás Actualizar.
      </div>
    );
  }

  const { total, cagr, anios, porPeriodo } = rendimiento(h);
  const last = h[h.length - 1];
  const first = h[0];
  const n = h.length;

  const showLabels = w >= 520;
  const right = showLabels ? 118 : 12;
  const plotW = Math.max(120, w - LEFT - right);
  const plotH = H - TOP - BOTTOM;
  const t0 = ts(first.fecha);
  const t1 = ts(last.fecha);
  const x = (fecha: string) => LEFT + ((ts(fecha) - t0) / Math.max(DAY, t1 - t0)) * plotW;
  const max = Math.max(...h.map((p) => Math.max(p.valor, p.capital)), 1);
  const step = niceStep(max, 4);
  const yMax = Math.ceil(max / step) * step;
  const y = (v: number) => TOP + plotH - (v / yMax) * plotH;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const years: number[] = [];
  for (let yr = new Date(t0).getFullYear() + 1; yr <= new Date(t1).getFullYear(); yr++) years.push(yr);

  const valorPts = h.map((p) => `${x(p.fecha)},${y(p.valor)}`).join(" ");
  const area = `${x(first.fecha)},${y(0)} ${valorPts} ${x(last.fecha)},${y(0)}`;
  // Capital aportado como escalón: se mantiene hasta la fecha del aporte.
  const capitalPts = h
    .map((p, i) => (i === 0 ? `${x(p.fecha)},${y(p.capital)}` : `${x(p.fecha)},${y(h[i - 1].capital)} ${x(p.fecha)},${y(p.capital)}`))
    .join(" ");

  let yValLbl = y(last.valor);
  let yCapLbl = y(last.capital);
  if (Math.abs(yValLbl - yCapLbl) < 16) {
    if (yValLbl <= yCapLbl) yCapLbl = yValLbl + 16;
    else yValLbl = yCapLbl + 16;
  }

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    h.forEach((p, i) => {
      if (Math.abs(x(p.fecha) - px) < Math.abs(x(h[best].fecha) - px)) best = i;
    });
    setHover(best);
  }

  const hp = hover !== null ? h[hover] : null;
  const hx = hp ? x(hp.fecha) : 0;
  const tipW = 210;
  const tipLeft = hp ? (hx + 14 + tipW > w ? hx - 14 - tipW : hx + 14) : 0;

  return (
    <div className="ev-block">
      <div className="ev-stats">
        <div className="ev-stat main">
          <span className="ev-l">{cagr !== null ? "CAGR" : "Retorno del período"}</span>
          <span className="ev-v">{pct(cagr ?? total)}</span>
          <span className="ev-s">
            {cagr !== null ? "anual compuesto, " : ""}
            {fechaLarga(first.fecha)} → {fechaLarga(last.fecha)}
          </span>
        </div>
        <div className="ev-stat">
          <span className="ev-l">Retorno acumulado</span>
          <span className="ev-v">{pct(total, 0)}</span>
          <span className="ev-s">desde {fechaLarga(first.fecha)}, sin contar aportes</span>
        </div>
        <div className="ev-stat">
          <span className="ev-l">Valor / capital</span>
          <span className="ev-v">
            ×{last.capital > 0 ? (last.valor / last.capital).toLocaleString("es-CL", { maximumFractionDigits: 2 }) : "—"}
          </span>
          <span className="ev-s">
            {mm(last.valor)} sobre {mm(last.capital)}
          </span>
        </div>
      </div>
      {cagr === null && (
        <div className="ev-note">La CAGR se muestra cuando la historia cubre al menos 9 meses ({anios < 0.1 ? "hoy" : `hoy ${Math.round(anios * 12)} meses`}).</div>
      )}

      <div className="ap-legend" style={{ marginTop: 12 }}>
        <span className="ap-leg">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" x2="21" y1="5" y2="5" stroke={VALOR_COLOR} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Valor de la cartera (incluye caja)
        </span>
        <span className="ap-leg">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" x2="21" y1="5" y2="5" stroke={CAPITAL_COLOR} strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
          </svg>
          Capital aportado
        </span>
      </div>

      <div className="ap-wrap" ref={wrapRef}>
        <svg width={w} height={H} role="img" aria-label={`Valor de la cartera de ${mm(first.valor)} a ${mm(last.valor)}`} style={{ display: "block", overflow: "visible" }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? "ap-base" : "ap-grid"} />
              <text x={LEFT - 10} y={y(t) + 4} textAnchor="end" className="ap-tick">
                {mm(t)}
              </text>
            </g>
          ))}
          {years.map((yr) => {
            const tx = LEFT + ((new Date(yr, 0, 1).getTime() - t0) / Math.max(DAY, t1 - t0)) * plotW;
            return (
              <g key={yr}>
                <line x1={tx} x2={tx} y1={TOP + plotH} y2={TOP + plotH + 5} className="ap-base" />
                <text x={tx} y={H - 6} textAnchor="middle" className="ap-tick">
                  {yr}
                </text>
              </g>
            );
          })}

          <polygon points={area} fill={VALOR_COLOR} opacity={0.1} />
          <polyline points={capitalPts} fill="none" stroke={CAPITAL_COLOR} strokeWidth={2} strokeDasharray="6 4" />
          <polyline points={valorPts} fill="none" stroke={VALOR_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {hp && <line x1={hx} x2={hx} y1={TOP} y2={TOP + plotH} className="ap-cross" />}
          {h.map((p, i) => (
            <circle
              key={p.fecha}
              cx={x(p.fecha)}
              cy={y(p.valor)}
              r={hover === i || (hover === null && i === n - 1) ? 5 : 3.5}
              fill={VALOR_COLOR}
              stroke="var(--paper)"
              strokeWidth={2}
            />
          ))}

          {showLabels && (
            <>
              <text x={LEFT + plotW + 12} y={yValLbl + 4} className="ap-end">
                Valor {mm(last.valor)}
              </text>
              <text x={LEFT + plotW + 12} y={yCapLbl + 4} className="ap-end">
                Capital {mm(last.capital)}
              </text>
            </>
          )}

          <rect
            x={LEFT - 10}
            y={TOP}
            width={plotW + 20}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hp && hover !== null && (
          <div className="ap-tip" style={{ left: tipLeft, top: TOP, width: tipW }}>
            <div className="ap-tip-head">{fechaCorta(hp.fecha)} {hp.fecha.slice(0, 4)}</div>
            <div className="ap-tip-row">
              <span className="ap-tip-name">Valor</span>
              <span className="ap-tip-val">{mm(hp.valor)}</span>
            </div>
            <div className="ap-tip-row">
              <span className="ap-tip-name">Capital aportado</span>
              <span className="ap-tip-val">{mm(hp.capital)}</span>
            </div>
            {porPeriodo[hover] !== null && (
              <div className="ap-tip-row">
                <span className="ap-tip-name">Retorno del período</span>
                <span className="ap-tip-val">{pct(porPeriodo[hover]!)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <details className="pat-hist" style={{ marginTop: 10 }}>
        <summary>Ver los datos</summary>
        <table className="pat-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Valor</th>
              <th>Capital</th>
              <th>Retorno del período</th>
            </tr>
          </thead>
          <tbody>
            {[...h].reverse().map((p) => {
              const i = h.indexOf(p);
              return (
                <tr key={p.fecha}>
                  <td className="pt-per">
                    {fechaCorta(p.fecha)} {p.fecha.slice(0, 4)}
                  </td>
                  <td>{mm(p.valor)}</td>
                  <td>{mm(p.capital)}</td>
                  <td>{porPeriodo[i] === null ? "—" : pct(porPeriodo[i]!)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
