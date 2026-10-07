"use client";

import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  CalendarClock,
  CircleCheck,
  Equal,
  Layers,
  RefreshCw,
  Sparkle,
  TriangleAlert,
  Users,
} from "lucide-react";
import { compararHabilitantes, compararKpis, formatDelta, type HabilitanteComparado, type KpiComparado } from "@/lib/pmo";
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

function NovedadChip({ texto }: { texto: string }) {
  const t = texto.toLowerCase();
  if (/mantiene|sin cambio|igual/.test(t)) {
    return (
      <span className="pmo-chip igual-suave">
        <Equal size={13} aria-hidden="true" /> {texto}
      </span>
    );
  }
  if (/nuevo|nueva|incorpor/.test(t)) {
    return (
      <span className="pmo-chip mov">
        <Sparkle size={13} aria-hidden="true" /> {texto}
      </span>
    );
  }
  return (
    <span className="pmo-chip mov">
      <RefreshCw size={13} aria-hidden="true" /> {texto}
    </span>
  );
}

function HabilitanteRow({ c }: { c: HabilitanteComparado }) {
  const { h } = c;
  return (
    <div className="hab-row">
      <div className="hab-main">
        <div className="hab-nombre">{h.nombre}</div>
        <div className="hab-metas">
          {h.cantidad && <span className="hab-meta">{h.cantidad}</span>}
          {h.tramos && <span className="hab-meta">Tramos {h.tramos}</span>}
        </div>
      </div>
      <div className="hab-estado">
        {h.estado}
        {h.responsable && <div className="hab-resp">Responsable: {h.responsable}</div>}
      </div>
      <div className="hab-fecha">
        <div className="hab-fecha-lbl">Fecha estimada</div>
        <div className="hab-fecha-val">{h.fecha ?? "Sin fecha"}</div>
        <div className="hab-chips">
          {c.nuevo && (
            <span className="pmo-chip mov">
              <Sparkle size={13} aria-hidden="true" /> Nuevo esta semana
            </span>
          )}
          {c.cambios.map((x) => (
            <span className="pmo-chip cambio" key={x}>
              <ArrowRightLeft size={13} aria-hidden="true" /> {x}
            </span>
          ))}
          {h.novedad && <NovedadChip texto={h.novedad} />}
        </div>
      </div>
    </div>
  );
}

export function PanelPMO({ reportes, color }: { reportes: ReporteGuardado[]; color: string }) {
  if (!reportes.length) return null;
  const [actual, previo, ...antiguos] = reportes;
  const r = actual.report;
  const comparados = compararKpis(r, previo?.report ?? null);
  const grupos = [...new Set(comparados.map((c) => c.kpi.grupo))];
  const sinAvance = comparados.filter((c) => c.sinVariacion);
  const habilitantes = compararHabilitantes(r, previo?.report ?? null);
  const acciones = r.acciones ?? [];
  const porArea = [...new Set(acciones.map((a) => a.area))];

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

      {habilitantes.length > 0 && (
        <div className="pmo-bloque">
          <div className="pmo-grupo-lbl">
            <Layers size={13} aria-hidden="true" /> Habilitantes de la liberación de sitios
          </div>
          {habilitantes.map((c) => (
            <HabilitanteRow c={c} key={c.h.nombre} />
          ))}
        </div>
      )}

      {acciones.length > 0 && (
        <div className="pmo-bloque">
          <div className="pmo-grupo-lbl">
            <Users size={13} aria-hidden="true" /> Lo que la PMO pide a cada área
          </div>
          {porArea.map((area) => (
            <div className="acc-area" key={area}>
              <div className="acc-area-nombre">{area}</div>
              <ul>
                {acciones
                  .filter((a) => a.area === area)
                  .map((a, i) => (
                    <li key={i}>{a.texto}</li>
                  ))}
              </ul>
            </div>
          ))}
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
