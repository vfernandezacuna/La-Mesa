import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearMensaje, textoDe } from "@/lib/anthropic-server";
import { indicadoresDelDiaSystemPrompt } from "@/lib/prompts";

// Valores razonables para descartar una respuesta corrupta.
const UF_RANGO = [20000, 80000];
const USD_RANGO = [400, 2500];
const enRango = (v: unknown, [min, max]: number[]) => typeof v === "number" && v >= min && v <= max;

// Fuente oficial gratuita (datos del Banco Central publicados por
// mindicador.cl): UF del día y dólar observado.
async function desdeMindicador(): Promise<{ uf: number; dolar: number } | null> {
  try {
    const res = await fetch("https://mindicador.cl/api", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { uf?: { valor?: number }; dolar?: { valor?: number } };
    const uf = data.uf?.valor;
    const dolar = data.dolar?.valor;
    return enRango(uf, UF_RANGO) && enRango(dolar, USD_RANGO) ? { uf: uf as number, dolar: dolar as number } : null;
  } catch {
    return null;
  }
}

// Respaldo: Claude con búsqueda web (cuesta tokens + búsquedas).
async function desdeClaude(fecha: string): Promise<{ uf: number; dolar: number } | null> {
  try {
    const res = await crearMensaje({
      system: indicadoresDelDiaSystemPrompt(),
      messages: [
        { role: "user", content: `Fecha de hoy: ${fecha}. Dame el valor de la UF y del dólar observado de hoy en Chile.` },
      ],
      maxTokens: 400,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
      effort: "low",
    });
    const raw = textoDe(res.content);
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { uf?: number; usd?: number };
    return enRango(parsed.uf, UF_RANGO) && enRango(parsed.usd, USD_RANGO)
      ? { uf: parsed.uf as number, dolar: parsed.usd as number }
      : null;
  } catch {
    return null;
  }
}

// GET /api/indicadores?fecha=YYYY-MM-DD[&refresh=1]
// La fecha la manda el navegador (hora de Chile; el servidor corre en UTC).
// Sin refresh, devuelve lo guardado para ese día si existe.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fecha = url.searchParams.get("fecha") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const refresh = url.searchParams.get("refresh") === "1";

  if (!refresh) {
    const { data } = await supabase.from("market_indicators_cache").select("*").eq("as_of", fecha).maybeSingle();
    if (data) return NextResponse.json({ ...data, fuente: "guardado" });
  }

  let fuente = "mindicador";
  let valores = await desdeMindicador();
  if (!valores) {
    fuente = "claude";
    valores = await desdeClaude(fecha);
  }
  if (!valores) {
    return NextResponse.json({ error: "No se pudo obtener la UF y el dólar de hoy." }, { status: 502 });
  }

  const row = { user_id: user.id, as_of: fecha, uf: valores.uf, dolar: valores.dolar, fetched_at: new Date().toISOString() };
  await supabase.from("market_indicators_cache").upsert(row, { onConflict: "user_id,as_of" });
  return NextResponse.json({ ...row, fuente });
}
