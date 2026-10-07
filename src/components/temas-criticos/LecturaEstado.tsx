"use client";

import { useState } from "react";
import { ArrowRight, Pencil, RefreshCw, TriangleAlert } from "lucide-react";
import { fechaCorta } from "@/lib/date";

interface Frente {
  name: string;
  text: string;
}

interface Lectura {
  frase: string | null;
  frentes: Frente[];
  situacion: string;
  cambio: string;
  riesgos: string[];
  pasos: string[];
}

type Seccion = "frase" | "frentes" | "situacion" | "cambio" | "riesgos" | "pasos";

const HEADER_RE = /^\s*(EN UNA FRASE|ESTADO POR FRENTE|SITUACI[ÓO]N ACTUAL|QU[ÉE] CAMBI[ÓO]|RIESGOS(?: Y PENDIENTES| SEG[ÚU]N EL MATERIAL)?|PR[ÓO]XIMOS PASOS(?: QUE MENCIONA EL MATERIAL)?)\s*:\s*(.*)$/i;
const BULLET_RE = /^\s*(?:[•\-–*]|\d+[.)])\s*/;

// Acepta el formato nuevo (EN UNA FRASE / prosa) y el anterior (bullets con
// RIESGOS Y PENDIENTES), para que las lecturas ya guardadas se sigan viendo.
function parseLectura(text: string): Lectura {
  let frase: string | null = null;
  const frentes: Frente[] = [];
  const situacion: string[] = [];
  const cambio: string[] = [];
  const riesgos: string[] = [];
  const pasos: string[] = [];
  let seccion: Seccion | null = null;

  for (const raw of text.replace(/\*\*/g, "").split(/\n/)) {
    let line = raw;
    const m = raw.match(HEADER_RE);
    if (m) {
      const h = m[1].toUpperCase();
      seccion = h.startsWith("EN UNA")
        ? "frase"
        : h.startsWith("ESTADO")
          ? "frentes"
          : h.startsWith("SITUACI")
          ? "situacion"
          : h.startsWith("QU")
            ? "cambio"
            : h.startsWith("RIESGO")
              ? "riesgos"
              : "pasos";
      line = m[2];
    }
    const clean = line.replace(BULLET_RE, "").trim();
    if (!clean) continue;
    if (seccion === "frase") frase = frase ? `${frase} ${clean}` : clean;
    else if (seccion === "frentes") {
      const i = clean.indexOf(":");
      if (i > 0 && i < 48) frentes.push({ name: clean.slice(0, i).trim(), text: clean.slice(i + 1).trim() });
      else if (frentes.length) frentes[frentes.length - 1].text += ` ${clean}`;
    }
    else if (seccion === "cambio") cambio.push(clean);
    else if (seccion === "riesgos") riesgos.push(clean);
    else if (seccion === "pasos") pasos.push(clean);
    else situacion.push(clean);
  }
  return { frase, frentes, situacion: situacion.join(" "), cambio: cambio.join(" "), riesgos, pasos };
}

function haceCuanto(iso: string): string {
  const dias = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

export function LecturaEstado({
  text,
  color,
  updatedAt,
  canRefresh,
  loading,
  onRefresh,
  frentes,
  onSaveFrentes,
}: {
  frentes: string[];
  onSaveFrentes: (frentes: string[]) => Promise<void>;
  text: string | null;
  color: string;
  updatedAt: string | null;
  canRefresh: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const l = text ? parseLectura(text) : null;
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Si la lectura aún no trae el estado de un frente, se muestra el nombre vacío.
  const filas: Frente[] = frentes.map((name) => {
    const clave = name.toLowerCase();
    const hallado = l?.frentes.find((f) => f.name.toLowerCase() === clave);
    return hallado ?? { name, text: "" };
  });

  async function guardarFrentes() {
    setGuardando(true);
    try {
      const lista = borrador
        .split(/[\n;,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      await onSaveFrentes(lista);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="topic-card" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="hm-head" style={{ marginBottom: 16 }}>
        <div>
          <h2>Lectura de estado</h2>
          {updatedAt && (
            <div className="hm-sub">
              Actualizada el {fechaCorta(updatedAt)} · {haceCuanto(updatedAt)}
            </div>
          )}
        </div>
        {canRefresh && (
          <button className="ghost btn-icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" />
            Actualizar lectura
          </button>
        )}
      </div>


      <div className="frentes">
        <div className="frentes-head">
          <span className="frentes-lbl">Estado por frente</span>
          {!editando && (
            <button
              className="text-action as-edit"
              onClick={() => {
                setBorrador(frentes.join("\n"));
                setEditando(true);
              }}
            >
              <Pencil size={12} aria-hidden="true" /> {frentes.length ? "Editar frentes" : "Definir frentes"}
            </button>
          )}
        </div>
        {editando && (
          <div style={{ marginBottom: 10 }}>
            <textarea
              rows={Math.max(3, frentes.length + 1)}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="Un frente por línea — ej: GTA"
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn-sm" onClick={() => void guardarFrentes()} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              <button className="ghost btn-sm" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        {!editando && filas.length === 0 && (
          <div className="empty-note">
            Definí los contratos o líneas de trabajo de este tema y verás una línea de estado de cada uno.
          </div>
        )}
        {!editando &&
          filas.map((f) => (
            <div className="frente-row" key={f.name}>
              <span className="frente-name">{f.name}</span>
              <span className={`frente-text ${f.text ? "" : "vacio"}`}>
                {f.text || "Se completa al actualizar la lectura."}
              </span>
            </div>
          ))}
      </div>

      {loading && (
        <div className="ai-loading" style={{ display: "block", marginBottom: 14 }}>
          <div className="ail-head">
            <span className="ail-spin"></span>
            <span>
              Actualizando la lectura<span className="ail-dots"></span>
            </span>
          </div>
          <div className="ail-sub">Releyendo todo el historial del tema.</div>
        </div>
      )}

      {!l ? (
        <div className="empty-note">Aún no hay una lectura — agregá una nota o material para generarla.</div>
      ) : (
        <>
          {l.frase && (
            <div className="lect-frase" style={{ borderLeftColor: color }}>
              {l.frase}
            </div>
          )}
          {l.situacion && <p className="lect-situacion">{l.situacion}</p>}
          {l.cambio && (
            <div className="as-cambio" style={{ marginBottom: 14 }}>
              <span className="as-cambio-lbl">Qué cambió</span> {l.cambio}
            </div>
          )}
          {(l.riesgos.length > 0 || l.pasos.length > 0) && (
            <div className="lect-cols">
              {l.riesgos.length > 0 && (
                <div className="lect-col riesgos">
                  <div className="lect-col-head">
                    <TriangleAlert size={15} aria-hidden="true" />
                    Riesgos según el material
                  </div>
                  {l.riesgos.map((r, i) => (
                    <div className="lect-item" key={i}>
                      <span className="lect-num">{i + 1}</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
              {l.pasos.length > 0 && (
                <div className="lect-col pasos">
                  <div className="lect-col-head">
                    <ArrowRight size={15} aria-hidden="true" />
                    Próximos pasos que menciona el material
                  </div>
                  {l.pasos.map((p, i) => (
                    <div className="lect-item" key={i}>
                      <span className="lect-num">{i + 1}</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
