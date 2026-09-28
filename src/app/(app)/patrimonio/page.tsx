import { createClient } from "@/lib/supabase/server";
import PatrimonioView from "@/components/patrimonio/PatrimonioView";
import { todayStr } from "@/lib/date";
import type { PatrimonioQuarterTotals } from "@/lib/context";
import type {
  InvestmentsFutalemu,
  InvestmentsFutalemuPosition,
  MarketIndicatorsCache,
  PatrimonioClassCode,
  PatrimonioClassTotal,
  PatrimonioLineItem,
  PatrimonioQuarter,
  Task,
  WeeklyReview,
} from "@/lib/types";

export interface PatrimonioQuarterFull extends PatrimonioQuarterTotals {
  id: string;
  lineItems: PatrimonioLineItem[];
}

export default async function PatrimonioPage() {
  const supabase = await createClient();

  const [tasksRes, profileRes, reviewsRes, quartersRes, lineItemsRes, futalemuRes, indicatorsRes] =
    await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("profile").select("content").maybeSingle(),
      supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
      supabase
        .from("patrimonio_quarters")
        .select("*, patrimonio_class_totals(*)")
        .order("year", { ascending: true })
        .order("quarter", { ascending: true }),
      supabase.from("patrimonio_line_items").select("*"),
      supabase.from("investments_futalemu").select("*").order("fecha", { ascending: false }).limit(1),
      supabase.from("market_indicators_cache").select("*").eq("as_of", todayStr()).maybeSingle(),
    ]);

  const lineItems = (lineItemsRes.data as PatrimonioLineItem[]) ?? [];
  const quarters: PatrimonioQuarterFull[] = (
    (quartersRes.data as (PatrimonioQuarter & { patrimonio_class_totals: PatrimonioClassTotal[] })[]) ?? []
  ).map((q) => ({
    id: q.id,
    year: q.year,
    quarter: q.quarter,
    totals: Object.fromEntries(q.patrimonio_class_totals.map((t) => [t.class_code, t.amount])) as Partial<
      Record<PatrimonioClassCode, number>
    >,
    lineItems: lineItems.filter((li) => li.quarter_id === q.id),
  }));

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
    <PatrimonioView
      quarters={quarters}
      tasks={(tasksRes.data as Task[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      cartera={cartera}
      initialIndicators={(indicatorsRes.data as MarketIndicatorsCache | null) ?? null}
    />
  );
}
