"use client";

import { ArrowDownRight, ArrowUpRight, CalendarClock, CircleCheck, Equal, TriangleAlert } from "lucide-react";
import { compararKpis, formatDelta, type KpiComparado } from "@/lib/pmo";
import { fechaCorta } from "@/lib/date";
import type { CriticalTopicEntry, PmoReport } from "@/lib/types";

interface ReporteGuardado {
  entry: CriticalTopicEntry;
  report: PmoReport;
}

function fechaDe(r: ReporteGuardado): string {
  return r.report.fecha_reporte ?? r.entry.created_at;
}

function Variacion({ c }: { c: KpiComparado }) {
  if (c.anterior == null) return <span className="pmo-chip nuevo">Nuevo</span>;
  if (c.sinVariacion) {
    return (
      <span className="pmo-chip igual">
        <Equal size={13} aria-hidden="true" /> Sin variación
      </span>
    );
  }
  if (c.delta == null) return <span className="pmo-chip">Antes: {c.anterior}</span>;
  const Icon = c.delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="pmo-chip mov" title={`Antes: ${c.anterior}`}>
      <Icon size={13} aria-hidden="true" /> {formatDelta(c.delta, c.kpi.unidad)}
    </span>
  );
}

export function PanelPMO({ reportes, color }: { reportes: ReporteGuardado[]; color: string }) {
  if (!reportes.length) return null;
  const [actual, previo, ...antiguos] = reportes;
  const r = actual.report;
  const comparados = compararKpis(r, previo?.report ?? null);
  const grupos = [...new Set(comparados.map((c) => c.kpi.grupo))];
  const sinAvance = comparados.filter((c) => c.sinVariacion);

  return (
    <div className="topic-card pmo" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="hm-head" style={{ marginBottom: 14 }}>
        <div>
          <h2>Reporte semanal PMO</h2>
          <div className="hm-sub">
            Corte al {fechaCorta(fechaDe(actual))}
            {previo ? ` · comparado con el del ${fechaCorta(fechaDe(previo))}` : " · primer reporte cargado"}
          </div>
        </div>
      </div>

      {r.titular && (
        <div className="lect-frase" style={{ borderLeftColor: color }}>
          {r.titular}
        </div>
      )}

      {grupos.map((g) => (
        <div className="pmo-grupo" key={g}>
          <div className="pmo-grupo-lbl">{g}</div>
          <div className="pmo-tiles">
            {comparados
              .filter((c) => c.kpi.grupo === g)
              .map((c) => (
                <div className="pmo-tile" key={`${c.kpi.grupo}|${c.kpi.nombre}`}>
                  <div className="pmo-tile-nombre">{c.kpi.nombre}</div>
                  <div className="pmo-tile-valor">{c.kpi.valor}</div>
                  <Variacion c={c} />
                </div>
              ))}
          </div>
        </div>
      ))}

      {(r.highlights.length > 0 || r.criticos.length > 0 || sinAvance.length > 0) && (
        <div className="lect-cols" style={{ marginTop: 16 }}>
          {r.highlights.length > 0 && (
            <div className="lect-col pasos">
              <div className="lect-col-head">
                <CircleCheck size={15} aria-hidden="true" />
                Highlights
              </div>
              {r.highlights.map((h, i) => (
                <div className="lect-item" key={i}>
                  <span className="lect-num">{i + 1}</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}
          {(r.criticos.length > 0 || sinAvance.length > 0) && (
            <div className="lect-col riesgos">
              <div className="lect-col-head">
                <TriangleAlert size={15} aria-hidden="true" />
                Crítico según el reporte
              </div>
              {r.criticos.map((c, i) => (
                <div className="lect-item" key={i}>
                  <span className="lect-num">{i + 1}</span>
                  <span>
                    {c.texto}
                    {c.origen && <span className="pmo-origen"> ({c.origen})</span>}
                  </span>
                </div>
              ))}
              {sinAvance.length > 0 && (
                <div className="pmo-sinavance">
                  <b>Sin variación vs. el reporte anterior:</b> {sinAvance.map((c) => `${c.kpi.grupo} · ${c.kpi.nombre}`).join("; ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {r.hitos.length > 0 && (
        <div className="pmo-hitos">
          <div className="pmo-grupo-lbl">
            <CalendarClock size={13} aria-hidden="true" /> Próximos hitos que menciona el reporte
          </div>
          {r.hitos.map((h, i) => (
            <div className="pmo-hito" key={i}>
              <span className="pmo-hito-fecha">{h.fecha ? fechaCorta(h.fecha) : "Sin fecha"}</span>
              <span>
                {h.texto}
                {h.responsable && <span className="pmo-origen"> · {h.responsable}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {previo && (
        <details className="historial">
          <summary>Reportes anteriores ({reportes.length - 1})</summary>
          {[previo, ...antiguos].map((x) => (
            <details className="historial-item" key={x.entry.id}>
              <summary>
                {fechaCorta(fechaDe(x))}
                {x.report.titular ? ` · ${x.report.titular}` : ""}
              </summary>
              <div className="historial-body">
                {x.report.kpis.map((k) => (
                  <div className="pmo-hist-kpi" key={`${k.grupo}|${k.nombre}`}>
                    <span>
                      {k.grupo} · {k.nombre}
                    </span>
                    <b>{k.valor}</b>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </details>
      )}
    </div>
  );
}
