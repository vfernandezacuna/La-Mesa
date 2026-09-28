import { createClient } from "@/lib/supabase/server";
import InversionesView from "@/components/inversiones/InversionesView";
import { todayStr } from "@/lib/date";
import type { PatrimonioQuarterTotals } from "@/lib/context";
import type {
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

export default async function InversionesPage() {
  const supabase = await createClient();

  const [tasksRes, profileRes, reviewsRes, quartersRes, futalemuRes, lastBriefRes, lastNewsRes, indicatorsRes] =
    await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("profile").select("content").maybeSingle(),
      supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
      supabase
        .from("patrimonio_quarters")
        .select("*, patrimonio_class_totals(*)")
        .order("year", { ascending: true })
        .order("quarter", { ascending: true }),
      supabase.from("investments_futalemu").select("*").order("fecha", { ascending: false }).limit(1),
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

  const futalemu = ((futalemuRes.data as InvestmentsFutalemu[]) ?? [])[0] ?? null;
  let cartera: { meta: InvestmentsFutalemu; positions: InvestmentsFutalemuPosition[] } | null = null;
  if (futalemu) {
    const positionsRes = await supabase
      .from("investments_futalemu_positions")
      .select("*")
      .eq("snapshot_id", futalemu.id);
    cartera = { meta: futalemu, positions: (positionsRes.data as InvestmentsFutalemuPosition[]) ?? [] };
  }

  return (
    <InversionesView
      cartera={cartera}
      tasks={(tasksRes.data as Task[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      patrimonioQuarters={quarters}
      lastBrief={(lastBriefRes.data as MarketBriefing | null) ?? null}
      lastNews={(lastNewsRes.data as MarketBriefing | null) ?? null}
      initialIndicators={(indicatorsRes.data as MarketIndicatorsCache | null) ?? null}
    />
  );
}
