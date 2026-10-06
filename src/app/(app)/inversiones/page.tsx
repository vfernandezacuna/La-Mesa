import { createClient } from "@/lib/supabase/server";
import InversionesView, { type Portfolio, type PortfolioHistoryPoint } from "@/components/inversiones/InversionesView";
import { todayStr } from "@/lib/date";
import { buildCarteraEntries, FUTALEMU_DESCRIPCION, type PatrimonioQuarterTotals } from "@/lib/context";
import type {
  InvestmentAccount,
  InvestmentAccountPosition,
  InvestmentAccountSnapshot,
  InvestmentsFutalemu,
  InvestmentsFutalemuPosition,
  MarketBriefing,
  MarketIndicatorsCache,
  PatrimonioClassCode,
  PatrimonioClassTotal,
  PatrimonioQuarter,
  Task,
  WeeklyReview,
} from "@/lib/types";

function historyPoint(h: {
  fecha: string;
  capital: number | null;
  caja: number | null;
  valor_mercado: number | null;
}): PortfolioHistoryPoint {
  return { fecha: h.fecha, capital: h.capital ?? 0, valor: (h.valor_mercado ?? 0) + (h.caja ?? 0) };
}

export default async function InversionesPage() {
  const supabase = await createClient();

  const [
    tasksRes,
    profileRes,
    reviewsRes,
    quartersRes,
    futalemuRes,
    accountsRes,
    lastBriefRes,
    lastNewsRes,
    savedRes,
    indicatorsRes,
  ] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("profile").select("content").maybeSingle(),
    supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
    supabase
      .from("patrimonio_quarters")
      .select("*, patrimonio_class_totals(*)")
      .order("year", { ascending: true })
      .order("quarter", { ascending: true }),
    supabase.from("investments_futalemu").select("*").order("fecha", { ascending: true }),
    supabase.from("investment_accounts").select("*").order("created_at", { ascending: true }),
    supabase
      .from("market_briefings")
      .select("*")
      .eq("kind", "brief")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("market_briefings")
      .select("*")
      .eq("kind", "news")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("market_briefings")
      .select("*")
      .in("kind", ["cio_cartera", "ideas"])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("market_indicators_cache").select("*").eq("as_of", todayStr()).maybeSingle(),
  ]);

  const quarters = (
    (quartersRes.data as (PatrimonioQuarter & { patrimonio_class_totals: PatrimonioClassTotal[] })[]) ?? []
  ).map(
    (q): PatrimonioQuarterTotals => ({
      year: q.year,
      quarter: q.quarter,
      totals: Object.fromEntries(q.patrimonio_class_totals.map((t) => [t.class_code, t.amount])) as Partial<
        Record<PatrimonioClassCode, number>
      >,
    }),
  );

  const futalemuHistory = (futalemuRes.data as InvestmentsFutalemu[]) ?? [];
  const futalemuRow = futalemuHistory[futalemuHistory.length - 1] ?? null;
  let futalemuPositions: InvestmentsFutalemuPosition[] = [];
  if (futalemuRow) {
    const positionsRes = await supabase
      .from("investments_futalemu_positions")
      .select("*")
      .eq("snapshot_id", futalemuRow.id);
    futalemuPositions = (positionsRes.data as InvestmentsFutalemuPosition[]) ?? [];
  }

  const accounts = (accountsRes.data as InvestmentAccount[]) ?? [];
  const accountSnapshotsRes = accounts.length
    ? await supabase
        .from("investment_account_snapshots")
        .select("*")
        .in(
          "account_id",
          accounts.map((a) => a.id),
        )
        .order("fecha", { ascending: true })
    : { data: [] };
  const accountSnapshots = (accountSnapshotsRes.data as InvestmentAccountSnapshot[] | null) ?? [];

  const accountsWithPositions = await Promise.all(
    accounts.map(async (account) => {
      const positionsRes = await supabase
        .from("investment_account_positions")
        .select("*")
        .eq("account_id", account.id);
      return { account, positions: (positionsRes.data as InvestmentAccountPosition[]) ?? [] };
    }),
  );

  const portfolios: Portfolio[] = [];
  if (futalemuRow) {
    portfolios.push({
      key: "futalemu",
      name: "Cartera Inversiones Futalemu",
      descripcion: FUTALEMU_DESCRIPCION,
      subtitle:
        "Portafolio accionario chileno de la sociedad de inversión. No incluye fondos mutuos, APV ni otros activos — esos viven en Patrimonio.",
      meta: {
        fecha: futalemuRow.fecha,
        capital: futalemuRow.capital,
        caja: futalemuRow.caja,
        invertido: futalemuRow.invertido,
        valor_mercado: futalemuRow.valor_mercado,
        rent_anio: futalemuRow.rent_anio,
        rent_acum: futalemuRow.rent_acum,
      },
      positions: futalemuPositions,
      history: futalemuHistory.map(historyPoint),
    });
  }
  accountsWithPositions.forEach(({ account, positions }) => {
    portfolios.push({
      key: account.id,
      name: account.name,
      descripcion: account.descripcion ?? "",
      subtitle: account.descripcion || "Cuenta de inversión personal.",
      meta: {
        fecha: account.fecha,
        capital: account.capital ?? 0,
        caja: account.caja ?? 0,
        invertido: account.invertido ?? 0,
        valor_mercado: account.valor_mercado ?? 0,
        rent_anio: account.rent_anio ?? 0,
        rent_acum: account.rent_acum ?? 0,
      },
      positions,
      history: accountSnapshots.filter((h) => h.account_id === account.id).map(historyPoint),
    });
  });

  const carteras = buildCarteraEntries(
    futalemuRow ? { meta: futalemuRow, positions: futalemuPositions } : null,
    accountsWithPositions,
  );

  // Lo más reciente de cada análisis guardado: uno por cartera y uno de ideas.
  const saved = (savedRes.data as MarketBriefing[] | null) ?? [];
  const lastCioByPortfolio: Record<string, MarketBriefing> = {};
  for (const r of saved) {
    if (r.kind === "cio_cartera" && r.input_text && !lastCioByPortfolio[r.input_text]) {
      lastCioByPortfolio[r.input_text] = r;
    }
  }
  const lastIdeas = saved.find((r) => r.kind === "ideas") ?? null;

  return (
    <InversionesView
      portfolios={portfolios}
      tasks={(tasksRes.data as Task[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      patrimonioQuarters={quarters}
      carteras={carteras}
      lastBrief={(lastBriefRes.data as MarketBriefing | null) ?? null}
      lastNews={(lastNewsRes.data as MarketBriefing | null) ?? null}
      lastCioByPortfolio={lastCioByPortfolio}
      lastIdeas={lastIdeas}
      initialIndicators={(indicatorsRes.data as MarketIndicatorsCache | null) ?? null}
    />
  );
}
