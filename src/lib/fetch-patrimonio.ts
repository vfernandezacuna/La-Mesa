import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatrimonioQuarterTotals } from "./context";
import type { PatrimonioClassCode, PatrimonioClassTotal, PatrimonioLineItem, PatrimonioQuarter } from "./types";

export interface PatrimonioQuarterFull extends PatrimonioQuarterTotals {
  id: string;
  lineItems: PatrimonioLineItem[];
}

export async function fetchPatrimonioQuarters(supabase: SupabaseClient): Promise<PatrimonioQuarterFull[]> {
  const [quartersRes, lineItemsRes] = await Promise.all([
    supabase
      .from("patrimonio_quarters")
      .select("*, patrimonio_class_totals(*)")
      .order("year", { ascending: true })
      .order("quarter", { ascending: true }),
    supabase.from("patrimonio_line_items").select("*"),
  ]);
  const lineItems = (lineItemsRes.data as PatrimonioLineItem[]) ?? [];
  return ((quartersRes.data as (PatrimonioQuarter & { patrimonio_class_totals: PatrimonioClassTotal[] })[]) ?? []).map(
    (q) => ({
      id: q.id,
      year: q.year,
      quarter: q.quarter,
      totals: Object.fromEntries(q.patrimonio_class_totals.map((t) => [t.class_code, Number(t.amount)])) as Partial<
        Record<PatrimonioClassCode, number>
      >,
      lineItems: lineItems.filter((li) => li.quarter_id === q.id),
    }),
  );
}
