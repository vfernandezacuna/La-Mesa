import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSheetCsv, parseSheetCsv } from "@/lib/google-sheets";
import { parseCarteraSheet } from "@/lib/parse-cartera-sheet";

// Lee la hoja de Google Sheets configurada para una cartera (portfolio_sources)
// y actualiza su snapshot + posiciones. 'futalemu' es investments_futalemu
// (histórico por fecha); cualquier otro portfolioKey es el id de una fila
// de investment_accounts (un solo registro mutable por cuenta).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { portfolioKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const portfolioKey = body.portfolioKey;
  if (!portfolioKey) {
    return NextResponse.json({ error: "Falta portfolioKey" }, { status: 400 });
  }

  const sourceRes = await supabase
    .from("portfolio_sources")
    .select("spreadsheet_id, gid")
    .eq("portfolio_key", portfolioKey)
    .maybeSingle();

  if (sourceRes.error || !sourceRes.data) {
    return NextResponse.json(
      { error: "Esta cartera no tiene una hoja de Google Sheets configurada todavía." },
      { status: 404 },
    );
  }
  const source = sourceRes.data as { spreadsheet_id: string; gid: string | null };

  let snapshot;
  try {
    const csv = await fetchSheetCsv(source.spreadsheet_id, source.gid ?? undefined);
    const rows = parseSheetCsv(csv);
    snapshot = parseCarteraSheet(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al leer la hoja.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (portfolioKey === "futalemu") {
    const upsertRes = await supabase
      .from("investments_futalemu")
      .upsert(
        {
          user_id: user.id,
          fecha: snapshot.fecha,
          capital: snapshot.capital,
          caja: snapshot.caja,
          invertido: snapshot.invertido,
          valor_mercado: snapshot.valor_mercado,
          rent_anio: snapshot.rent_anio,
          rent_acum: snapshot.rent_acum,
        },
        { onConflict: "user_id,fecha" },
      )
      .select("id")
      .single();

    if (upsertRes.error || !upsertRes.data) {
      return NextResponse.json(
        { error: upsertRes.error?.message ?? "Error al guardar el snapshot." },
        { status: 500 },
      );
    }
    const snapshotId = upsertRes.data.id as string;

    await supabase.from("investments_futalemu_positions").delete().eq("snapshot_id", snapshotId);
    const positionsRes = await supabase
      .from("investments_futalemu_positions")
      .insert(snapshot.positions.map((p) => ({ snapshot_id: snapshotId, ...p })));
    if (positionsRes.error) {
      return NextResponse.json({ error: positionsRes.error.message }, { status: 500 });
    }
  } else {
    const updateRes = await supabase
      .from("investment_accounts")
      .update({
        fecha: snapshot.fecha,
        capital: snapshot.capital,
        caja: snapshot.caja,
        invertido: snapshot.invertido,
        valor_mercado: snapshot.valor_mercado,
        rent_anio: snapshot.rent_anio,
        rent_acum: snapshot.rent_acum,
      })
      .eq("id", portfolioKey)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (updateRes.error || !updateRes.data) {
      return NextResponse.json(
        { error: updateRes.error?.message ?? "No se encontró la cuenta de inversión." },
        { status: 404 },
      );
    }

    await supabase.from("investment_account_positions").delete().eq("account_id", portfolioKey);
    const positionsRes = await supabase
      .from("investment_account_positions")
      .insert(snapshot.positions.map((p) => ({ account_id: portfolioKey, ...p })));
    if (positionsRes.error) {
      return NextResponse.json({ error: positionsRes.error.message }, { status: 500 });
    }

    // Historia para el gráfico de evolución: una fila por fecha de la hoja.
    await supabase.from("investment_account_snapshots").upsert(
      {
        user_id: user.id,
        account_id: portfolioKey,
        fecha: snapshot.fecha,
        capital: snapshot.capital,
        caja: snapshot.caja,
        invertido: snapshot.invertido,
        valor_mercado: snapshot.valor_mercado,
        rent_anio: snapshot.rent_anio,
        rent_acum: snapshot.rent_acum,
      },
      { onConflict: "account_id,fecha" },
    );
  }

  await supabase.from("portfolio_sources").update({ last_synced_at: new Date().toISOString() }).eq(
    "portfolio_key",
    portfolioKey,
  );

  return NextResponse.json({ ok: true, fecha: snapshot.fecha });
}
