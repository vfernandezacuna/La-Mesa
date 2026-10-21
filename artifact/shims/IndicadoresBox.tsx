import { useEffect, useState } from "react";
import { escribirFila, leerTabla } from "./supabase";
import { refrescar } from "./router";

const hoyStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => Math.round(n * 100) / 100;

// UF y dólar del día: en esta página no hay acceso a internet, así que se
// cargan a mano (una vez al día) y quedan guardados.
export function IndicadoresBox({ compacto = false }: { compacto?: boolean }) {
  const [uf, setUf] = useState("");
  const [dolar, setDolar] = useState("");
  const [guardado, setGuardado] = useState<{ as_of: string; uf: number; dolar: number } | null>(null);
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const filas = await leerTabla("market_indicators_cache");
        const ultima = [...filas].sort((a, b) => String(b.as_of).localeCompare(String(a.as_of)))[0];
        if (vivo && ultima?.uf) setGuardado({ as_of: ultima.as_of, uf: Number(ultima.uf), dolar: Number(ultima.dolar) });
      } catch {
        // sin datos guardados
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar() {
    const u = Number(uf.replace(/\./g, "").replace(",", "."));
    const d = Number(dolar.replace(/\./g, "").replace(",", "."));
    if (!(u > 1000 && u < 200000) || !(d > 100 && d < 5000)) {
      setMsg("Revisa los valores (UF ≈ 39.000, dólar ≈ 950).");
      return;
    }
    try {
      await escribirFila("market_indicators_cache", { as_of: hoyStr(), uf: u, dolar: d, fetched_at: new Date().toISOString() });
      setGuardado({ as_of: hoyStr(), uf: u, dolar: d });
      setEditando(false);
      setMsg(null);
      refrescar();
    } catch {
      setMsg("No se pudo guardar.");
    }
  }

  const vigente = guardado?.as_of === hoyStr();
  return (
    <div style={{ fontSize: compacto ? "0.76rem" : "0.9rem", marginBottom: compacto ? 12 : 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>UF y dólar</div>
      {guardado && !editando ? (
        <div>
          UF {fmt(guardado.uf).toLocaleString("es-CL")} · US$ {fmt(guardado.dolar).toLocaleString("es-CL")}
          <div style={{ color: vigente ? "var(--n700)" : "var(--amarillo-deep)" }}>
            {vigente ? "de hoy" : `del ${guardado.as_of} — actualiza`}
          </div>
        </div>
      ) : null}
      {editando || !guardado ? (
        <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
          <input id={`uf-${compacto ? "c" : "g"}`} type="text" inputMode="decimal" placeholder="UF de hoy" value={uf} onChange={(e) => setUf(e.target.value)} />
          <input id={`usd-${compacto ? "c" : "g"}`} type="text" inputMode="decimal" placeholder="Dólar observado" value={dolar} onChange={(e) => setDolar(e.target.value)} />
          <button className="btn-sm" onClick={() => void guardar()}>
            Guardar
          </button>
        </div>
      ) : (
        <button className="text-action" style={{ padding: "4px 0" }} onClick={() => setEditando(true)}>
          Actualizar
        </button>
      )}
      {msg && <div style={{ color: "var(--amarillo-deep)", marginTop: 4 }}>{msg}</div>}
    </div>
  );
}
