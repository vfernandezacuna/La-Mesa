import { createClient } from "@/lib/supabase/server";
import PatrimonioView from "@/components/patrimonio/PatrimonioView";
import { todayStr } from "@/lib/date";
import { fetchCarteraEntries } from "@/lib/fetch-carteras";
import { fetchPatrimonioQuarters } from "@/lib/fetch-patrimonio";
import type { MarketBriefing, MarketIndicatorsCache, Task, WeeklyReview } from "@/lib/types";

export default async function PatrimonioPage() {
  const supabase = await createClient();

  const [tasksRes, profileRes, reviewsRes, quarters, carteras, indicatorsRes, lastCioRes] =
    await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("profile").select("content").maybeSingle(),
      supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
      fetchPatrimonioQuarters(supabase),
      fetchCarteraEntries(supabase),
      supabase.from("market_indicators_cache").select("*").eq("as_of", todayStr()).maybeSingle(),
      supabase
        .from("market_briefings")
        .select("*")
        .eq("kind", "cio_patrimonio")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  return (
    <PatrimonioView
      quarters={quarters}
      tasks={(tasksRes.data as Task[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      weeklyReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      carteras={carteras}
      initialIndicators={(indicatorsRes.data as MarketIndicatorsCache | null) ?? null}
      cioHistory={(lastCioRes.data as MarketBriefing[] | null) ?? []}
    />
  );
}
