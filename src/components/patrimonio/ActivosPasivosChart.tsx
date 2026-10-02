"use client";

import { useEffect, useRef, useState } from "react";

export type SerieKey = "activos" | "pasivos" | "inmobiliaria" | "financiera";

export interface ChartRow {
  id: string;
  label: string;
  values: Record<SerieKey, number>;
}

interface Serie {
  key: SerieKey;
  name: string;
  color: string;
  width: number;
  dash?: string;
}

// Activos y pasivos totales son las dos líneas fuertes; inmobiliaria y
// financiera van punteadas como secundarias. Los cuatro colores pasan la
// validación todos-contra-todos (incluida visión de colores alterada).
const SERIES: Serie[] = [
  { key: "activos", name: "Activos totales", color: "#008300", width: 3.25 },
  { key: "pasivos", name: "Pasivos totales", color: "#4a3aa7", width: 3.25 },
  { key: "inmobiliaria", name: "Inversión Inmobiliaria", color: "#2a78d6", width: 1.75, dash: "6 4" },
  { key: "financiera", name: "Inversión Financiera", color: "#eda100", width: 1.75, dash: "6 4" },
];

const H = 300;
const TOP = 14;
const BOTTOM = 30;
const LEFT = 70;

function mm(n: number): string {
  return "$" + Math.round(n / 1e6).toLocaleString("es-CL") + " MM";
}

function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = [1, 2, 2.5, 5, 10].find((c) => c * p >= raw) ?? 10;
  return m * p;
}

function crecimiento(a: number, b: number): string {
  if (!a) return "—";
  const pct = (b / a - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toLocaleString("es-CL", { maximumFractionDigits: 0 })}%`;
}

function LegendSwatch({ color, width, dash }: { color: string; width: number; dash?: string }) {
  return (
    <svg width="22" height="10" aria-hidden="true">
      <line x1="1" x2="21" y1="5" y2="5" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

export function ActivosPasivosChart({ rows }: { rows: ChartRow[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (rows.length < 2) {
    return <div className="empty-note">Necesitas al menos dos trimestres cargados para ver la evolución.</div>;
  }

  const n = rows.length;
  const showLabels = w >= 560;
  const right = showLabels ? 170 : 14;
  const plotW = Math.max(120, w - LEFT - right);
  const plotH = H - TOP - BOTTOM;

  const max = Math.max(...rows.flatMap((r) => SERIES.map((s) => r.values[s.key])), 1);
  const step = niceStep(max, 4);
  const yMax = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const x = (i: number) => LEFT + (i / (n - 1)) * plotW;
  const y = (v: number) => TOP + plotH - (v / yMax) * plotH;

  const maxXLabels = Math.max(2, Math.floor(plotW / 58));
  const xStep = Math.ceil(n / maxXLabels);

  // Etiquetas directas al final de cada línea, separadas para que no se pisen.
  const endLabels = SERIES.map((s) => ({ ...s, y: y(rows[n - 1].values[s.key]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    endLabels[i].y = Math.max(endLabels[i].y, endLabels[i - 1].y + 15);
  }
  const overflow = endLabels[endLabels.length - 1].y - (TOP + plotH);
  if (overflow > 0) endLabels.forEach((l) => (l.y -= overflow));

  const first = rows[0];
  const last = rows[n - 1];
  const neto = (r: ChartRow) => r.values.activos - r.values.pasivos;

  // Banda entre activos y pasivos = patrimonio neto.
  const banda =
    rows.map((r, i) => `${x(i)},${y(r.values.activos)}`).join(" ") +
    " " +
    [...rows]
      .map((r, i) => ({ r, i }))
      .reverse()
      .map(({ r, i }) => `${x(i)},${y(r.values.pasivos)}`)
      .join(" ");
  const iBanda = Math.max(0, Math.round((n - 1) * 0.7));
  const yAct = y(rows[iBanda].values.activos);
  const yPas = y(rows[iBanda].values.pasivos);
  const ySec = SERIES.filter((s) => s.dash).map((s) => y(rows[iBanda].values[s.key]));
  // Rótulo de la banda donde no pise una línea secundaria.
  const yBanda = [yAct + 18, yPas - 10, (yAct + yPas) / 2].find(
    (c) => c > yAct + 12 && c < yPas - 4 && ySec.every((ys) => Math.abs(ys - (c - 4)) > 11),
  );
  const bandaVisible = showLabels && yBanda !== undefined;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - box.left;
    const idx = Math.round(((px - LEFT) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  }

  const hx = hover !== null ? x(hover) : 0;
  const tipW = Math.min(300, w);
  const tipLeft =
    hover !== null ? Math.max(0, Math.min(w - tipW, hx + 14 + tipW > w ? hx - 14 - tipW : hx + 14)) : 0;

  return (
    <>
      <div className="ap-headline">
        Desde {first.label}: activos <b>{crecimiento(first.values.activos, last.values.activos)}</b> · pasivos{" "}
        <b>{crecimiento(first.values.pasivos, last.values.pasivos)}</b> · patrimonio neto{" "}
        <b>{crecimiento(neto(first), neto(last))}</b>
      </div>

      <div className="ap-legend">
        {SERIES.map((s) => (
          <span className="ap-leg" key={s.key}>
            <LegendSwatch color={s.color} width={s.width} dash={s.dash} />
            {s.name}
          </span>
        ))}
        <span className="ap-leg">
          <span className="ap-band-swatch" aria-hidden="true" />
          Patrimonio neto
        </span>
      </div>

      <div className="ap-wrap" ref={wrapRef}>
        <svg
          width={w}
          height={H}
          role="img"
          aria-label={`Evolución de activos y pasivos de ${first.label} a ${last.label}`}
          style={{ display: "block", overflow: "visible" }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? "ap-base" : "ap-grid"} />
              <text x={LEFT - 10} y={y(t) + 4} textAnchor="end" className="ap-tick">
                {mm(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) =>
            (n - 1 - i) % xStep === 0 ? (
              <text key={r.id} x={x(i)} y={H - 8} textAnchor="middle" className="ap-tick">
                {r.label}
              </text>
            ) : null,
          )}

          <polygon points={banda} fill="#008300" opacity={0.08} />
          {bandaVisible && (
            <text x={x(iBanda)} y={yBanda} textAnchor="middle" className="ap-band-lbl">
              Patrimonio neto
            </text>
          )}

          {hover !== null && <line x1={hx} x2={hx} y1={TOP} y2={TOP + plotH} className="ap-cross" />}

          {[...SERIES].reverse().map((s) => (
            <polyline
              key={s.key}
              points={rows.map((r, i) => `${x(i)},${y(r.values[s.key])}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {SERIES.map((s) => {
            const i = hover ?? n - 1;
            return (
              <circle
                key={s.key}
                cx={x(i)}
                cy={y(rows[i].values[s.key])}
                r={s.dash ? 3.5 : 5}
                fill={s.color}
                stroke="var(--paper)"
                strokeWidth={2}
              />
            );
          })}

          {showLabels &&
            endLabels.map((l) => (
              <g key={l.key}>
                <line
                  x1={LEFT + plotW + 10}
                  x2={LEFT + plotW + 22}
                  y1={l.y}
                  y2={l.y}
                  stroke={l.color}
                  strokeWidth={2.5}
                  strokeDasharray={l.dash ? "4 3" : undefined}
                />
                <text x={LEFT + plotW + 27} y={l.y + 4} className="ap-end">
                  {l.name}
                </text>
              </g>
            ))}

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

        {hover !== null && (
          <div className="ap-tip" style={{ left: tipLeft, top: TOP, width: tipW }}>
            <div className="ap-tip-head">{rows[hover].label}</div>
            <div className="ap-tip-row ap-tip-neto">
              <span className="ap-band-swatch" aria-hidden="true" />
              <span className="ap-tip-name">Patrimonio neto</span>
              <span className="ap-tip-val">{mm(neto(rows[hover]))}</span>
            </div>
            {SERIES.map((s) => (
              <div className="ap-tip-row" key={s.key}>
                <LegendSwatch color={s.color} width={s.width} dash={s.dash} />
                <span className="ap-tip-name">{s.name}</span>
                <span className="ap-tip-val">{mm(rows[hover].values[s.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="pat-hist" style={{ marginTop: 14 }}>
        <summary>Ver los datos del gráfico</summary>
        <div style={{ overflowX: "auto" }}>
          <table className="pat-table">
            <thead>
              <tr>
                <th>Período</th>
                {SERIES.map((s) => (
                  <th key={s.key}>{s.name}</th>
                ))}
                <th>Patrimonio neto</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.id}>
                  <td className="pt-per">{r.label}</td>
                  {SERIES.map((s) => (
                    <td key={s.key}>{mm(r.values[s.key])}</td>
                  ))}
                  <td>{mm(neto(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
