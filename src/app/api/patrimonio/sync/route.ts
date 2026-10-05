import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSheetCsv, parseSheetCsv } from "@/lib/google-sheets";
import { parsePatrimonioSheet } from "@/lib/parse-patrimonio-sheet";
import { fetchPatrimonioQuarters } from "@/lib/fetch-patrimonio";
import type { PatrimonioClassCode } from "@/lib/types";

const ACTIVOS: PatrimonioClassCode[] = ["corrientes", "retiro", "inversion", "inmueble", "mueble"];
const PASIVOS: PatrimonioClassCode[] = ["corrientes_p", "nocorrientes_p"];

function mismosTotales(a: Partial<Record<PatrimonioClassCode, number>>, b: Partial<Record<PatrimonioClassCode, number>>) {
  return [...ACTIVOS, ...PASIVOS].every((k) => Math.round(a[k] ?? 0) === Math.round(b[k] ?? 0));
}

// Lee la hoja "Balance" de la planilla de patrimonio configurada en
// portfolio_sources (portfolio_key 'patrimonio') y reemplaza, trimestre a
// trimestre, los totales por clase y su detalle. Devuelve qué cambió y los
// trimestres ya actualizados.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const sourceRes = await supabase
    .from("portfolio_sources")
    .select("spreadsheet_id, gid")
    .eq("portfolio_key", "patrimonio")
    .maybeSingle();
  if (sourceRes.error || !sourceRes.data) {
    return NextResponse.json(
      { error: "Falta configurar la planilla de patrimonio (portfolio_sources, clave 'patrimonio')." },
      { status: 404 },
    );
  }
  const source = sourceRes.data as { spreadsheet_id: string; gid: string | null };

  let parsed;
  try {
    const csv = await fetchSheetCsv(source.spreadsheet_id, source.gid ?? undefined);
    parsed = parsePatrimonioSheet(parseSheetCsv(csv));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo leer la planilla." },
      { status: 502 },
    );
  }
  if (!parsed.length) {
    return NextResponse.json(
      { error: 'No encontré trimestres en la hoja. ¿Sigue siendo "Balance" la primera pestaña?' },
      { status: 422 },
    );
  }

  const existentes = await fetchPatrimonioQuarters(supabase);
  const nuevos: string[] = [];
  const actualizados: string[] = [];
  const avisos: string[] = [];

  for (const q of parsed) {
    const etiqueta = `${q.quarter} ${q.year}`;
    const activos = ACTIVOS.reduce((s, k) => s + (q.totals[k] ?? 0), 0);
    const pasivos = PASIVOS.reduce((s, k) => s + (q.totals[k] ?? 0), 0);
    if (Math.abs(activos - q.activosHoja) > 1 || Math.abs(pasivos - q.pasivosHoja) > 1) {
      avisos.push(`${etiqueta}: los subtotales no suman los totales de la planilla.`);
    }

    const previo = existentes.find((e) => e.year === q.year && e.quarter === q.quarter);
    let quarterId = previo?.id;
    if (!quarterId) {
      const { data, error } = await supabase
        .from("patrimonio_quarters")
        .insert({ user_id: user.id, year: q.year, quarter: q.quarter })
        .select("id")
        .single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "No se pudo crear el trimestre." }, { status: 500 });
      }
      quarterId = data.id as string;
      nuevos.push(etiqueta);
    } else if (previo && !mismosTotales(previo.totals, q.totals)) {
      actualizados.push(etiqueta);
    }

    await supabase.from("patrimonio_class_totals").delete().eq("quarter_id", quarterId);
    const totalRows = Object.entries(q.totals).map(([class_code, amount]) => ({
      quarter_id: quarterId,
      class_code,
      amount,
    }));
    if (totalRows.length) {
      const { error } = await supabase.from("patrimonio_class_totals").insert(totalRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("patrimonio_line_items").delete().eq("quarter_id", quarterId);
    if (q.lineItems.length) {
      const { error } = await supabase
        .from("patrimonio_line_items")
        .insert(q.lineItems.map((li) => ({ quarter_id: quarterId, ...li })));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase
    .from("portfolio_sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("portfolio_key", "patrimonio");

  const ultimo = parsed[parsed.length - 1];
  return NextResponse.json({
    ok: true,
    leidos: parsed.length,
    nuevos,
    actualizados,
    avisos,
    ultimo: `${ultimo.quarter} ${ultimo.year}`,
    quarters: await fetchPatrimonioQuarters(supabase),
  });
}
